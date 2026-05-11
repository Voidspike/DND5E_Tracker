import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';
import { useCampaignStore } from '../../stores/campaignStore';

interface CombatTrackerProps {
  isDM: boolean;
  socket: Socket;
  campaignId: string;
  tokens: any[];
}

const COMBAT_ACTIONS: { key: string; label: string; color: string }[] = [
  { key: 'melee', label: '⚔ 近战', color: 'bg-red-500/20 hover:bg-red-500/40 text-red-400' },
  { key: 'ranged', label: '🏹 远程', color: 'bg-orange-500/20 hover:bg-orange-500/40 text-orange-400' },
  { key: 'spell', label: '✨ 法术', color: 'bg-purple-500/20 hover:bg-purple-500/40 text-purple-400' },
  { key: 'dash', label: '💨 疾跑', color: 'bg-green-500/20 hover:bg-green-500/40 text-green-400' },
  { key: 'bonus', label: '⭐ 附赠', color: 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400' },
  { key: 'dodge', label: '🛡 闪避', color: 'bg-blue-500/20 hover:bg-blue-500/40 text-blue-400' },
  { key: 'disengage', label: '↗ 撤离', color: 'bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400' },
  { key: 'help', label: '🤝 协助', color: 'bg-pink-500/20 hover:bg-pink-500/40 text-pink-400' },
  { key: 'other', label: '⋯ 其他', color: 'bg-gray-500/20 hover:bg-gray-500/40 text-gray-400' },
];

export default function CombatTracker({ isDM, socket, campaignId, tokens }: CombatTrackerProps) {
  const { combatTracker, combatLog, tokenMovementUsed, resetTokenMovement } = useGameStore();
  const { updateToken, updateCharacter } = useCampaignStore();
  const [editingInitId, setEditingInitId] = useState<string | null>(null);
  const [editInitValue, setEditInitValue] = useState('');
  const [hpDeltas, setHpDeltas] = useState<Record<string, number>>({});

  const participants = combatTracker?.participants || [];

  const sortedParticipants = [...participants].sort((a: any, b: any) => b.initiative - a.initiative);

  const activeParticipant = participants.find((p: any) => p.isActiveTurn);
  const activeToken = activeParticipant ? tokens.find((t: any) => t.id === activeParticipant.tokenId) : null;
  const activeSpeed = activeToken?.speed || 30;
  const activeMovementUsed = activeToken ? (tokenMovementUsed[activeToken.id] || 0) : 0;

  const handleNextTurn = () => {
    if (combatTracker) {
      resetTokenMovement();
      socket.emit('combat:next_turn', combatTracker.id);
    }
  };

  const handlePrevTurn = () => {
    if (combatTracker) {
      resetTokenMovement();
      socket.emit('combat:prev_turn', combatTracker.id);
    }
  };

  const handleEndCombat = () => {
    if (combatTracker) {
      socket.emit('combat:end', combatTracker.id);
    }
  };

  const handleInitiativeEdit = (participantId: string) => {
    const val = parseInt(editInitValue, 10);
    if (isNaN(val)) return;
    socket.emit('combat:initiative:update', { participantId, initiative: val });
    setEditingInitId(null);
    setEditInitValue('');
  };

  const handleAction = (actionKey: string) => {
    if (!combatTracker || !activeParticipant || !activeToken) return;
    const hpDelta = hpDeltas[activeToken.id] || 0;
    const note = hpDelta !== 0 ? `HP ${hpDelta > 0 ? '+' : ''}${hpDelta}` : undefined;
    socket.emit('combat:action', {
      combatId: combatTracker.id,
      tokenId: activeToken.id,
      action: actionKey,
      value: hpDelta !== 0 ? hpDelta : undefined,
      note,
    });
    // Apply HP change to token and linked character
    if (hpDelta !== 0) {
      const newHp = Math.max(0, (activeToken.hpCurrent || 0) + hpDelta);
      updateToken(activeToken.id, { hpCurrent: newHp }).catch(console.error);
      if (activeToken.characterId) {
        updateCharacter(activeToken.characterId, { hpCurrent: newHp } as any).catch(console.error);
      }
      setHpDeltas(prev => ({ ...prev, [activeToken.id]: 0 }));
    }
  };

  const setHpDelta = (tokenId: string, val: number) => {
    setHpDeltas(prev => ({ ...prev, [tokenId]: val }));
  };

  if (!combatTracker) return null;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">⚔ Combat</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dnd-muted">R{combatTracker.round}</span>
          {isDM && (
            <button onClick={handleEndCombat} className="text-xs bg-dnd-danger/20 text-dnd-danger px-2 py-0.5 rounded hover:bg-dnd-danger/30">
              End
            </button>
          )}
        </div>
      </div>

      {/* Active Turn Info */}
      {activeParticipant && activeToken && (
        <div className="bg-dnd-primary/10 border border-dnd-primary/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">{activeParticipant.label || activeToken.name}</span>
            <span className="text-xs text-dnd-accent">先攻 {activeParticipant.initiative}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-dnd-muted">
            <span>速度: {activeSpeed}ft</span>
            <span>移动: {activeMovementUsed.toFixed(1)}/{activeSpeed}ft</span>
          </div>
          {/* HP delta input */}
          {isDM && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-dnd-muted">HP:</span>
              <input
                type="number"
                value={hpDeltas[activeToken.id] || 0}
                onChange={e => setHpDelta(activeToken.id, parseInt(e.target.value) || 0)}
                className="w-16 bg-dnd-surface border border-dnd-accent rounded px-1.5 py-0.5 text-xs text-center"
              />
              {activeToken.hpMax && (
                <span className="text-xs text-dnd-muted">
                  → {Math.max(0, (activeToken.hpCurrent || 0) + (hpDeltas[activeToken.id] || 0))}/{activeToken.hpMax}
                </span>
              )}
            </div>
          )}
          {/* Action buttons */}
          <div className="flex flex-wrap gap-1">
            {COMBAT_ACTIONS.map(a => (
              <button
                key={a.key}
                onClick={() => handleAction(a.key)}
                className={`text-xs px-2 py-1 rounded transition-all ${a.color}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Previous Turn Controls */}
      {isDM && (
        <div className="flex gap-1">
          <button onClick={handlePrevTurn} className="flex-1 bg-dnd-accent/60 text-white py-1.5 rounded text-xs hover:bg-dnd-accent/80">
            ← Prev
          </button>
          <button onClick={handleNextTurn} className="flex-1 bg-dnd-accent text-white py-1.5 rounded text-xs hover:opacity-90">
            Next Turn →
          </button>
        </div>
      )}

      {/* Initiative List */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-dnd-muted">先攻顺序</h3>
        {sortedParticipants.map((p: any, index: number) => {
          const ptoken = tokens.find((t: any) => t.id === p.tokenId);
          const isActive = p.isActiveTurn;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded text-sm ${
                isActive ? 'bg-dnd-primary/20 border border-dnd-primary' : 'bg-dnd-bg border border-dnd-accent/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-dnd-muted w-5 shrink-0">{index + 1}</span>
                <span className="font-medium truncate">{p.label || ptoken?.name || p.tokenId.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isDM && editingInitId === p.id ? (
                  <input
                    type="number"
                    value={editInitValue}
                    onChange={e => setEditInitValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleInitiativeEdit(p.id); if (e.key === 'Escape') setEditingInitId(null); }}
                    onBlur={() => handleInitiativeEdit(p.id)}
                    className="w-12 bg-dnd-surface border border-dnd-primary rounded px-1 py-0.5 text-xs text-center"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`text-xs font-bold ${isDM ? 'cursor-pointer hover:text-dnd-primary' : ''} text-dnd-accent`}
                    onClick={() => { if (isDM) { setEditingInitId(p.id); setEditInitValue(p.initiative.toString()); } }}
                    title={isDM ? 'Click to edit' : undefined}
                  >
                    {p.initiative}
                  </span>
                )}
                {isDM && (
                  <button
                    onClick={() => socket.emit('combat:remove', { combatId: combatTracker.id, participantId: p.id })}
                    className="text-xs text-dnd-danger/60 hover:text-dnd-danger ml-1"
                  >✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Combat Log */}
      <div>
        <h3 className="text-xs font-semibold text-dnd-muted mb-2">战斗日志</h3>
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {combatLog.length === 0 ? (
            <p className="text-center text-dnd-muted text-xs py-2">暂无事件</p>
          ) : (
            combatLog.map((entry: any, i: number) => (
              <div key={i} className="text-xs flex items-start gap-2 py-0.5">
                <span className="text-dnd-muted shrink-0 font-mono">R{entry.round}</span>
                <span className={entry.type === 'action' ? 'text-dnd-accent' : 'text-dnd-text'}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
