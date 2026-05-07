import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface CombatTrackerProps {
  isDM: boolean;
  socket: Socket;
  campaignId: string;
  tokens: any[];
}

export default function CombatTracker({ isDM, socket, campaignId, tokens }: CombatTrackerProps) {
  const { combatTracker } = useGameStore();
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [initiative, setInitiative] = useState('');
  const [label, setLabel] = useState('');
  const [editingInitId, setEditingInitId] = useState<string | null>(null);
  const [editInitValue, setEditInitValue] = useState('');

  const participants = combatTracker?.participants || [];

  const handleStartCombat = () => {
    socket.emit('combat:start', campaignId);
  };

  const handleEndCombat = () => {
    if (combatTracker) {
      socket.emit('combat:end', combatTracker.id);
    }
  };

  const handleNextTurn = () => {
    if (combatTracker) {
      socket.emit('combat:next_turn', combatTracker.id);
    }
  };

  const handlePrevTurn = () => {
    if (combatTracker) {
      socket.emit('combat:prev_turn', combatTracker.id);
    }
  };

  const handleAddParticipant = () => {
    if (combatTracker && selectedTokenId && initiative) {
      const initNum = parseInt(initiative, 10);
      if (isNaN(initNum)) return;
      const selectedToken = tokens.find((t) => t.id === selectedTokenId);
      socket.emit('combat:add', {
        combatId: combatTracker.id,
        tokenId: selectedTokenId,
        initiative: initNum,
        label: label || selectedToken?.name || undefined,
      });
      setSelectedTokenId('');
      setInitiative('');
      setLabel('');
    }
  };

  const handleInitiativeEdit = (participantId: string) => {
    const val = parseInt(editInitValue, 10);
    if (isNaN(val)) return;
    socket.emit('combat:initiative:update', {
      participantId,
      initiative: val,
    });
    setEditingInitId(null);
    setEditInitValue('');
  };

  // Filter tokens to show only those not already in combat
  const availableTokens = tokens.filter(
    (t) => !participants.some((p: any) => p.tokenId === t.id)
  );

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Combat Tracker</h2>
        {combatTracker && <span className="text-sm text-dnd-muted">Round {combatTracker.round}</span>}
      </div>

      {!combatTracker ? (
        <div className="text-center py-8">
          <p className="text-dnd-muted mb-4">No active combat</p>
          {isDM && (
            <button
              onClick={handleStartCombat}
              className="bg-dnd-primary text-white px-6 py-2 rounded font-semibold hover:opacity-90"
            >
              Start Combat
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Initiative List */}
          <div className="space-y-1 mb-4">
            {participants
              .sort((a: any, b: any) => b.initiative - a.initiative)
              .map((p: any, index: number) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded ${
                    p.isActiveTurn
                      ? 'bg-dnd-primary/20 border border-dnd-primary'
                      : 'bg-dnd-bg border border-dnd-accent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-dnd-muted w-6 shrink-0">{index + 1}</span>
                    <span className="font-medium truncate">{p.label || p.tokenId.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDM && editingInitId === p.id ? (
                      <input
                        type="number"
                        value={editInitValue}
                        onChange={(e) => setEditInitValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInitiativeEdit(p.id);
                          if (e.key === 'Escape') setEditingInitId(null);
                        }}
                        onBlur={() => handleInitiativeEdit(p.id)}
                        className="w-14 bg-dnd-surface border border-dnd-primary rounded px-1.5 py-0.5 text-sm text-center"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`text-sm font-bold ${isDM ? 'cursor-pointer hover:text-dnd-primary' : ''} text-dnd-accent`}
                        onClick={() => {
                          if (isDM) {
                            setEditingInitId(p.id);
                            setEditInitValue(p.initiative.toString());
                          }
                        }}
                        title={isDM ? 'Click to edit initiative' : undefined}
                      >
                        {p.initiative}
                      </span>
                    )}
                    {isDM && (
                      <button
                        onClick={() =>
                          socket.emit('combat:remove', {
                            combatId: combatTracker.id,
                            participantId: p.id,
                          })
                        }
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* DM Controls */}
          {isDM && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handlePrevTurn}
                  className="flex-1 bg-dnd-accent/60 text-white py-2 rounded hover:bg-dnd-accent/80"
                >
                  ← Prev
                </button>
                <button
                  onClick={handleNextTurn}
                  className="flex-1 bg-dnd-accent text-white py-2 rounded hover:opacity-90"
                >
                  Next Turn →
                </button>
                <button
                  onClick={handleEndCombat}
                  className="bg-red-900/40 text-red-300 px-3 py-2 rounded text-sm hover:bg-red-900/60"
                >
                  End
                </button>
              </div>

              <div className="bg-dnd-bg rounded p-3 space-y-2">
                <p className="text-xs text-dnd-muted font-semibold">Add Participant</p>
                <select
                  value={selectedTokenId}
                  onChange={(e) => setSelectedTokenId(e.target.value)}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                >
                  <option value="">Select a token...</option>
                  {availableTokens.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={initiative}
                    onChange={(e) => setInitiative(e.target.value)}
                    placeholder="Init."
                    className="w-20 bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddParticipant();
                    }}
                  />
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="flex-1 bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddParticipant();
                    }}
                  />
                </div>
                <button
                  onClick={handleAddParticipant}
                  disabled={!selectedTokenId || !initiative}
                  className="w-full bg-dnd-accent text-white py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50"
                >
                  Add to Combat
                </button>
              </div>
            </div>
          )}

          {!isDM && participants.length === 0 && (
            <p className="text-center text-dnd-muted text-sm">Waiting for DM to add participants...</p>
          )}
        </>
      )}
    </div>
  );
}
