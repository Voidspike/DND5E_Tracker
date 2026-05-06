import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface CombatTrackerProps {
  isDM: boolean;
  socket: Socket;
  campaignId: string;
}

export default function CombatTracker({ isDM, socket, campaignId }: CombatTrackerProps) {
  const { combatTracker } = useGameStore();
  const [tokenId, setTokenId] = useState('');
  const [initiative, setInitiative] = useState('');

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

  const handleAddParticipant = () => {
    if (combatTracker && tokenId && initiative) {
      socket.emit('combat:add', {
        combatId: combatTracker.id,
        tokenId,
        initiative: parseInt(initiative, 10),
      });
      setTokenId('');
      setInitiative('');
    }
  };

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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dnd-muted w-6">{index + 1}</span>
                    <span className="font-medium">{p.label || p.tokenId.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-dnd-accent">{p.initiative}</span>
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
                  onClick={handleNextTurn}
                  className="flex-1 bg-dnd-accent text-white py-2 rounded hover:opacity-90"
                >
                  Next Turn
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
                <input
                  type="text"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="Token ID"
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={initiative}
                  onChange={(e) => setInitiative(e.target.value)}
                  placeholder="Initiative"
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={handleAddParticipant}
                  className="w-full bg-dnd-accent text-white py-1 rounded text-sm hover:opacity-90"
                >
                  Add
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
