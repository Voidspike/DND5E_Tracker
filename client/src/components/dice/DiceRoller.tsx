import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../stores/gameStore';

interface DiceRollerProps {
  socket: Socket;
  campaignId: string;
}

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

interface DiceCombo {
  diceType: string;
  count: number;
}

interface SavedPreset {
  name: string;
  combos: DiceCombo[];
  modifier: number;
}

const PRESETS_KEY = 'dnd-dice-presets';

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: SavedPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export default function DiceRoller({ socket, campaignId }: DiceRollerProps) {
  const { diceHistory } = useGameStore();
  const [selectedDice, setSelectedDice] = useState<string>('d20');
  const [combos, setCombos] = useState<DiceCombo[]>([{ diceType: 'd20', count: 1 }]);
  const [modifier, setModifier] = useState(0);
  const [label, setLabel] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [multiMode, setMultiMode] = useState(false);

  const diceFaces: Record<string, string> = {
    d4: '4', d6: '6', d8: '8', d10: '10', d12: '12', d20: '20', d100: '100',
  };

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const handleRoll = () => {
    const toRoll = multiMode ? combos : [{ diceType: selectedDice, count: 1 }];
    for (const combo of toRoll) {
      for (let i = 0; i < combo.count; i++) {
        socket.emit('dice:roll', {
          campaignId,
          request: {
            diceType: combo.diceType as any,
            modifier,
            isPrivate,
            label: label || undefined,
          },
        });
      }
    }
  };

  const addCombo = () => {
    setCombos([...combos, { diceType: 'd6', count: 1 }]);
  };

  const removeCombo = (index: number) => {
    if (combos.length <= 1) return;
    setCombos(combos.filter((_, i) => i !== index));
  };

  const updateCombo = (index: number, field: keyof DiceCombo, value: string | number) => {
    setCombos(combos.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    setPresets([
      ...presets,
      { name: presetName.trim(), combos: multiMode ? combos : [{ diceType: selectedDice, count: 1 }], modifier },
    ]);
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleDeletePreset = (index: number) => {
    setPresets(presets.filter((_, i) => i !== index));
  };

  const applyPreset = (preset: SavedPreset) => {
    if (preset.combos.length === 1 && preset.combos[0].count === 1) {
      setSelectedDice(preset.combos[0].diceType);
      setMultiMode(false);
    } else {
      setCombos(preset.combos);
      setMultiMode(true);
    }
    setModifier(preset.modifier);
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-bold text-lg mb-4">Dice Roller</h2>

      {/* Mode Toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setMultiMode(false)}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
            !multiMode ? 'bg-dnd-primary text-white' : 'bg-dnd-surface border border-dnd-accent text-dnd-muted'
          }`}
        >
          Single
        </button>
        <button
          onClick={() => setMultiMode(true)}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
            multiMode ? 'bg-dnd-primary text-white' : 'bg-dnd-surface border border-dnd-accent text-dnd-muted'
          }`}
        >
          Multi (e.g. 2d6)
        </button>
      </div>

      {/* Dice Selection */}
      {!multiMode ? (
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
      ) : (
        <div className="space-y-2 mb-4">
          {combos.map((combo, index) => (
            <div key={index} className="flex items-center gap-2 bg-dnd-bg rounded-lg p-2">
              <input
                type="number"
                min={1}
                max={20}
                value={combo.count}
                onChange={(e) => updateCombo(index, 'count', parseInt(e.target.value) || 1)}
                className="w-14 bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm text-center"
              />
              <select
                value={combo.diceType}
                onChange={(e) => updateCombo(index, 'diceType', e.target.value)}
                className="flex-1 bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
              >
                {DICE_TYPES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button
                onClick={() => removeCombo(index)}
                className="text-dnd-muted hover:text-red-400 px-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addCombo}
            className="w-full text-xs text-dnd-muted hover:text-dnd-text py-1 border border-dashed border-dnd-accent/30 rounded"
          >
            + Add Dice
          </button>
        </div>
      )}

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
        className="w-full bg-dnd-primary text-white py-3 rounded font-bold text-lg hover:opacity-90 mb-2"
      >
        Roll {!multiMode ? selectedDice : combos.map((c) => `${c.count}${c.diceType}`).join('+')}
        {modifier !== 0 && `${modifier > 0 ? '+' : ''}${modifier}`}
      </button>

      {/* Save Preset */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowSavePreset(!showSavePreset)}
          className="text-xs text-dnd-muted hover:text-dnd-text"
        >
          {showSavePreset ? 'Cancel' : 'Save as Preset'}
        </button>
      </div>
      {showSavePreset && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name..."
            className="flex-1 bg-dnd-bg border border-dnd-accent rounded px-2 py-1 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
          />
          <button
            onClick={handleSavePreset}
            disabled={!presetName.trim()}
            className="bg-dnd-primary text-white px-3 py-1 rounded text-xs hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {/* Presets */}
      {presets.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-dnd-muted mb-2">Saved Presets</h3>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset, i) => (
              <div key={i} className="flex items-center gap-1 bg-dnd-bg border border-dnd-accent/30 rounded px-2 py-1">
                <button
                  onClick={() => applyPreset(preset)}
                  className="text-xs text-dnd-text hover:text-dnd-primary"
                >
                  {preset.name}
                  <span className="text-dnd-muted ml-1">
                    ({preset.combos.map((c) => `${c.count}${c.diceType}`).join('+')}
                    {preset.modifier !== 0 ? `${preset.modifier > 0 ? '+' : ''}${preset.modifier}` : ''})
                  </span>
                </button>
                <button
                  onClick={() => handleDeletePreset(i)}
                  className="text-[10px] text-dnd-muted hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
