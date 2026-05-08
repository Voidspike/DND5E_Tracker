import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useCampaignStore } from '../../stores/campaignStore';
import type { Character, CharacterStats } from '@dnd/shared';

interface CharacterSheetProps {
  character: Character;
  onClose: () => void;
}

const STAT_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const STAT_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};
const STAT_FULL: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const SKILL_LIST: { name: string; stat: keyof CharacterStats }[] = [
  { name: 'Acrobatics', stat: 'dex' },
  { name: 'Animal Handling', stat: 'wis' },
  { name: 'Arcana', stat: 'int' },
  { name: 'Athletics', stat: 'str' },
  { name: 'Deception', stat: 'cha' },
  { name: 'History', stat: 'int' },
  { name: 'Insight', stat: 'wis' },
  { name: 'Intimidation', stat: 'cha' },
  { name: 'Investigation', stat: 'int' },
  { name: 'Medicine', stat: 'wis' },
  { name: 'Nature', stat: 'int' },
  { name: 'Perception', stat: 'wis' },
  { name: 'Performance', stat: 'cha' },
  { name: 'Persuasion', stat: 'cha' },
  { name: 'Religion', stat: 'int' },
  { name: 'Sleight of Hand', stat: 'dex' },
  { name: 'Stealth', stat: 'dex' },
  { name: 'Survival', stat: 'wis' },
];

function getModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function getSkillMod(skillName: string, profs: string[] | null, stats: CharacterStats, profBonus: number): number {
  const skill = SKILL_LIST.find(s => s.name.toLowerCase() === skillName.toLowerCase());
  if (!skill) return 0;
  const baseMod = getModifier(stats[skill.stat]);
  return baseMod + (profs?.some(p => p.toLowerCase() === skillName.toLowerCase()) ? profBonus : 0);
}

type CharTab = 'info' | 'stats' | 'combat' | 'skills' | 'spells' | 'equip';

export default function CharacterSheet({ character, onClose }: CharacterSheetProps) {
  const { user } = useAuthStore();
  const { updateCharacter } = useCampaignStore();
  const [tab, setTab] = useState<CharTab>('info');
  const [editing, setEditing] = useState(false);

  const isOwner = character.userId === user?.id;
  const stats = character.stats as CharacterStats;
  const profBonus = character.proficiency || 2;
  const saveProfs: string[] = (character.statSaveProficiencies as any) || [];
  const skillProfs: string[] = (character.skillProficiencies as any) || [];
  const spellSlots: Record<string, { max: number; used: number }> = (character.spellSlots as any) || {};

  const tabs: { key: CharTab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'stats', label: 'Stats' },
    { key: 'combat', label: 'Combat' },
    { key: 'skills', label: 'Skills' },
    { key: 'spells', label: 'Spells' },
    { key: 'equip', label: 'Equip' },
  ];

  const update = async (data: Partial<Character>) => {
    await updateCharacter(character.id, data as any);
  };

  const toggleSaveProf = (stat: string) => {
    const list = saveProfs.includes(stat)
      ? saveProfs.filter(s => s !== stat)
      : [...saveProfs, stat];
    update({ statSaveProficiencies: list.length > 0 ? list : null } as any);
  };

  const toggleSkillProf = (skillName: string) => {
    const key = skillName.toLowerCase();
    const list = skillProfs.some(p => p.toLowerCase() === key)
      ? skillProfs.filter(p => p.toLowerCase() !== key)
      : [...skillProfs, skillName];
    update({ skillProficiencies: list.length > 0 ? list : null } as any);
  };

  const useSpellSlot = async (level: string) => {
    const slot = spellSlots[level];
    if (!slot) return;
    const updated = { ...spellSlots, [level]: { ...slot, used: Math.min(slot.max, slot.used + 1) } };
    await update({ spellSlots: updated } as any);
  };

  const resetSpellSlots = async () => {
    const reset: Record<string, { max: number; used: number }> = {};
    for (const [lvl, s] of Object.entries(spellSlots)) {
      reset[lvl] = { ...s, used: 0 };
    }
    await update({ spellSlots: reset } as any);
  };

  const spells = (character.spells as Record<string, string[]>) || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dnd-accent/50 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-lg">{character.name}</h2>
          <p className="text-xs text-dnd-muted">
            Lv{character.level} {character.race}{character.subrace ? ` (${character.subrace})` : ''} {character.class}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setEditing(!editing)}
              className={`px-3 py-1 rounded text-sm ${editing ? 'bg-dnd-primary text-white' : 'bg-dnd-accent text-white'} hover:opacity-90`}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          <button onClick={onClose} className="text-dnd-muted hover:text-dnd-text px-1.5 py-1">✕</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dnd-accent/30 shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'text-dnd-primary border-b-2 border-dnd-primary bg-dnd-primary/5' : 'text-dnd-muted hover:text-dnd-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ─── Info Tab ─── */}
        {tab === 'info' && (
          <div className="space-y-3">
            {editing ? (
              <EditableField label="Name" value={character.name} onChange={v => update({ name: v } as any)} />
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <StatBlock label="Class" value={character.class} />
              <StatBlock label="Level" value={String(character.level)} />
              <StatBlock label="Race" value={character.race} />
              <StatBlock label="Subrace" value={character.subrace || '-'} />
              <StatBlock label="Gender" value={character.gender || '-'} />
              <StatBlock label="Age" value={character.age ? String(character.age) : '-'} />
              <StatBlock label="Height" value={character.height || '-'} />
              <StatBlock label="Weight" value={character.weight || '-'} />
              <StatBlock label="Alignment" value={character.alignment || '-'} />
              <StatBlock label="Faith" value={character.faith || '-'} />
              <StatBlock label="XP" value={String(character.xp || 0)} />
              <StatBlock label="Proficiency" value={formatMod(profBonus)} />
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <EditField label="Subrace" value={character.subrace || ''} onChange={v => update({ subrace: v || null } as any)} />
                <EditField label="Gender" value={character.gender || ''} onChange={v => update({ gender: v || null } as any)} />
                <EditField label="Age" value={character.age ? String(character.age) : ''} type="number" onChange={v => update({ age: v ? parseInt(v) : null } as any)} />
                <EditField label="Height" value={character.height || ''} onChange={v => update({ height: v || null } as any)} />
                <EditField label="Weight" value={character.weight || ''} onChange={v => update({ weight: v || null } as any)} />
                <EditField label="Alignment" value={character.alignment || ''} onChange={v => update({ alignment: v || null } as any)} />
                <EditField label="Faith" value={character.faith || ''} onChange={v => update({ faith: v || null } as any)} />
                <EditField label="XP" value={String(character.xp || 0)} type="number" onChange={v => update({ xp: parseInt(v) || 0 } as any)} />
              </div>
            )}
            <div className="bg-dnd-bg rounded-lg p-3 mt-3">
              <h3 className="text-xs font-semibold text-dnd-muted mb-1">Languages</h3>
              <p className="text-sm">{character.languages || 'None'}</p>
            </div>
            <div className="bg-dnd-bg rounded-lg p-3">
              <h3 className="text-xs font-semibold text-dnd-muted mb-1">Tool Proficiencies</h3>
              <p className="text-sm">{character.toolProficiencies || 'None'}</p>
            </div>
            {editing && (
              <div className="grid grid-cols-1 gap-2">
                <EditField label="Languages" value={character.languages || ''} onChange={v => update({ languages: v || null } as any)} />
                <EditField label="Tool Proficiencies" value={character.toolProficiencies || ''} onChange={v => update({ toolProficiencies: v || null } as any)} />
                <EditField label="Resistances" value={character.resistances || ''} onChange={v => update({ resistances: v || null } as any)} />
                <EditField label="Immunities" value={character.immunities || ''} onChange={v => update({ immunities: v || null } as any)} />
              </div>
            )}
            {character.notes && (
              <div className="bg-dnd-bg rounded-lg p-3 mt-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-1">Notes</h3>
                <p className="text-sm whitespace-pre-wrap">{character.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Stats Tab ─── */}
        {tab === 'stats' && (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2">
              {STAT_NAMES.map(stat => (
                <div key={stat} className="text-center bg-dnd-bg rounded-lg p-3">
                  <span className="text-xs text-dnd-muted uppercase block mb-1">{STAT_LABELS[stat]}</span>
                  <span className="text-xl font-bold block">{stats[stat]}</span>
                  <span className="text-sm text-dnd-accent block">{formatMod(getModifier(stats[stat]))}</span>
                  {isOwner && editing && (
                    <button
                      onClick={() => toggleSaveProf(stat)}
                      className={`mt-1 text-[10px] px-1 py-0.5 rounded ${
                        saveProfs.includes(stat) ? 'bg-dnd-primary/30 text-dnd-primary' : 'text-dnd-muted border border-dnd-accent/30'
                      }`}
                    >
                      {saveProfs.includes(stat) ? 'Prof' : 'Non'}
                    </button>
                  )}
                  {!editing && saveProfs.includes(stat) && (
                    <span className="block text-[10px] text-dnd-primary mt-1">Proficient</span>
                  )}
                </div>
              ))}
            </div>
            {editing && (
              <div className="grid grid-cols-3 gap-2">
                {STAT_NAMES.map(stat => (
                  <EditField
                    key={stat}
                    label={STAT_FULL[stat]}
                    value={String(stats[stat])}
                    type="number"
                    onChange={v => {
                      const newStats = { ...stats, [stat]: parseInt(v) || 10 };
                      update({ stats: newStats } as any);
                    }}
                  />
                ))}
              </div>
            )}
            <div className="bg-dnd-bg rounded-lg p-3">
              <h3 className="text-xs font-semibold text-dnd-muted mb-2">Saving Throws</h3>
              <div className="grid grid-cols-3 gap-1 text-sm">
                {STAT_NAMES.map(stat => (
                  <div key={stat} className="flex justify-between">
                    <span className="text-dnd-muted">{STAT_LABELS[stat]}</span>
                    <span className="font-medium">{formatMod(getModifier(stats[stat]) + (saveProfs.includes(stat) ? profBonus : 0))}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-dnd-bg rounded-lg p-3">
              <h3 className="text-xs font-semibold text-dnd-muted mb-1">Passive Perception</h3>
              <p className="text-lg font-bold">{character.passivePerception || 10}</p>
            </div>
          </div>
        )}

        {/* ─── Combat Tab ─── */}
        {tab === 'combat' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <HpBar label="HP" current={character.hpCurrent} max={character.hpMax} temp={character.tempHp} />
              <StatBlock label="AC" value={String(character.ac)} highlight />
              <StatBlock label="Initiative" value={formatMod(character.initiative || 0)} />
              <StatBlock label="Speed" value={`${character.speed || 30} ft`} />
              <StatBlock label="Darkvision" value={`${character.darkvision || 0} ft`} />
              <StatBlock label="Hit Dice" value={character.hitDice || '-'} />
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-2">
                <EditField label="HP Current" value={String(character.hpCurrent)} type="number" onChange={v => update({ hpCurrent: parseInt(v) || 0 } as any)} />
                <EditField label="HP Max" value={String(character.hpMax)} type="number" onChange={v => update({ hpMax: parseInt(v) || 1 } as any)} />
                <EditField label="Temp HP" value={String(character.tempHp)} type="number" onChange={v => update({ tempHp: parseInt(v) || 0 } as any)} />
                <EditField label="AC" value={String(character.ac)} type="number" onChange={v => update({ ac: parseInt(v) || 10 } as any)} />
                <EditField label="Initiative" value={String(character.initiative || 0)} type="number" onChange={v => update({ initiative: parseInt(v) || 0 } as any)} />
                <EditField label="Speed (ft)" value={String(character.speed || 30)} type="number" onChange={v => update({ speed: parseInt(v) || 30 } as any)} />
                <EditField label="Darkvision (ft)" value={String(character.darkvision || 0)} type="number" onChange={v => update({ darkvision: parseInt(v) || 0 } as any)} />
                <EditField label="Hit Dice" value={character.hitDice || ''} onChange={v => update({ hitDice: v || null } as any)} />
              </div>
            )}
            {character.spellSaveDc && (
              <div className="bg-dnd-bg rounded-lg p-3 flex justify-between">
                <span className="text-dnd-muted text-sm">Spell DC</span>
                <span className="font-bold text-lg text-dnd-primary">{character.spellSaveDc}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-dnd-bg rounded-lg p-3">
                <span className="text-xs text-dnd-muted block">Resistances</span>
                <span className="text-sm">{character.resistances || 'None'}</span>
              </div>
              <div className="bg-dnd-bg rounded-lg p-3">
                <span className="text-xs text-dnd-muted block">Immunities</span>
                <span className="text-sm">{character.immunities || 'None'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Skills Tab ─── */}
        {tab === 'skills' && (
          <div className="space-y-1">
            {SKILL_LIST.map(skill => {
              const mod = getSkillMod(skill.name, skillProfs, stats, profBonus);
              const isProf = skillProfs.some(p => p.toLowerCase() === skill.name.toLowerCase());
              return (
                <div
                  key={skill.name}
                  className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                    isProf ? 'bg-dnd-primary/10 border border-dnd-primary/30' : 'bg-dnd-bg border border-dnd-accent/20 hover:border-dnd-accent/40'
                  }`}
                  onClick={() => { if (isOwner && editing) toggleSkillProf(skill.name); }}
                >
                  <div className="flex items-center gap-2">
                    {isProf && <span className="text-[10px] bg-dnd-primary/30 text-dnd-primary px-1 rounded">P</span>}
                    <span className="text-sm">{skill.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dnd-muted uppercase">{STAT_LABELS[skill.stat]}</span>
                    <span className="font-bold text-sm w-8 text-right">{formatMod(mod)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Spells Tab ─── */}
        {tab === 'spells' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <StatBlock label="Ability" value={character.spellcastingAbility || '-'} />
              <StatBlock label="Save DC" value={character.spellSaveDc ? String(character.spellSaveDc) : '-'} />
              <StatBlock label="Atk Bonus" value={character.spellAttackBonus ? formatMod(character.spellAttackBonus) : '-'} />
            </div>
            {/* Spell Slots */}
            {Object.keys(spellSlots).length > 0 && (
              <div className="bg-dnd-bg rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-dnd-muted">Spell Slots</h3>
                  {isOwner && (
                    <button onClick={resetSpellSlots} className="text-[10px] text-dnd-primary hover:underline">
                      Reset All
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(spellSlots).map(([lvl, slot]) => (
                    <div key={lvl} className="text-center bg-dnd-surface rounded p-2">
                      <span className="text-xs text-dnd-muted block">Lv{lvl}</span>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {Array.from({ length: slot.max }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full border cursor-pointer ${
                              i < slot.used
                                ? 'bg-dnd-primary border-dnd-primary'
                                : 'border-dnd-accent hover:border-dnd-primary'
                            }`}
                            onClick={() => {
                              if (!isOwner) return;
                              const updated = {
                                ...spellSlots,
                                [lvl]: { ...slot, used: i < slot.used ? i : i + 1 },
                              };
                              update({ spellSlots: updated } as any);
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-dnd-muted mt-1 block">
                        {slot.max - slot.used}/{slot.max}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Spell List */}
            {Object.entries(spells).length > 0 && (
              <div className="space-y-2">
                {Object.entries(spells).map(([level, list]) => (
                  <div key={level} className="bg-dnd-bg rounded-lg p-3">
                    <h3 className="text-xs font-semibold text-dnd-muted mb-2">{level}</h3>
                    <div className="flex flex-wrap gap-1">
                      {list.map((name: string, i: number) => (
                        <span key={i} className="text-xs bg-dnd-surface border border-dnd-accent/30 rounded px-2 py-1">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Equip Tab ─── */}
        {tab === 'equip' && (
          <div className="space-y-3">
            {/* Weapons */}
            {character.weapons && (character.weapons as any).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-dnd-muted">Weapons</h3>
                {(character.weapons as any[]).map((w: any, i: number) => (
                  <div key={i} className="bg-dnd-bg rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{w.name}</span>
                      <span className="text-xs text-dnd-accent">{w.atk}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-dnd-muted mt-1">
                      <span>DMG: {w.dmg}</span>
                      <span>{w.type}</span>
                    </div>
                    {w.properties && (
                      <p className="text-[10px] text-dnd-muted mt-1">{w.properties}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Currency */}
            {character.currency && (
              <div className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-2">Currency</h3>
                <div className="grid grid-cols-5 gap-1 text-center text-sm">
                  {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(c => (
                    <div key={c}>
                      <span className="text-[10px] text-dnd-muted uppercase block">{c}</span>
                      <span className="font-medium">{(character.currency as any)[c] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Equipment */}
            {character.equipment && (character.equipment as any).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-dnd-muted">Equipment</h3>
                {(character.equipment as any[]).map((e: any, i: number) => (
                  <div key={i} className="bg-dnd-bg rounded-lg p-3 flex justify-between text-sm">
                    <span>{e.name || e}</span>
                    {e.qty && <span className="text-dnd-muted">x{e.qty}</span>}
                  </div>
                ))}
              </div>
            )}
            {/* Inventory (legacy) */}
            {character.inventory && !character.equipment && Object.keys(character.inventory as any).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-dnd-muted">Inventory</h3>
                {Object.entries(character.inventory as Record<string, any>).map(([item, info]) => (
                  <div key={item} className="bg-dnd-bg rounded-lg p-3 flex justify-between text-sm">
                    <span className="capitalize">{item}</span>
                    <span className="text-dnd-muted text-xs">
                      {typeof info === 'object' ? `x${info.qty || 1}` : String(info)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function StatBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-dnd-primary/10 border border-dnd-primary/30' : 'bg-dnd-bg'}`}>
      <span className="block text-xs text-dnd-muted">{label}</span>
      <span className={`block text-lg font-bold ${highlight ? 'text-dnd-primary' : ''}`}>{value}</span>
    </div>
  );
}

function HpBar({ label, current, max, temp }: { label: string; current: number; max: number; temp: number }) {
  return (
    <div className="bg-dnd-bg rounded-lg p-3 col-span-2">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-dnd-muted">{label}</span>
        <span className="text-sm font-bold">
          {current}/{max}
          {temp > 0 && <span className="text-dnd-accent ml-1">(+{temp})</span>}
        </span>
      </div>
      <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-dnd-success rounded-full transition-all"
          style={{ width: `${Math.min(100, (current / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function EditField({ label, value, type = 'text', onChange }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-dnd-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
      />
    </div>
  );
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-dnd-muted mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
      />
    </div>
  );
}
