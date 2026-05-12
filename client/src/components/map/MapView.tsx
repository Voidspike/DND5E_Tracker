import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useCampaignStore } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';
import { canEditToken } from '../../utils/token';

const TOKEN_TYPES = [
  { value: 'character', label: 'PC', icon: '🧙', color: '#4fc3f7' },
  { value: 'npc', label: 'NPC', icon: '👤', color: '#e94560' },
  { value: 'monster', label: 'Monster', icon: '👾', color: '#ff6b35' },
  { value: 'object', label: 'Object', icon: '📦', color: '#ffd700' },
] as const;

interface MapViewProps {
  map: any;
  tokens: any[];
  isDM: boolean;
  userId?: string;
  socket: Socket;
  selectedTokenId?: string | null;
}

export default function MapView({ map, tokens, isDM, userId, socket, selectedTokenId }: MapViewProps) {
  const { createToken, updateToken, fetchTokens, updateMap, deleteMap, deleteToken, characters, updateCharacter } = useCampaignStore();
  const { fogData, setFogData, setSelectedTokenId, combatMode, setCombatMode, combatTracker, tokenMovementUsed, setTokenMovementUsed, resetTokenMovement, highlightedTokenId, setHighlightedTokenId, combatTargetTokenId, setCombatTargetTokenId } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const visionCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotateCanvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panDragging, setPanDragging] = useState(false);
  const [panDragStart, setPanDragStart] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [syncViewEnabled, setSyncViewEnabled] = useState(false);
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [gridSize, setGridSize] = useState(map.gridSize || 50);
  const [gridOffsetX, setGridOffsetX] = useState(map.gridOffsetX || 0);
  const [gridOffsetY, setGridOffsetY] = useState(map.gridOffsetY || 0);
  const [gridColor, setGridColor] = useState(map.gridColor || 'rgba(255,255,255,0.15)');
  const [gridLineWidth, setGridLineWidth] = useState(map.gridLineWidth || 1);
  const [mapW, setMapW] = useState(map.width || 30);
  const [mapH, setMapH] = useState(map.height || 20);
  const [fogMode, setFogMode] = useState<'none' | 'paint' | 'erase'>('none');
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotateColor, setAnnotateColor] = useState('#e94560');
  const [playerViewMode, setPlayerViewMode] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [dragTokenId, setDragTokenId] = useState<string | null>(null);
  const [dragTokenOffset, setDragTokenOffset] = useState({ x: 0, y: 0 });
  const [dragTokenPos, setDragTokenPos] = useState({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const [createTokenType, setCreateTokenType] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ tokenId: string; x: number; y: number } | null>(null);
  const touchRef = useRef<{
    touches: Map<number, { startX: number; startY: number; startScale: number; startOffset: { x: number; y: number } }>;
    pinchDist: number;
  }>({ touches: new Map(), pinchDist: 0 });

  const gridPixels = gridSize;
  const mapPixelWidth = (map.width || 30) * gridPixels;
  const mapPixelHeight = (map.height || 20) * gridPixels;

  useEffect(() => {
    setGridSize(map.gridSize || 50);
    setGridOffsetX(map.gridOffsetX || 0);
    setGridOffsetY(map.gridOffsetY || 0);
    setGridColor(map.gridColor || 'rgba(255,255,255,0.15)');
    setGridLineWidth(map.gridLineWidth || 1);
    setMapW(map.width || 30);
    setMapH(map.height || 20);
  }, [map.gridSize, map.gridOffsetX, map.gridOffsetY, map.gridColor, map.gridLineWidth, map.width, map.height]);

  // Initialize fog canvas from stored fogData (transparent = no fog = fully revealed)
  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (fogData) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = fogData;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fogData, map.id, mapPixelWidth, mapPixelHeight]);

  // Listen for fog updates from other users
  useEffect(() => {
    const handler = (data: string) => {
      setFogData(data);
    };
    socket.on('map:fog:update', handler);
    return () => { socket.off('map:fog:update', handler); };
  }, [socket, setFogData]);

  // Listen for annotation updates from other users
  useEffect(() => {
    const handler = (data: string) => {
      const canvas = annotateCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = data;
    };
    socket.on('map:annotation:update', handler);
    return () => { socket.off('map:annotation:update', handler); };
  }, [socket]);

  // Listen for annotation clear from other users
  useEffect(() => {
    const handler = () => {
      const canvas = annotateCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    socket.on('map:annotation:clear', handler);
    return () => { socket.off('map:annotation:clear', handler); };
  }, [socket]);

  // Listen for DM viewport sync
  useEffect(() => {
    const handler = (data: { mapId: string; offset: { x: number; y: number }; scale: number }) => {
      if (data.mapId !== map.id) return;
      setIsAnimating(true);
      setOffset(data.offset);
      setScale(data.scale);
      clearTimeout((window as any).__syncAnimTimeout);
      (window as any).__syncAnimTimeout = setTimeout(() => setIsAnimating(false), 300);
    };
    socket.on('map:viewport:sync', handler);
    return () => { socket.off('map:viewport:sync', handler); };
  }, [socket, map.id]);

  const emitViewport = useCallback(() => {
    if (!syncViewEnabled || !isDM) return;
    socket.emit('map:viewport:sync', {
      campaignId: map.campaignId,
      mapId: map.id,
      offset,
      scale,
    });
  }, [syncViewEnabled, isDM, socket, map.campaignId, map.id, offset, scale]);

  // Draw vision range circle for selected token
  useEffect(() => {
    const canvas = visionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!selectedTokenId) return;
    const token = tokens.find(t => t.id === selectedTokenId);
    if (!token || !token.darkvision || token.darkvision <= 0) return;

    // 1 grid = 5 ft, radius in grid units = darkvision / 5
    const radiusGrids = token.darkvision / 5;
    const radiusPx = radiusGrids * gridPixels;

    // Token center in canvas (pixel) space
    const cx = token.x * gridPixels;
    const cy = token.y * gridPixels;

    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(79, 195, 247, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Also draw speed circle (dashed)
    if (token.speed && token.speed > 0) {
      const speedGrids = token.speed / 5;
      const speedRadiusPx = speedGrids * gridPixels;
      ctx.beginPath();
      ctx.arc(cx, cy, speedRadiusPx, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 152, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [selectedTokenId, tokens, gridPixels, scale, offset, mapPixelWidth, mapPixelHeight]);

  // Compute active turn token ID from combat tracker
  const activeTurnTokenId = combatMode && combatTracker
    ? combatTracker.participants.find((p: any) => p.isActiveTurn)?.tokenId || null
    : null;

  // Pan to a token (smoothly center on it without changing zoom)
  const panToToken = useCallback((tokenId: string) => {
    const token = tokens.find((t: any) => t.id === tokenId);
    if (!token || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setIsAnimating(true);
    setOffset({
      x: cx - token.x * gridPixels * scale,
      y: cy - token.y * gridPixels * scale,
    });
    clearTimeout((window as any).__panAnimTimeout);
    (window as any).__panAnimTimeout = setTimeout(() => setIsAnimating(false), 300);
  }, [tokens, gridPixels, scale]);

  // Auto-pan to active turn token when it changes
  useEffect(() => {
    if (activeTurnTokenId) {
      panToToken(activeTurnTokenId);
    }
  }, [activeTurnTokenId]);

  // Pan to highlighted token when clicked in combat list
  useEffect(() => {
    if (highlightedTokenId) {
      panToToken(highlightedTokenId);
    }
  }, [highlightedTokenId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Touchpad pinch emits ctrlKey + wheel
    const isPinch = e.ctrlKey;

    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.min(3, Math.max(0.2, scale * delta));
    const scaleChange = newScale / scale;

    // Zoom towards cursor position
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setOffset({
      x: mouseX - scaleChange * (mouseX - offset.x),
      y: mouseY - scaleChange * (mouseY - offset.y),
    });
    setScale(newScale);

    if (!isPinch && !panDragging) {
      setIsAnimating(true);
      clearTimeout((window as any).__zoomAnimTimeout);
      (window as any).__zoomAnimTimeout = setTimeout(() => setIsAnimating(false), 150);
    }
    // Sync viewport to players (debounced via socket emission)
    emitViewport();
  }, [scale, offset.x, offset.y, panDragging, emitViewport]);

  const getGridCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offset.x) / scale / gridPixels,
      y: (clientY - rect.top - offset.y) / scale / gridPixels,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (annotateMode) {
      setIsPainting(true);
      drawAnnotate(e);
      return;
    }
    if (fogMode !== 'none') {
      setIsPainting(true);
      paintFog(e);
      return;
    }
    if (e.button === 1 || e.shiftKey) {
      setPanDragging(true);
      setPanDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (annotateMode && isPainting) {
      drawAnnotate(e);
      return;
    }
    if (fogMode !== 'none' && isPainting) {
      paintFog(e);
      return;
    }
    if (dragTokenId) {
      const coords = getGridCoords(e.clientX, e.clientY);
      let newX = coords.x - dragTokenOffset.x;
      let newY = coords.y - dragTokenOffset.y;
      // Speed limit in combat mode
      if (combatMode) {
        const draggedToken = tokens.find((t: any) => t.id === dragTokenId);
        if (draggedToken) {
          const speed = draggedToken.speed || 30;
          const maxGrids = speed / 5;
          const startPos = dragStartPosRef.current;
          const dx = newX - startPos.x;
          const dy = newY - startPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxGrids) {
            const scale = maxGrids / dist;
            newX = startPos.x + dx * scale;
            newY = startPos.y + dy * scale;
          }
        }
      }
      setDragTokenPos({ x: newX, y: newY });
      socket.emit('token:drag', { tokenId: dragTokenId, x: newX, y: newY });
      return;
    }
    if (panDragging) {
      setOffset({ x: e.clientX - panDragStart.x, y: e.clientY - panDragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPainting(false);
    const wasPanning = panDragging;
    setPanDragging(false);
    if (dragTokenId) {
      updateToken(dragTokenId, { x: dragTokenPos.x, y: dragTokenPos.y });
      socket.emit('token:move', { tokenId: dragTokenId, x: dragTokenPos.x, y: dragTokenPos.y });
      setDragTokenId(null);
    }
    if (annotateMode) {
      saveAnnotationData();
    }
    if (fogMode !== 'none') {
      saveFogData();
    }
    if (wasPanning) emitViewport();
  };

  // ── Touch handlers for mobile ──
  const getTouchPos = (touch: React.Touch) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: touch.clientX, y: touch.clientY };
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current.pinchDist = Math.sqrt(dx * dx + dy * dy);
      touchRef.current.touches.clear();
      setDragTokenId(null);
      return;
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const pos = getTouchPos(touch);
      // Check if touching a token
      const touchedToken = tokens.find((t: any) => {
        if (t.mapId !== map.id) return false;
        if (!isDM && t.isHidden) return false;
        const tx = t.x * gridPixels * scale + offset.x;
        const ty = t.y * gridPixels * scale + offset.y;
        const size = Math.max(24, (t.width || 1) * gridPixels * scale);
        const dist = Math.sqrt((pos.x - tx) ** 2 + (pos.y - ty) ** 2);
        return dist < size / 2 + 10;
      });
      if (touchedToken && canEditToken(touchedToken, userId, isDM)) {
        const coords = getGridCoords(touch.clientX, touch.clientY);
        setDragTokenId(touchedToken.id);
        setDragTokenOffset({ x: coords.x - touchedToken.x, y: coords.y - touchedToken.y });
        setDragTokenPos({ x: touchedToken.x, y: touchedToken.y });
        dragStartPosRef.current = { x: touchedToken.x, y: touchedToken.y };
        touchRef.current.touches.set(touch.identifier, { startX: 0, startY: 0, startScale: 0, startOffset: { x: 0, y: 0 } });
      } else {
        // Pan start
        setPanDragging(true);
        setPanDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
        touchRef.current.touches.clear();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (touchRef.current.pinchDist > 0) {
        const ratio = dist / touchRef.current.pinchDist;
        const newScale = Math.min(3, Math.max(0.2, scale * ratio));
        const scaleChange = newScale / scale;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const mx = cx - rect.left;
          const my = cy - rect.top;
          setOffset({ x: mx - scaleChange * (mx - offset.x), y: my - scaleChange * (my - offset.y) });
        }
        setScale(newScale);
        touchRef.current.pinchDist = dist;
      }
      return;
    }
    if (e.touches.length === 1 && dragTokenId) {
      const touch = e.touches[0];
      const coords = getGridCoords(touch.clientX, touch.clientY);
      let newX = coords.x - dragTokenOffset.x;
      let newY = coords.y - dragTokenOffset.y;
      if (combatMode) {
        const draggedToken = tokens.find((t: any) => t.id === dragTokenId);
        if (draggedToken) {
          const speed = draggedToken.speed || 30;
          const maxGrids = speed / 5;
          const startPos = dragStartPosRef.current;
          const dx = newX - startPos.x;
          const dy = newY - startPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxGrids) {
            const scale = maxGrids / dist;
            newX = startPos.x + dx * scale;
            newY = startPos.y + dy * scale;
          }
        }
      }
      setDragTokenPos({ x: newX, y: newY });
      socket.emit('token:drag', { tokenId: dragTokenId, x: newX, y: newY });
      return;
    }
    if (e.touches.length === 1 && panDragging) {
      const touch = e.touches[0];
      setOffset({ x: touch.clientX - panDragStart.x, y: touch.clientY - panDragStart.y });
    }
  };

  const handleTouchEnd = () => {
    if (dragTokenId) {
      updateToken(dragTokenId, { x: dragTokenPos.x, y: dragTokenPos.y });
      socket.emit('token:move', { tokenId: dragTokenId, x: dragTokenPos.x, y: dragTokenPos.y });
      setDragTokenId(null);
    }
    setPanDragging(false);
    touchRef.current.pinchDist = 0;
  };

  const paintFog = (e: React.MouseEvent) => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasX = (mouseX - offset.x) / scale;
    const canvasY = (mouseY - offset.y) / scale;

    ctx.globalCompositeOperation = fogMode === 'erase' ? 'destination-out' : 'source-over';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 30, 0, Math.PI * 2);
    ctx.fill();
  };

  const saveFogData = () => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setFogData(dataUrl);
    socket.emit('map:fog:update', { mapId: map.id, campaignId: map.campaignId, fogData: dataUrl });
  };

  const drawAnnotate = (e: React.MouseEvent) => {
    const canvas = annotateCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left - offset.x) / scale;
    const canvasY = (e.clientY - rect.top - offset.y) / scale;
    ctx.strokeStyle = annotateColor;
    ctx.lineWidth = 2 / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(canvasX, canvasY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvasX, canvasY);
  };

  const saveAnnotationData = () => {
    const canvas = annotateCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    socket.emit('map:annotation:update', { mapId: map.id, campaignId: map.campaignId, data: dataUrl });
  };

  const clearAnnotations = () => {
    const canvas = annotateCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveAnnotationData();
    socket.emit('map:annotation:clear', { mapId: map.id, campaignId: map.campaignId });
  };

  const clearAllFog = () => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveFogData();
  };

  const resetAllFog = () => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveFogData();
  };

  const handleMapClick = async (e: React.MouseEvent) => {
    setContextMenu(null);
    setSelectedTokenId(null);
    socket.emit('token:select', null);
    if (fogMode !== 'none' || dragTokenId || !containerRef.current) return;
    if (!createTokenType || (!isDM && !userId)) return;
    const coords = getGridCoords(e.clientX, e.clientY);

    const typeDef = TOKEN_TYPES.find((t) => t.value === createTokenType);
    const tokenData: any = {
      mapId: map.id,
      type: createTokenType,
      name: typeDef?.label || 'New Token',
      x: coords.x,
      y: coords.y,
      color: typeDef?.color || '#e94560',
    };
    // Non-DM players always own their tokens
    if (!isDM) tokenData.ownerId = userId;

    const created = await createToken(tokenData);
    socket.emit('token:create', { campaignId: map.campaignId, token: created });
  };

  const handleTokenMouseDown = (e: React.MouseEvent, token: any) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    // In active combat mode: clicking a participant sets it as target
    if (isDM && combatTracker && combatTracker.status === 'active') {
      const participant = combatTracker.participants.find((p: any) => p.tokenId === token.id);
      if (participant) {
        if (participant.isActiveTurn) {
          setCombatTargetTokenId(null);
        } else {
          setCombatTargetTokenId(token.id);
        }
        setSelectedTokenId(token.id);
        socket.emit('token:select', token.id);
        return;
      }
    }

    if (!isDM && token.ownerId !== userId) {
      setSelectedTokenId(token.id);
      socket.emit('token:select', token.id);
      return;
    }
    const coords = getGridCoords(e.clientX, e.clientY);
    setDragTokenId(token.id);
    setDragTokenPos({ x: token.x, y: token.y });
    setDragTokenOffset({ x: coords.x - token.x, y: coords.y - token.y });
    dragStartPosRef.current = { x: token.x, y: token.y };
    setSelectedTokenId(token.id);
    socket.emit('token:select', token.id);
  };

  const handleHPChange = async (token: any, delta: number) => {
    const newHp = Math.max(0, (token.hpCurrent || 0) + delta);
    await updateToken(token.id, { hpCurrent: newHp });
    socket.emit('token:update', {
      campaignId: map.campaignId,
      tokenId: token.id,
      updates: { hpCurrent: newHp },
    });
    // Sync HP to linked character
    if (token.characterId) {
      updateCharacter(token.characterId, { hpCurrent: newHp } as any)
        .then((updated) => {
          if (updated) socket.emit('character:update', { characterId: token.characterId, updates: { hpCurrent: newHp } });
        })
        .catch(console.error);
    }
  };

  const handleToggleHidden = async (token: any) => {
    await updateToken(token.id, { isHidden: !token.isHidden });
    socket.emit('token:update', {
      campaignId: map.campaignId,
      tokenId: token.id,
      updates: { isHidden: !token.isHidden },
    });
  };

  const applyGridSettings = () => {
    socket.emit('map:grid:update', {
      mapId: map.id,
      campaignId: map.campaignId,
      grid: { gridSize, gridOffsetX, gridOffsetY, gridColor, gridLineWidth },
    });
    updateMap(map.id, { width: mapW, height: mapH, gridColor, gridLineWidth });
    setShowGridSettings(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-dnd-bg select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleMapClick}
      style={{ cursor: annotateMode ? 'crosshair' : fogMode !== 'none' ? 'crosshair' : panDragging ? 'grabbing' : createTokenType ? 'crosshair' : 'grab' }}
    >
      {/* Map Image */}
      {map.imageUrl && (
        <img
          src={map.imageUrl}
          alt={map.name}
          className="absolute"
          style={{
            width: mapPixelWidth,
            height: mapPixelHeight,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
            objectFit: 'fill',
            transition: isAnimating ? 'transform 150ms ease-out' : 'none',
          }}
        />
      )}

      {/* Grid */}
      <svg
        className="absolute"
        width={mapPixelWidth}
        height={mapPixelHeight}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          transition: isAnimating ? 'transform 150ms ease-out' : 'none',
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={gridPixels}
            height={gridPixels}
            patternUnits="userSpaceOnUse"
            x={gridOffsetX}
            y={gridOffsetY}
          >
            <path
              d={`M ${gridPixels} 0 L 0 0 0 ${gridPixels}`}
              fill="none"
              stroke={gridColor}
              strokeWidth={gridLineWidth}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Vision Range Canvas */}
      <canvas
        ref={visionCanvasRef}
        className="absolute"
        width={mapPixelWidth}
        height={mapPixelHeight}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          transition: isAnimating ? 'transform 150ms ease-out' : 'none',
        }}
      />

      {/* Annotation Canvas */}
      <canvas
        ref={annotateCanvasRef}
        className="absolute"
        width={mapPixelWidth}
        height={mapPixelHeight}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: annotateMode ? 'auto' : 'none',
          transition: isAnimating ? 'transform 150ms ease-out' : 'none',
        }}
      />

      {/* Fog of War Canvas */}
      <canvas
        ref={fogCanvasRef}
        className="absolute"
        width={mapPixelWidth}
        height={mapPixelHeight}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: fogMode !== 'none' ? 'auto' : 'none',
          transition: isAnimating ? 'transform 150ms ease-out' : 'none',
        }}
      />

      {/* Tokens */}
      {tokens
        .filter((t) => t.mapId === map.id && (isDM || !t.isHidden || t.ownerId === userId))
        .map((token) => (
          <div key={token.id} className="absolute" style={{
            left: (dragTokenId === token.id ? dragTokenPos.x : token.x) * gridPixels * scale + offset.x,
            top: (dragTokenId === token.id ? dragTokenPos.y : token.y) * gridPixels * scale + offset.y,
            transform: 'translate(-50%, -50%)',
            zIndex: dragTokenId === token.id ? 50 : 10,
            transition: (isAnimating && dragTokenId !== token.id) ? 'left 0.3s ease-out, top 0.3s ease-out' : 'none',
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (canEditToken(token, userId, isDM) || token.ownerId === undefined) {
              setContextMenu({ tokenId: token.id, x: e.clientX, y: e.clientY });
            }
          }}>
            {/* Token Circle / Portrait */}
            {(() => {
              const linkedChar = token.characterId ? characters.find((c: any) => c.id === token.characterId) : null;
              const portraitUrl = linkedChar?.imageUrl || token.imageUrl;
              const size = Math.max(24, token.width * gridPixels * scale);
              return portraitUrl ? (
                <div
                  className={`rounded-full border-2 overflow-hidden ${
                    dragTokenId === token.id ? 'opacity-80 scale-110' : ''
                  }`}
                  style={{
                    width: size,
                    height: size,
                    borderColor: token.color,
                    cursor: canEditToken(token, userId, isDM) ? 'grab' : 'pointer',
                    minWidth: 24,
                    minHeight: 24,
                    boxShadow: token.id === activeTurnTokenId
                      ? '0 0 0 3px rgba(255, 193, 7, 0.85), 0 0 16px rgba(255, 193, 7, 0.5)'
                      : token.id === combatTargetTokenId
                        ? '0 0 0 3px rgba(255, 152, 0, 0.85), 0 0 16px rgba(255, 152, 0, 0.5)'
                        : token.id === highlightedTokenId
                          ? '0 0 0 3px rgba(0, 188, 212, 0.85), 0 0 16px rgba(0, 188, 212, 0.5)'
                          : undefined,
                  }}
                  onMouseDown={(e) => {
                    if (!canEditToken(token, userId, isDM)) { e.stopPropagation(); setSelectedTokenId(token.id); socket.emit('token:select', token.id); return; }
                    handleTokenMouseDown(e, token);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canEditToken(token, userId, isDM)) { setSelectedTokenId(token.id); socket.emit('token:select', token.id); }
                  }}
                >
                  <img src={portraitUrl} alt={token.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                </div>
              ) : (
                <div
                  className={`flex items-center justify-center rounded-full border-2 ${
                    dragTokenId === token.id ? 'opacity-80 scale-110' : ''
                  }`}
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: token.color + '40',
                    borderColor: token.color,
                    cursor: canEditToken(token, userId, isDM) ? 'grab' : 'pointer',
                    minWidth: 24,
                    minHeight: 24,
                    boxShadow: token.id === activeTurnTokenId
                      ? '0 0 0 3px rgba(255, 193, 7, 0.85), 0 0 16px rgba(255, 193, 7, 0.5)'
                      : token.id === highlightedTokenId
                        ? '0 0 0 3px rgba(0, 188, 212, 0.85), 0 0 16px rgba(0, 188, 212, 0.5)'
                        : undefined,
                  }}
                  onMouseDown={(e) => {
                    if (!canEditToken(token, userId, isDM)) { e.stopPropagation(); setSelectedTokenId(token.id); socket.emit('token:select', token.id); return; }
                    handleTokenMouseDown(e, token);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canEditToken(token, userId, isDM)) { setSelectedTokenId(token.id); socket.emit('token:select', token.id); }
                  }}
                >
                  <span className="text-xs font-bold text-white drop-shadow-lg select-none" style={{ fontSize: `${Math.max(10, 14 * scale)}px` }}>
                    {token.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              );
            })()}

            {/* HP Bar below token */}
            {canEditToken(token, userId, isDM) && token.hpMax && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/60 rounded px-1 py-0.5 whitespace-nowrap" style={{ opacity: dragTokenId === token.id ? 0 : 1 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleHPChange(token, -1); }}
                  className="text-dnd-danger text-xs leading-none hover:bg-dnd-danger/20 rounded px-0.5"
                >
                  −
                </button>
                <div className="w-10 h-1.5 bg-dnd-darker rounded overflow-hidden mx-0.5">
                  <div
                    className="h-full bg-dnd-success rounded transition-all"
                    style={{ width: `${Math.max(0, ((token.hpCurrent || 0) / token.hpMax) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-white font-medium">{token.hpCurrent ?? '?'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleHPChange(token, 1); }}
                  className="text-dnd-success text-xs leading-none hover:bg-dnd-success/20 rounded px-0.5"
                >
                  +
                </button>
              </div>
            )}

            {/* Hidden indicator */}
            {canEditToken(token, userId, isDM) && token.isHidden && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] bg-dnd-warning/30 text-dnd-warning px-1 rounded" style={{ opacity: dragTokenId === token.id ? 0 : 1 }}>
                hidden
              </div>
            )}
          </div>
        ))}

      {/* Context Menu */}
      {contextMenu && (() => {
        const ctxToken = tokens.find((t: any) => t.id === contextMenu.tokenId);
        if (!ctxToken) return null;
        return (
          <div
            className="fixed z-50 bg-dnd-surface border border-dnd-accent rounded-lg shadow-2xl py-1 min-w-36"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={() => setContextMenu(null)}
          >
            <button
              onClick={() => {
                setSelectedTokenId(ctxToken.id);
                socket.emit('token:select', ctxToken.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-dnd-primary/20 text-dnd-text"
            >
              View Details
            </button>
            {canEditToken(ctxToken, userId, isDM) && (
              <>
                <button
                  onClick={() => {
                    handleHPChange(ctxToken, -5);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-dnd-danger/10 text-dnd-danger/90"
                >
                  HP -5
                </button>
                <button
                  onClick={() => {
                    handleHPChange(ctxToken, 5);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-dnd-success/10 text-dnd-success"
                >
                  HP +5
                </button>
                <button
                  onClick={() => {
                    handleToggleHidden(ctxToken);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-dnd-accent/30 text-dnd-muted"
                >
                  {ctxToken.isHidden ? 'Show Token' : 'Hide Token'}
                </button>
                <div className="border-t border-dnd-accent/30 my-1" />
                <button
                  onClick={() => {
                    if (confirm('Delete this token?')) {
                      deleteToken(ctxToken.id);
                      socket.emit('token:delete', ctxToken.id);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-dnd-danger/20 text-dnd-danger/80"
                >
                  Delete Token
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* Token Creation Toolbar */}
      {(isDM || userId) && !playerViewMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-dnd-surface/90 border border-dnd-accent rounded-lg px-2 py-1.5 flex items-center gap-1 shadow-lg z-20">
          {TOKEN_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setCreateTokenType(createTokenType === t.value ? null : t.value)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                createTokenType === t.value
                  ? 'bg-dnd-primary text-white'
                  : 'text-dnd-muted hover:text-dnd-text hover:bg-dnd-accent/30'
              }`}
              title={`Place ${t.label}`}
            >
              <span className="text-sm">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
          {isDM && (
            <div className="w-px h-5 bg-dnd-accent/40 mx-1" />
          )}
          {/* Hide/Show toggle for selected token */}
          {isDM && selectedTokenId && (
            <button
              onClick={() => {
                const token = tokens.find((t: any) => t.id === selectedTokenId);
                if (token) handleToggleHidden(token);
              }}
              className="text-dnd-muted hover:text-dnd-text px-1.5 py-1 rounded text-xs"
              title="Toggle visibility"
            >
              {tokens.find((t: any) => t.id === selectedTokenId)?.isHidden ? '👁‍🗨' : '👁'}
            </button>
          )}
          {isDM && (
            <>
              <div className="w-px h-5 bg-dnd-accent/40 mx-1" />
              <button
                onClick={() => {
                  if (!combatMode) {
                    setCombatMode(true);
                    socket.emit('combat:start', { campaignId: map.campaignId, mapId: map.id });
                  } else {
                    setCombatMode(false);
                    if (combatTracker && combatTracker.status !== 'completed') {
                      socket.emit('combat:pause', combatTracker.id);
                    }
                  }
                }}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  combatMode ? 'bg-dnd-danger/30 text-dnd-danger' : 'bg-dnd-accent/30 text-dnd-accent hover:bg-dnd-accent/50'
                }`}
                title={combatMode ? 'Exit Combat Mode' : 'Enter Combat Mode'}
              >
                {combatMode ? '⚔ Exit Combat' : '⚔ Combat'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Hint when create mode is active */}
      {createTokenType && isDM && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Click on the map to place a new {TOKEN_TYPES.find((t) => t.value === createTokenType)?.label}
          <button
            onClick={(e) => { e.stopPropagation(); setCreateTokenType(null); }}
            className="ml-2 text-dnd-muted hover:text-white pointer-events-auto"
          >
            ✕
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10 touch-manipulation">
        <button
          onClick={() => setScale((s) => Math.min(3, s * 1.2))}
          className="bg-dnd-surface border border-dnd-accent text-white w-10 h-10 sm:w-8 sm:h-8 rounded hover:bg-dnd-accent text-lg sm:text-base active:bg-dnd-accent"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.2, s / 1.2))}
          className="bg-dnd-surface border border-dnd-accent text-white w-10 h-10 sm:w-8 sm:h-8 rounded hover:bg-dnd-accent text-lg sm:text-base active:bg-dnd-accent"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="bg-dnd-surface border border-dnd-accent text-white px-2 h-10 sm:h-8 rounded text-xs sm:text-xs hover:bg-dnd-accent active:bg-dnd-accent"
        >
          Reset
        </button>
        {isDM && (
          <>
            <button
              onClick={() => { setPlayerViewMode(!playerViewMode); if (!playerViewMode) { setFogMode('none'); setAnnotateMode(false); } }}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center transition-colors ${
                playerViewMode
                  ? 'bg-dnd-info text-white ring-2 ring-dnd-info'
                  : 'bg-dnd-surface border border-dnd-accent text-white hover:bg-dnd-accent'
              }`}
              title="Preview as Player"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
            <button
              onClick={() => setSyncViewEnabled(!syncViewEnabled)}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center transition-colors ${
                syncViewEnabled
                  ? 'bg-dnd-accent text-white ring-2 ring-dnd-accent'
                  : 'bg-dnd-surface border border-dnd-accent text-white hover:bg-dnd-accent'
              }`}
              title="Sync View to Players"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </button>
            {!playerViewMode && (<>
            <button
              onClick={() => setShowGridSettings(true)}
              className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent flex items-center justify-center"
              title="Grid Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => { setFogMode(fogMode === 'erase' ? 'none' : 'erase'); setCreateTokenType(null); }}
                className={`w-8 h-8 rounded text-xs font-bold ${
                  fogMode === 'erase'
                    ? 'bg-dnd-success text-white ring-2 ring-dnd-success'
                    : 'bg-dnd-surface border border-dnd-accent text-white hover:bg-dnd-accent'
                }`}
                title="Erase Fog (reveal area)"
              >
                <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
              <button
                onClick={() => { setFogMode(fogMode === 'paint' ? 'none' : 'paint'); setCreateTokenType(null); }}
                className={`w-8 h-8 rounded text-xs font-bold ${
                  fogMode === 'paint'
                    ? 'bg-dnd-danger text-white ring-2 ring-dnd-danger'
                    : 'bg-dnd-surface border border-dnd-accent text-white hover:bg-dnd-accent'
                }`}
                title="Paint Fog (hide area)"
              >
                <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
            </div>
            <button
              onClick={clearAllFog}
              className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent flex items-center justify-center text-xs"
              title="Reveal All"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <div className="w-px h-5 bg-dnd-accent/40 mx-0.5" />
            {/* Annotation tools */}
            <button
              onClick={() => { setAnnotateMode(!annotateMode); setFogMode('none'); setCreateTokenType(null); }}
              className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                annotateMode
                  ? 'bg-dnd-primary text-white ring-2 ring-dnd-primary'
                  : 'bg-dnd-surface border border-dnd-accent text-dnd-warning hover:bg-dnd-accent'
              }`}
              title="Draw Annotation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            {annotateMode && (
              <>
                <input
                  type="color"
                  value={annotateColor}
                  onChange={(e) => setAnnotateColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                  title="Annotation Color"
                />
                <button
                  onClick={clearAnnotations}
                  className="bg-dnd-surface border border-dnd-accent text-dnd-danger/70 w-8 h-8 rounded hover:bg-dnd-accent flex items-center justify-center text-xs"
                  title="Clear Annotations"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </>
            )}
            <button
              onClick={resetAllFog}
              className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent flex items-center justify-center text-xs"
              title="Hide All"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            </>)}
          </>
        )}
      </div>

      {/* Player view indicator */}
      {playerViewMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-dnd-info/80 text-white text-xs px-3 py-1.5 rounded-full z-30 pointer-events-none">
          👁 Previewing as Player
        </div>
      )}

      {/* Map name overlay */}
      <div className="absolute top-14 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
        {map.name}
      </div>

      {/* Annotation mode indicator */}
      {annotateMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full z-20 flex items-center gap-2">
          <span style={{ color: annotateColor }} className="font-semibold">✎ Drawing</span>
          <button onClick={() => setAnnotateMode(false)} className="text-dnd-muted hover:text-white">✕</button>
        </div>
      )}

      {/* Fog mode indicator */}
      {fogMode !== 'none' && !annotateMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full z-20">
          {fogMode === 'erase' ? 'Revealing Fog (drag to reveal)' : 'Painting Fog (drag to hide)'}
          <button onClick={() => setFogMode('none')} className="ml-2 text-dnd-muted hover:text-white">✕</button>
        </div>
      )}

      {/* Grid Settings Panel */}
      {showGridSettings && isDM && (
        <div className="absolute top-2 right-2 bg-dnd-surface border border-dnd-accent rounded-lg p-4 shadow-xl z-20 w-72 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Map & Grid Settings</h3>
            <button onClick={() => setShowGridSettings(false)} className="text-dnd-muted hover:text-dnd-text">✕</button>
          </div>
          <div className="space-y-3">
            {/* Map dimensions */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-dnd-muted mb-1">Grid W</label>
                <input type="number" min={5} max={200} value={mapW}
                  onChange={(e) => setMapW(parseInt(e.target.value) || 5)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-dnd-muted mb-1">Grid H</label>
                <input type="number" min={5} max={200} value={mapH}
                  onChange={(e) => setMapH(parseInt(e.target.value) || 5)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-dnd-muted mb-1">Grid Size (px)</label>
              <input type="number" min={10} max={200} value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value) || 50)}
                className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-dnd-muted mb-1">Offset X</label>
              <input type="number" value={gridOffsetX}
                onChange={(e) => setGridOffsetX(parseInt(e.target.value) || 0)}
                className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-dnd-muted mb-1">Offset Y</label>
              <input type="number" value={gridOffsetY}
                onChange={(e) => setGridOffsetY(parseInt(e.target.value) || 0)}
                className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1.5 text-sm" />
            </div>

            {/* Grid Line Color */}
            <div>
              <label className="block text-xs text-dnd-muted mb-1">Grid Line Color</label>
              <div className="flex gap-2">
                <input type="color" value={gridColor.startsWith('rgba') ? '#ffffff' : gridColor}
                  onChange={(e) => {
                    // preserve alpha from rgba, or use full opacity for hex
                    const alpha = gridColor.startsWith('rgba') ? parseFloat(gridColor.split(',').pop() || '1') : 1;
                    const hex = e.target.value;
                    const r = parseInt(hex.slice(1,3), 16);
                    const g = parseInt(hex.slice(3,5), 16);
                    const b = parseInt(hex.slice(5,7), 16);
                    setGridColor(`rgba(${r},${g},${b},${alpha})`);
                  }}
                  className="w-10 h-8 rounded cursor-pointer border border-dnd-accent bg-dnd-bg"
                />
                <input type="text" value={gridColor}
                  onChange={(e) => setGridColor(e.target.value)}
                  className="flex-1 bg-dnd-bg border border-dnd-accent rounded px-2 py-1.5 text-sm font-mono"
                  placeholder="rgba(255,255,255,0.15)"
                />
              </div>
            </div>

            {/* Grid Line Width */}
            <div>
              <label className="block text-xs text-dnd-muted mb-1">Grid Line Width (px)</label>
              <input type="range" min={1} max={5} value={gridLineWidth}
                onChange={(e) => setGridLineWidth(parseInt(e.target.value))}
                className="w-full accent-dnd-primary"
              />
              <div className="flex justify-between text-xs text-dnd-muted">
                <span>1</span><span>{gridLineWidth}px</span><span>5</span>
              </div>
            </div>

            <button onClick={applyGridSettings} className="w-full bg-dnd-primary text-white py-1.5 rounded text-sm font-semibold hover:opacity-90">Apply</button>

            {/* Delete Map */}
            <div className="pt-3 border-t border-dnd-accent/30">
              <button
                onClick={() => {
                  if (confirm(`Delete map "${map.name}"? This cannot be undone.`)) {
                    deleteMap(map.id);
                    setShowGridSettings(false);
                  }
                }}
                className="w-full bg-dnd-danger/20 text-dnd-danger/80 py-1.5 rounded text-sm font-semibold hover:bg-dnd-danger/30 transition-colors"
              >
                Delete Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
