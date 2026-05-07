import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useCampaignStore } from '../../stores/campaignStore';

interface CharacterSheetProps {
  character: any;
  onClose: () => void;
}

function getModifier(stat: number): string {
  const mod = Math.floor((stat - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterSheet({ character, onClose }: CharacterSheetProps) {
  const { user } = useAuthStore();
  const { updateCharacter } = useCampaignStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: character.name,
    class: character.class,
    race: character.race,
    level: character.level,
    hpCurrent: character.hpCurrent,
    hpMax: character.hpMax,
    tempHp: character.tempHp,
    ac: character.ac,
    str: character.stats?.str || 10,
    dex: character.stats?.dex || 10,
    con: character.stats?.con || 10,
    int: character.stats?.int || 10,
    wis: character.stats?.wis || 10,
    cha: character.stats?.cha || 10,
    notes: character.notes || '',
  });

  const isOwner = character.userId === user?.id;
  const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

  const handleSave = async () => {
    await updateCharacter(character.id, {
      name: form.name,
      class: form.class,
      race: form.race,
      level: form.level,
      hpCurrent: form.hpCurrent,
      hpMax: form.hpMax,
      tempHp: form.tempHp,
      ac: form.ac,
      stats: {
        str: form.str,
        dex: form.dex,
        con: form.con,
        int: form.int,
        wis: form.wis,
        cha: form.cha,
      },
      notes: form.notes || null,
    });
    setEditing(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dnd-accent/50 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-lg">{character.name}</h2>
          <p className="text-xs text-dnd-muted">
            Level {character.level} {character.race} {character.class}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="bg-dnd-accent text-white px-3 py-1 rounded text-sm hover:opacity-90"
            >
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                className="bg-dnd-primary text-white px-3 py-1 rounded text-sm hover:opacity-90"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:opacity-90"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-dnd-muted hover:text-dnd-text px-1.5 py-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* HP / AC Bar */}
        <div className="bg-dnd-bg rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-dnd-muted text-sm">Hit Points</span>
            <span className="font-bold">
              {character.hpCurrent}/{character.hpMax}
              {character.tempHp > 0 && (
                <span className="text-dnd-accent ml-1">(+{character.tempHp})</span>
              )}
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-dnd-success rounded-full transition-all"
              style={{ width: `${Math.min(100, (character.hpCurrent / character.hpMax) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-dnd-muted text-sm">Armor Class</span>
            <span className="font-bold text-lg text-dnd-primary">{character.ac}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-dnd-bg rounded-lg p-4">
          <h3 className="text-sm font-semibold text-dnd-muted mb-3">Ability Scores</h3>
          <div className="grid grid-cols-6 gap-2">
            {stats.map((stat) => (
              <div key={stat} className="text-center">
                <span className="block text-xs text-dnd-muted uppercase">{stat}</span>
                <span className="block text-lg font-bold">
                  {editing && isOwner ? (
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form[stat]}
                      onChange={(e) =>
                        setForm({ ...form, [stat]: parseInt(e.target.value) || 1 })
                      }
                      className="w-full bg-dnd-surface border border-dnd-accent rounded px-1 py-0.5 text-sm text-center"
                    />
                  ) : (
                    character.stats?.[stat] ?? '-'
                  )}
                </span>
                <span className="text-xs text-dnd-accent">
                  {getModifier(character.stats?.[stat] || 10)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Form */}
        {editing && isOwner && (
          <div className="bg-dnd-bg rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-dnd-muted">Edit Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-dnd-muted mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">Class</label>
                <input
                  type="text"
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">Race</label>
                <input
                  type="text"
                  value={form.race}
                  onChange={(e) => setForm({ ...form, race: e.target.value })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">Level</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 1 })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">HP</label>
                <input
                  type="number"
                  value={form.hpCurrent}
                  onChange={(e) => setForm({ ...form, hpCurrent: parseInt(e.target.value) || 0 })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">Max HP</label>
                <input
                  type="number"
                  value={form.hpMax}
                  onChange={(e) => setForm({ ...form, hpMax: parseInt(e.target.value) || 1 })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">Temp HP</label>
                <input
                  type="number"
                  value={form.tempHp}
                  onChange={(e) => setForm({ ...form, tempHp: parseInt(e.target.value) || 0 })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dnd-muted mb-1">AC</label>
                <input
                  type="number"
                  value={form.ac}
                  onChange={(e) => setForm({ ...form, ac: parseInt(e.target.value) || 10 })}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Skills */}
        {character.skills && Object.keys(character.skills).length > 0 && (
          <div className="bg-dnd-bg rounded-lg p-4">
            <h3 className="text-sm font-semibold text-dnd-muted mb-2">Skills</h3>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(character.skills as Record<string, number>).map(([name, value]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span className="text-dnd-muted capitalize">{name}</span>
                  <span className="font-medium">
                    {value >= 0 ? '+' : ''}{value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spells */}
        {character.spells && Object.keys(character.spells).length > 0 && (
          <div className="bg-dnd-bg rounded-lg p-4">
            <h3 className="text-sm font-semibold text-dnd-muted mb-2">Spells</h3>
            <div className="space-y-1">
              {Object.entries(character.spells as Record<string, any>).map(([name, info]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span className="capitalize">{name}</span>
                  <span className="text-dnd-muted text-xs">
                    {info.level ? `Lv ${info.level}` : ''}
                    {info.slots ? ` (${info.used || 0}/${info.slots})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory */}
        {character.inventory && Object.keys(character.inventory).length > 0 && (
          <div className="bg-dnd-bg rounded-lg p-4">
            <h3 className="text-sm font-semibold text-dnd-muted mb-2">Inventory</h3>
            <div className="space-y-1">
              {Object.entries(character.inventory as Record<string, any>).map(([item, info]) => (
                <div key={item} className="flex justify-between text-sm">
                  <span className="capitalize">{item}</span>
                  <span className="text-dnd-muted text-xs">
                    {typeof info === 'object' ? `x${info.qty || 1}` : info}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-dnd-bg rounded-lg p-4">
          <h3 className="text-sm font-semibold text-dnd-muted mb-2">Notes</h3>
          {editing && isOwner ? (
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm resize-none h-24"
            />
          ) : (
            <p className="text-sm text-dnd-muted whitespace-pre-wrap">
              {character.notes || 'No notes.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
