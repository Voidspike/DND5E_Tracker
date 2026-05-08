import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useCampaignStore } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';

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
  socket: Socket;
  selectedTokenId?: string | null;
}

export default function MapView({ map, tokens, isDM, socket, selectedTokenId }: MapViewProps) {
  const { createToken, updateToken, fetchTokens, updateMap, deleteMap } = useCampaignStore();
  const { fogData, setFogData } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const visionCanvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panDragging, setPanDragging] = useState(false);
  const [panDragStart, setPanDragStart] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [gridSize, setGridSize] = useState(map.gridSize || 50);
  const [gridOffsetX, setGridOffsetX] = useState(map.gridOffsetX || 0);
  const [gridOffsetY, setGridOffsetY] = useState(map.gridOffsetY || 0);
  const [gridColor, setGridColor] = useState(map.gridColor || 'rgba(255,255,255,0.15)');
  const [gridLineWidth, setGridLineWidth] = useState(map.gridLineWidth || 1);
  const [mapW, setMapW] = useState(map.width || 30);
  const [mapH, setMapH] = useState(map.height || 20);
  const [fogMode, setFogMode] = useState<'none' | 'paint' | 'erase'>('none');
  const [isPainting, setIsPainting] = useState(false);
  const [dragTokenId, setDragTokenId] = useState<string | null>(null);
  const [dragTokenOffset, setDragTokenOffset] = useState({ x: 0, y: 0 });
  const [dragTokenPos, setDragTokenPos] = useState({ x: 0, y: 0 });
  const [createTokenType, setCreateTokenType] = useState<string | null>(null);

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
  }, [scale, offset.x, offset.y, panDragging]);

  const getGridCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offset.x) / scale / gridPixels,
      y: (clientY - rect.top - offset.y) / scale / gridPixels,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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
    if (fogMode !== 'none' && isPainting) {
      paintFog(e);
      return;
    }
    if (dragTokenId) {
      const coords = getGridCoords(e.clientX, e.clientY);
      const newX = coords.x - dragTokenOffset.x;
      const newY = coords.y - dragTokenOffset.y;
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
    setPanDragging(false);
    if (dragTokenId) {
      socket.emit('token:move', { tokenId: dragTokenId, x: dragTokenPos.x, y: dragTokenPos.y });
      setDragTokenId(null);
    }
    if (fogMode !== 'none') {
      saveFogData();
    }
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
    if (fogMode !== 'none' || dragTokenId || !isDM || !containerRef.current) return;
    if (!createTokenType) return;
    const coords = getGridCoords(e.clientX, e.clientY);

    const typeDef = TOKEN_TYPES.find((t) => t.value === createTokenType);
    const tokenData = {
      mapId: map.id,
      type: createTokenType as any,
      name: typeDef?.label || 'New Token',
      x: coords.x,
      y: coords.y,
      color: typeDef?.color || '#e94560',
    };

    await createToken(tokenData);
    socket.emit('token:create', { campaignId: map.campaignId, token: tokenData });
    fetchTokens(map.id);
  };

  const handleTokenMouseDown = (e: React.MouseEvent, token: any) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const coords = getGridCoords(e.clientX, e.clientY);
    setDragTokenId(token.id);
    setDragTokenOffset({ x: coords.x - token.x, y: coords.y - token.y });
    socket.emit('token:select', token.id);
  };

  const handleHPChange = async (token: any, delta: number) => {
    const newHp = (token.hpCurrent || 0) + delta;
    await updateToken(token.id, { hpCurrent: Math.max(0, newHp) });
    socket.emit('token:update', {
      campaignId: map.campaignId,
      tokenId: token.id,
      updates: { hpCurrent: Math.max(0, newHp) },
    });
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
      onClick={handleMapClick}
      style={{ cursor: fogMode !== 'none' ? 'crosshair' : panDragging ? 'grabbing' : createTokenType ? 'crosshair' : 'grab' }}
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
        .filter((t) => t.mapId === map.id && (isDM || !t.isHidden))
        .map((token) => (
          <div key={token.id} className="absolute" style={{
            left: (dragTokenId === token.id ? dragTokenPos.x : token.x) * gridPixels * scale + offset.x,
            top: (dragTokenId === token.id ? dragTokenPos.y : token.y) * gridPixels * scale + offset.y,
            transform: 'translate(-50%, -50%)',
            zIndex: dragTokenId === token.id ? 50 : 10,
          }}>
            {/* Token Circle */}
            <div
              className={`flex items-center justify-center rounded-full border-2 transition-all hover:ring-2 hover:ring-dnd-primary ${
                dragTokenId === token.id ? 'opacity-80 scale-110' : ''
              }`}
              style={{
                width: token.width * gridPixels * scale,
                height: token.height * gridPixels * scale,
                backgroundColor: token.color + '40',
                borderColor: token.color,
                cursor: isDM ? 'grab' : 'pointer',
                minWidth: 24,
                minHeight: 24,
              }}
              onMouseDown={(e) => {
                if (!isDM) {
                  e.stopPropagation();
                  socket.emit('token:select', token.id);
                  return;
                }
                handleTokenMouseDown(e, token);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDM) socket.emit('token:select', token.id);
              }}
            >
              <span className="text-xs font-bold text-white drop-shadow-lg select-none" style={{ fontSize: `${Math.max(10, 14 * scale)}px` }}>
                {token.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* HP Bar below token (DM only) */}
            {isDM && token.hpMax && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/60 rounded px-1 py-0.5 whitespace-nowrap" style={{ opacity: dragTokenId === token.id ? 0 : 1 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleHPChange(token, -1); }}
                  className="text-dnd-danger text-xs leading-none hover:bg-red-900/40 rounded px-0.5"
                >
                  −
                </button>
                <div className="w-10 h-1.5 bg-gray-700 rounded overflow-hidden mx-0.5">
                  <div
                    className="h-full bg-dnd-success rounded transition-all"
                    style={{ width: `${Math.max(0, ((token.hpCurrent || 0) / token.hpMax) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-white font-medium">{token.hpCurrent ?? '?'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleHPChange(token, 1); }}
                  className="text-dnd-success text-xs leading-none hover:bg-green-900/40 rounded px-0.5"
                >
                  +
                </button>
              </div>
            )}

            {/* Hidden indicator */}
            {isDM && token.isHidden && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] bg-yellow-900/70 text-yellow-300 px-1 rounded" style={{ opacity: dragTokenId === token.id ? 0 : 1 }}>
                hidden
              </div>
            )}
          </div>
        ))}

      {/* Token Creation Toolbar (DM only) */}
      {isDM && (
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
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => setScale((s) => Math.min(3, s * 1.2))}
          className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.2, s / 1.2))}
          className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="bg-dnd-surface border border-dnd-accent text-white px-2 h-8 rounded text-xs hover:bg-dnd-accent"
        >
          Reset
        </button>
        {isDM && (
          <>
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
            <button
              onClick={resetAllFog}
              className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent flex items-center justify-center text-xs"
              title="Hide All"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </>
        )}
      </div>

      {/* Map name overlay */}
      <div className="absolute top-14 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
        {map.name}
      </div>

      {/* Fog mode indicator */}
      {fogMode !== 'none' && (
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
                className="w-full bg-red-900/40 text-red-300 py-1.5 rounded text-sm font-semibold hover:bg-red-900/60 transition-colors"
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
