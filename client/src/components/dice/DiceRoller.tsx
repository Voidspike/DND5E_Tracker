import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface DiceRollerProps {
  socket: Socket;
  campaignId: string;
}

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

export default function DiceRoller({ socket, campaignId }: DiceRollerProps) {
  const { diceHistory } = useGameStore();
  const [selectedDice, setSelectedDice] = useState<string>('d20');
  const [modifier, setModifier] = useState(0);
  const [label, setLabel] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleRoll = () => {
    socket.emit('dice:roll', {
      campaignId,
      request: {
        diceType: selectedDice as any,
        modifier,
        isPrivate,
        label: label || undefined,
      },
    });
  };

  const diceFaces: Record<string, string> = {
    d4: '4', d6: '6', d8: '8', d10: '10', d12: '12', d20: '20', d100: '100',
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-bold text-lg mb-4">Dice Roller</h2>

      {/* Dice Selection */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DICE_TYPES.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDice(d)}
            className={`w-12 h-12 rounded-lg font-bold text-sm ${
              selectedDice === d
                ? 'bg-dnd-primary text-white'
                : 'bg-dnd-surface border border-dnd-accent text-dnd-text hover:border-dnd-primary'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Modifier & Label & Private */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-xs text-dnd-muted mb-1">Modifier</label>
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
            className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text"
          />
        </div>
        <div>
          <label className="block text-xs text-dnd-muted mb-1">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Strength Check"
            className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="accent-dnd-primary"
          />
          <span className="text-dnd-muted">Private (DM only)</span>
        </label>
      </div>

      {/* Roll Button */}
      <button
        onClick={handleRoll}
        className="w-full bg-dnd-primary text-white py-3 rounded font-bold text-lg hover:opacity-90 mb-6"
      >
        Roll {selectedDice}
        {modifier !== 0 && `${modifier > 0 ? '+' : ''}${modifier}`}
      </button>

      {/* History */}
      <div>
        <h3 className="text-sm font-semibold text-dnd-muted mb-2">History</h3>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {diceHistory.length === 0 ? (
            <p className="text-center text-dnd-muted text-sm py-4">No rolls yet</p>
          ) : (
            diceHistory.map((roll, i) => (
              <div
                key={roll.id || i}
                className="bg-dnd-bg rounded px-3 py-2 text-sm flex items-center justify-between"
              >
                <div>
                  <span className="font-bold">{roll.diceType}</span>
                  {roll.label && <span className="text-dnd-muted ml-1">({roll.label})</span>}
                </div>
                <div className="flex items-center gap-2">
                  {roll.modifier !== 0 && (
                    <span className="text-dnd-muted">
                      {roll.result - roll.modifier}{roll.modifier > 0 ? '+' : ''}{roll.modifier}
                    </span>
                  )}
                  <span className="font-bold text-lg text-dnd-primary">{roll.result}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
