import { useState, useEffect } from 'react';
import { spellApi } from '../../services/api';
import { SPELLS } from '../../data/spells';
import type { SpellData } from './SpellTooltip';
import SpellTooltip from './SpellTooltip';

interface SpellSelectorProps {
  character: { class: string; name: string; spells?: unknown };
  onSelect: (spell: SpellData) => void;
  onClose: () => void;
}

export default function SpellSelector({ character, onSelect, onClose }: SpellSelectorProps) {
  const [spells, setSpells] = useState<SpellData[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Get the character's class and prepared spells
  const charClass = character.class;
  const charSpells = character.spells ? (typeof character.spells === 'string' ? JSON.parse(character.spells) : character.spells) : {};
  const preparedSpells: string[] = charSpells._prepared || [];

  useEffect(() => {
    // Find spells matching the character's class from the local data
    // Use local SPELLS data for speed (no API call needed)
    const matched = SPELLS.filter(s => {
      if (!s.classes) return false;
      // Check if this spell belongs to the character's class
      const spellClasses = s.classes.split(/[,，]/).map((c: string) => c.trim());
      return spellClasses.some((c: string) => c === charClass || c.includes(charClass));
    });
    setSpells(matched);
    setLoading(false);
  }, [charClass]);

  const filteredSpells = filter
    ? spells.filter(s =>
        s.cn.toLowerCase().includes(filter.toLowerCase()) ||
        s.en.toLowerCase().includes(filter.toLowerCase())
      )
    : spells;

  const groupedByLevel: Record<number, SpellData[]> = {};
  for (const s of filteredSpells) {
    const lv = s.level ?? 0;
    if (!groupedByLevel[lv]) groupedByLevel[lv] = [];
    groupedByLevel[lv].push(s);
  }

  const levelLabels: Record<number, string> = {
    0: '戏法', 1: '1环', 2: '2环', 3: '3环', 4: '4环',
    5: '5环', 6: '6环', 7: '7环', 8: '8环', 9: '9环',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-dnd-surface rounded-xl p-4 w-[420px] max-h-[70vh] border border-dnd-accent shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">选择法术 — {character.name}</h3>
          <button onClick={onClose} className="text-dnd-muted hover:text-dnd-text">✕</button>
        </div>

        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="搜索法术..."
          className="w-full bg-dnd-bg border border-dnd-accent/50 rounded px-3 py-1.5 text-sm mb-3 focus:outline-none focus:border-dnd-primary"
          autoFocus
        />

        <div className="overflow-y-auto flex-1 space-y-3">
          {loading && <p className="text-center text-dnd-muted text-xs py-4">Loading...</p>}

          {!loading && Object.keys(groupedByLevel)
            .map(Number)
            .sort((a, b) => a - b)
            .map(level => (
              <div key={level}>
                <h4 className="text-xs font-semibold text-dnd-accent mb-1 sticky top-0 bg-dnd-surface py-1">
                  {levelLabels[level] || `${level}环`}
                </h4>
                <div className="space-y-0.5">
                  {groupedByLevel[level].map((s, i) => {
                    const isPrepared = preparedSpells.includes(s.cn) || preparedSpells.includes(s.en);
                    return (
                      <button
                        key={i}
                        onClick={() => onSelect(s)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center justify-between group ${
                          isPrepared
                            ? 'bg-dnd-primary/10 hover:bg-dnd-primary/20'
                            : 'hover:bg-dnd-accent/10'
                        }`}
                      >
                        <SpellTooltip spell={s}>
                          <span className={isPrepared ? 'text-dnd-text font-medium' : 'text-dnd-muted'}>
                            {s.cn}
                            {isPrepared && <span className="ml-2 text-[10px] text-dnd-primary">★ 已准备</span>}
                          </span>
                        </SpellTooltip>
                        <span className="text-[10px] text-dnd-muted shrink-0 ml-2">{s.school}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          {!loading && filteredSpells.length === 0 && (
            <p className="text-center text-dnd-muted text-xs py-4">无匹配法术</p>
          )}
        </div>
      </div>
    </div>
  );
}
