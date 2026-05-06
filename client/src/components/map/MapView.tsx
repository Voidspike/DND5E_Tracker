import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useCampaignStore } from '../../stores/campaignStore';

interface MapViewProps {
  map: any;
  tokens: any[];
  isDM: boolean;
  socket: Socket;
}

export default function MapView({ map, tokens, isDM, socket }: MapViewProps) {
  const { createToken, fetchTokens } = useCampaignStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const gridPixels = map.gridSize || 50;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(3, Math.max(0.2, s * delta)));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.shiftKey) {
      setDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setDragging(false);

  const handleMapClick = async (e: React.MouseEvent) => {
    if (!isDM || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale / gridPixels;
    const y = (e.clientY - rect.top - offset.y) / scale / gridPixels;

    const tokenData = {
      mapId: map.id,
      type: 'npc' as const,
      name: 'New Token',
      x,
      y,
      color: '#e94560',
    };

    await createToken(tokenData);
    socket.emit('token:create', { campaignId: map.campaignId, token: tokenData });
    fetchTokens(map.id);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-dnd-bg cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleMapClick}
    >
      {/* Map Image */}
      {map.imageUrl && (
        <img
          src={map.imageUrl}
          alt={map.name}
          className="absolute"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Grid */}
      <svg
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={gridPixels}
            height={gridPixels}
            patternUnits="userSpaceOnUse"
            x={map.gridOffsetX || 0}
            y={map.gridOffsetY || 0}
          >
            <path
              d={`M ${gridPixels} 0 L 0 0 0 ${gridPixels}`}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Tokens */}
      {tokens
        .filter((t) => isDM || !t.isHidden)
        .map((token) => (
          <div
            key={token.id}
            className="absolute flex items-center justify-center cursor-pointer rounded-full border-2 transition-all hover:ring-2 hover:ring-dnd-primary"
            style={{
              left: token.x * gridPixels * scale + offset.x,
              top: token.y * gridPixels * scale + offset.y,
              width: token.width * gridPixels * scale,
              height: token.height * gridPixels * scale,
              backgroundColor: token.color + '40',
              borderColor: token.color,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              socket.emit('token:select', token.id);
            }}
          >
            <span className="text-xs font-bold text-white drop-shadow-lg select-none" style={{ fontSize: `${Math.max(10, 14 * scale)}px` }}>
              {token.name.charAt(0).toUpperCase()}
            </span>
          </div>
        ))}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-1">
        <button
          onClick={() => setScale((s) => Math.min(3, s * 1.2))}
          className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.2, s / 1.2))}
          className="bg-dnd-surface border border-dnd-accent text-white w-8 h-8 rounded hover:bg-dnd-accent"
        >
          -
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="bg-dnd-surface border border-dnd-accent text-white px-2 h-8 rounded text-xs hover:bg-dnd-accent"
        >
          Reset
        </button>
      </div>

      {/* Map name overlay */}
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {map.name}
      </div>
    </div>
  );
}
