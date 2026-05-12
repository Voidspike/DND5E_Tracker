import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';
import { useCampaignStore } from '../../stores/campaignStore';
import { canEditToken } from '../../utils/token';
import SpellSelector from '../spell/SpellSelector';
import type { SpellData } from '../spell/SpellTooltip';

interface CombatTrackerProps {
  isDM: boolean;
  userId?: string;
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

export default function CombatTracker({ isDM, userId, socket, campaignId, tokens }: CombatTrackerProps) {
  const { combatTracker, combatLog, tokenMovementUsed, resetTokenMovement, setHighlightedTokenId, setCombatMode, combatTargetTokenId, setCombatTargetTokenId } = useGameStore();
  const { updateToken, updateCharacter, characters } = useCampaignStore();
  const [editingInitId, setEditingInitId] = useState<string | null>(null);
  const [editInitValue, setEditInitValue] = useState('');
  const [hpDeltas, setHpDeltas] = useState<Record<string, number>>({});
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showSpellSelector, setShowSpellSelector] = useState(false);

  const participants = combatTracker?.participants || [];
  const status = combatTracker?.status || 'setup';
  const isSetup = status === 'setup';
  const isActive = status === 'active';
  const isPaused = status === 'paused';

  const sortedParticipants = [...participants].sort((a: any, b: any) => b.initiative - a.initiative);

  const activeParticipant = participants.find((p: any) => p.isActiveTurn);
  const activeToken = activeParticipant ? tokens.find((t: any) => t.id === activeParticipant.tokenId) : null;
  const activeSpeed = activeToken?.speed || 30;
  const activeMovementUsed = activeToken ? (tokenMovementUsed[activeToken.id] || 0) : 0;

  // ── Combat lifecycle actions ──

  const handleStartRecording = () => {
    if (combatTracker) {
      socket.emit('combat:start_recording', combatTracker.id);
    }
  };

  const handleEndCombat = (save: boolean) => {
    if (combatTracker) {
      socket.emit('combat:end', { combatId: combatTracker.id, save });
      // If discard, clear local state
      if (!save) {
        setCombatMode(false);
      }
    }
    setShowEndDialog(false);
  };

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

  const handleInitiativeEdit = (participantId: string) => {
    const val = parseInt(editInitValue, 10);
    if (isNaN(val)) return;
    socket.emit('combat:initiative:update', { participantId, initiative: val });
    setEditingInitId(null);
    setEditInitValue('');
  };

  const handleNameSave = () => {
    if (combatTracker && editNameValue.trim()) {
      socket.emit('combat:update_name', { combatId: combatTracker.id, name: editNameValue.trim() });
    }
    setEditingName(false);
  };

  const handleAction = (actionKey: string) => {
    if (!combatTracker || !activeParticipant || !activeToken) return;

    // Spell action opens selector if character has spells
    if (actionKey === 'spell' && activeToken.characterId) {
      const char = characters.find((c: any) => c.id === activeToken.characterId);
      if (char) {
        setShowSpellSelector(true);
        return;
      }
    }

    emitAction(actionKey);
  };

  const emitAction = (actionKey: string, spellName?: string) => {
    if (!combatTracker || !activeParticipant || !activeToken) return;
    const hpDelta = hpDeltas[activeToken.id] || 0;
    const note = hpDelta !== 0 ? `HP ${hpDelta > 0 ? '+' : ''}${hpDelta}` : undefined;
    const actionLabel = spellName ? `✨ ${spellName}` : undefined;
    socket.emit('combat:action', {
      combatId: combatTracker.id,
      tokenId: activeToken.id,
      action: actionKey,
      value: hpDelta !== 0 ? hpDelta : undefined,
      note: actionLabel || note,
    });
    if (hpDelta !== 0) {
      const newHp = Math.max(0, (activeToken.hpCurrent || 0) + hpDelta);
      updateToken(activeToken.id, { hpCurrent: newHp }).catch(console.error);
      if (activeToken.characterId) {
        updateCharacter(activeToken.characterId, { hpCurrent: newHp } as any)
          .then((updated) => {
            if (updated) socket.emit('character:update', { characterId: activeToken.characterId, updates: { hpCurrent: newHp } });
          })
          .catch(console.error);
      }
      setHpDeltas(prev => ({ ...prev, [activeToken.id]: 0 }));
    }
  };

  const handleSpellSelect = (spell: SpellData) => {
    setShowSpellSelector(false);
    emitAction('spell', `${spell.cn} (${spell.level === 0 ? '戏法' : `${spell.level}环`})`);
  };

  const setHpDelta = (tokenId: string, val: number) => {
    setHpDeltas(prev => ({ ...prev, [tokenId]: val }));
  };

  if (!combatTracker) return null;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {/* Header with name and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {editingName && isDM ? (
            <input
              value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setEditingName(false); }}
              onBlur={handleNameSave}
              className="bg-dnd-bg border border-dnd-primary rounded px-2 py-1 text-sm font-bold min-w-0"
              autoFocus
            />
          ) : (
            <h2
              className={`font-bold text-sm truncate ${isDM ? 'cursor-pointer hover:text-dnd-primary' : ''}`}
              onClick={() => { if (isDM) { setEditingName(true); setEditNameValue(combatTracker.name || ''); } }}
              title={isDM ? 'Click to rename' : undefined}
            >
              ⚔ {combatTracker.name || 'Combat'}
            </h2>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
            isSetup ? 'bg-yellow-500/20 text-yellow-400' :
            isActive ? 'bg-green-500/20 text-green-400' :
            'bg-dnd-muted/20 text-dnd-muted'
          }`}>
            {isSetup ? '准备中' : isActive ? `R${combatTracker.round}` : '已暂停'}
          </span>
        </div>
        {isDM && isActive && (
          <button onClick={() => setShowEndDialog(true)} className="text-xs bg-dnd-danger/20 text-dnd-danger px-2 py-0.5 rounded hover:bg-dnd-danger/30">
            End
          </button>
        )}
      </div>

      {/* ── SETUP Phase ── */}
      {isSetup && (
        <div className="space-y-3">
          <p className="text-xs text-dnd-muted">
            所有地图上的棋子已自动导入。请调整先攻值，然后点击"开始记录"。
          </p>
          {isDM && (
            <button
              onClick={handleStartRecording}
              disabled={participants.length === 0}
              className="w-full bg-dnd-primary text-white py-2 rounded font-bold text-sm hover:opacity-90 disabled:opacity-40"
            >
              ▶ 开始记录
            </button>
          )}
          {!isDM && (
            <p className="text-xs text-center text-dnd-muted">等待DM开始记录...</p>
          )}
        </div>
      )}

      {/* ── ACTIVE Phase ── */}
      {isActive && (
        <>
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
              {canEditToken(activeToken, userId, isDM) && (
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

          {/* Previous/Next Turn Controls */}
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
        </>
      )}

      {/* ── PAUSED indicator ── */}
      {isPaused && (
        <p className="text-xs text-center text-dnd-muted py-2">战斗已暂停。关闭战斗模式将暂存数据。</p>
      )}

      {/* ── Initiative List (all phases) ── */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-dnd-muted">先攻顺序 ({participants.length})</h3>
        {sortedParticipants.map((p: any, index: number) => {
          const ptoken = tokens.find((t: any) => t.id === p.tokenId);
          const isTurnActive = p.isActiveTurn && isActive;
          const isTargeted = combatTargetTokenId === p.tokenId && !isTurnActive;
          return (
            <div
              key={p.id}
              onClick={() => {
                setHighlightedTokenId(p.tokenId);
                if (isDM && isActive) {
                  // Toggle target: clicking same target clears it, clicking active turn also clears
                  if (isTurnActive) {
                    setCombatTargetTokenId(null);
                  } else if (combatTargetTokenId === p.tokenId) {
                    setCombatTargetTokenId(null);
                  } else {
                    setCombatTargetTokenId(p.tokenId);
                  }
                }
              }}
              className={`flex items-center justify-between px-3 py-1.5 rounded text-sm cursor-pointer ${
                isTurnActive ? 'bg-dnd-primary/20 border border-dnd-primary' :
                isTargeted ? 'bg-orange-500/15 border border-orange-500/50' :
                'bg-dnd-bg border border-dnd-accent/20 hover:border-dnd-accent/50'
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
                {isDM && isSetup && (
                  <button
                    onClick={(e) => { e.stopPropagation(); socket.emit('combat:remove', { combatId: combatTracker.id, participantId: p.id }); }}
                    className="text-xs text-dnd-danger/60 hover:text-dnd-danger ml-1"
                  >✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Target Token Panel (DM only, active mode) ── */}
      {isDM && isActive && combatTargetTokenId && (() => {
        const targetToken = tokens.find((t: any) => t.id === combatTargetTokenId);
        const targetParticipant = participants.find((p: any) => p.tokenId === combatTargetTokenId);
        if (!targetToken) return null;
        return (
          <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-orange-300">
                🎯 {targetParticipant?.label || targetToken.name}
              </span>
              <button
                onClick={() => setCombatTargetTokenId(null)}
                className="text-dnd-muted hover:text-dnd-text text-xs"
              >✕</button>
            </div>
            {targetToken.hpMax && (
              <>
                <div className="flex items-center gap-2 text-xs text-dnd-muted">
                  <span>HP: {targetToken.hpCurrent ?? '?'}/{targetToken.hpMax}</span>
                  {targetToken.ac && <span>AC: {targetToken.ac}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newHp = Math.max(0, (targetToken.hpCurrent || 0) - 5);
                      updateToken(targetToken.id, { hpCurrent: newHp });
                      socket.emit('token:update', { campaignId, tokenId: targetToken.id, updates: { hpCurrent: newHp } });
                      if (targetToken.characterId) {
                        updateCharacter(targetToken.characterId, { hpCurrent: newHp } as any)
                          .then((u) => { if (u) socket.emit('character:update', { characterId: targetToken.characterId, updates: { hpCurrent: newHp } }); })
                          .catch(console.error);
                      }
                    }}
                    className="bg-dnd-danger/20 text-dnd-danger px-3 py-1 rounded text-xs hover:bg-dnd-danger/30"
                  >-5 HP</button>
                  <button
                    onClick={() => {
                      const newHp = Math.max(0, targetToken.hpCurrent || 0);
                      updateToken(targetToken.id, { hpCurrent: newHp });
                      // Fine-tune: click to edit directly
                      const input = prompt('HP:', String(targetToken.hpCurrent));
                      if (input !== null) {
                        const val = parseInt(input, 10);
                        if (!isNaN(val)) {
                          const finalHp = Math.max(0, val);
                          updateToken(targetToken.id, { hpCurrent: finalHp });
                          socket.emit('token:update', { campaignId, tokenId: targetToken.id, updates: { hpCurrent: finalHp } });
                          if (targetToken.characterId) {
                            updateCharacter(targetToken.characterId, { hpCurrent: finalHp } as any)
                              .then((u) => { if (u) socket.emit('character:update', { characterId: targetToken.characterId, updates: { hpCurrent: finalHp } }); })
                              .catch(console.error);
                          }
                        }
                      }
                    }}
                    className="bg-dnd-accent/20 text-dnd-accent px-3 py-1 rounded text-xs hover:bg-dnd-accent/30"
                  >编辑</button>
                  <button
                    onClick={() => {
                      const newHp = Math.min(targetToken.hpMax, (targetToken.hpCurrent || 0) + 5);
                      updateToken(targetToken.id, { hpCurrent: newHp });
                      socket.emit('token:update', { campaignId, tokenId: targetToken.id, updates: { hpCurrent: newHp } });
                      if (targetToken.characterId) {
                        updateCharacter(targetToken.characterId, { hpCurrent: newHp } as any)
                          .then((u) => { if (u) socket.emit('character:update', { characterId: targetToken.characterId, updates: { hpCurrent: newHp } }); })
                          .catch(console.error);
                      }
                    }}
                    className="bg-dnd-success/20 text-dnd-success px-3 py-1 rounded text-xs hover:bg-dnd-success/30"
                  >+5 HP</button>
                </div>
              </>
            )}
            <p className="text-[10px] text-dnd-muted">
              点击正在进行回合的棋子回到正常流程，或点击 Next 进入下个回合
            </p>
          </div>
        );
      })()}

      {/* ── Combat Log ── */}
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

      {/* ── Spell Selector ── */}
      {showSpellSelector && activeToken?.characterId && (
        <SpellSelector
          character={characters.find((c: any) => c.id === activeToken.characterId)}
          onSelect={handleSpellSelect}
          onClose={() => setShowSpellSelector(false)}
        />
      )}

      {/* ── End Combat Dialog ── */}
      {showEndDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowEndDialog(false)}>
          <div className="bg-dnd-surface rounded-xl p-6 w-80 border border-dnd-accent shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">结束战斗</h3>
            <p className="text-sm text-dnd-muted mb-4">
              是否保存此次战斗记录到地图历史？
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleEndCombat(true)}
                className="flex-1 bg-dnd-primary text-white py-2 rounded font-semibold hover:opacity-90"
              >
                保存记录
              </button>
              <button
                onClick={() => handleEndCombat(false)}
                className="flex-1 bg-dnd-danger/20 text-dnd-danger py-2 rounded font-semibold hover:bg-dnd-danger/30"
              >
                丢弃
              </button>
            </div>
            <button
              onClick={() => setShowEndDialog(false)}
              className="w-full mt-2 text-xs text-dnd-muted hover:text-dnd-text py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
