import { useState, useRef, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { useAuthStore } from '../../stores/authStore';
import { useCampaignStore } from '../../stores/campaignStore';
import type { Character, CharacterStats } from '@dnd/shared';
import { SPELLS } from '../../data/spells';

function safeArray<T>(v: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') try { const p = JSON.parse(v); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
  return fallback;
}

function safeObj<T>(v: unknown, fallback: T): T {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  if (typeof v === 'string') try { return JSON.parse(v) as T; } catch { return fallback; }
  return fallback;
}

interface CharacterSheetProps {
  character: Character;
  onClose: () => void;
  socket?: Socket;
  campaignId?: string;
}

const STAT_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const STAT_LABELS: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const STAT_FULL: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

const CLASS_OPTIONS = [
  { value: 'Barbarian', label: '野蛮人', subclasses: ['狂战士', '图腾武者', '狂热者', '先祖守卫', '风暴先驱', '战狂'] },
  { value: 'Bard', label: '吟游诗人', subclasses: ['逸闻诗人', '勇气诗人', '迷惑诗人', '剑舞诗人', '低语诗人'] },
  { value: 'Cleric', label: '牧师', subclasses: ['知识牧师', '生命牧师', '光明牧师', '自然牧师', '风暴牧师', '诡术牧师', '战争牧师', '锻造牧师', '坟墓牧师', '奥秘领域', '秩序领域'] },
  { value: 'Druid', label: '德鲁伊', subclasses: ['大地德鲁伊', '荒月德鲁伊', '梦境德鲁伊', '牧人德鲁伊', '真菌德鲁伊'] },
  { value: 'Fighter', label: '战士', subclasses: ['勇士', '战斗大师', '奥法骑士', '魔射手', '骑兵', '武士', '紫龙骑士', '回音骑士'] },
  { value: 'Monk', label: '武僧', subclasses: ['散打宗', '暗影宗', '四象宗', '醉拳宗', '剑圣宗', '日魂宗', '永亡宗'] },
  { value: 'Paladin', label: '圣武士', subclasses: ['奉献圣武士', '古贤圣武士', '复仇圣武士', '征服圣武士', '救赎圣武士', '王冠圣武士'] },
  { value: 'Ranger', label: '游侠', subclasses: ['猎人', '驯兽师', '地平行者', '屠龙者', '幽域追踪者'] },
  { value: 'Rogue', label: '游荡者', subclasses: ['刺客', '盗贼', '诡术师', '审判官', '斥候', '策士'] },
  { value: 'Sorcerer', label: '术士', subclasses: ['狂野术士', '龙族血脉', '风暴术士', '神圣灵魂', '幽影术士'] },
  { value: 'Warlock', label: '邪术师', subclasses: ['魔能刃契', '旧日支配者', '恶魔契约', '妖精契约', '天界契约'] },
  { value: 'Wizard', label: '法师', subclasses: ['防护法师', '预言法师', '塑能法师', '幻术法师', '附魔法师', '死灵法师', '变化法师', '咒法法师'] },
];

const RACE_OPTIONS: { value: string; label: string; subraces: string[] }[] = [
  { value: 'Human', label: '人类', subraces: ['标准人类', '人类变体'] },
  { value: 'Elf', label: '精灵', subraces: ['高等精灵', '木精灵', '黑暗精灵', '卓尔精灵', '太阳精灵', '黄昏精灵', '月精灵', '水生精灵', '海精灵', '影灵', '雅灵'] },
  { value: 'Dwarf', label: '矮人', subraces: ['丘陵矮人', '山地矮人', '灰矮人'] },
  { value: 'Halfling', label: '半身人', subraces: ['轻足半身人', '强心半身', '鬼智半身人'] },
  { value: 'Gnome', label: '侏儒', subraces: ['地底侏儒', '森林侏儒', '岩侏儒'] },
  { value: 'Dragonborn', label: '龙裔', subraces: ['黑龙', '蓝龙', '黄铜龙', '青铜龙', '赤铜龙', '金龙', '绿龙', '红龙', '银龙', '白龙'] },
  { value: 'Tiefling', label: '提夫林', subraces: [] },
  { value: 'Half-Elf', label: '半精灵', subraces: [] },
  { value: 'Half-Orc', label: '半兽人', subraces: [] },
  { value: 'Aasimar', label: '阿斯莫', subraces: ['守护阿斯莫', '天罚阿斯莫', '堕落阿斯莫'] },
  { value: 'Goliath', label: '歌利亚', subraces: [] },
  { value: 'Tabaxi', label: '虎人', subraces: [] },
  { value: 'Firbolg', label: '菲尔伯格', subraces: [] },
  { value: 'Kenku', label: '鸦人', subraces: [] },
  { value: 'Lizardfolk', label: '蜥蜴人', subraces: [] },
  { value: 'Tortle', label: '龟人', subraces: [] },
  { value: 'Genasi', label: '元素裔', subraces: ['气元素裔', '土元素裔', '火元素裔', '水元素裔'] },
  { value: 'Changeling', label: '幻形怪', subraces: [] },
  { value: 'Warforged', label: '机关人', subraces: [] },
  { value: 'Aarakocra', label: '鹰人', subraces: [] },
];

const ALIGNMENT_OPTIONS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
];

const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'];

const SKILL_LIST: { name: string; stat: keyof CharacterStats; cn: string }[] = [
  { name: 'Acrobatics', stat: 'dex', cn: '特技' },
  { name: 'Animal Handling', stat: 'wis', cn: '驯养' },
  { name: 'Arcana', stat: 'int', cn: '奥秘' },
  { name: 'Athletics', stat: 'str', cn: '运动' },
  { name: 'Deception', stat: 'cha', cn: '欺诈' },
  { name: 'History', stat: 'int', cn: '历史' },
  { name: 'Insight', stat: 'wis', cn: '洞悉' },
  { name: 'Intimidation', stat: 'cha', cn: '威吓' },
  { name: 'Investigation', stat: 'int', cn: '调查' },
  { name: 'Medicine', stat: 'wis', cn: '医疗' },
  { name: 'Nature', stat: 'int', cn: '自然' },
  { name: 'Perception', stat: 'wis', cn: '察觉' },
  { name: 'Performance', stat: 'cha', cn: '表演' },
  { name: 'Persuasion', stat: 'cha', cn: '说服' },
  { name: 'Religion', stat: 'int', cn: '宗教' },
  { name: 'Sleight of Hand', stat: 'dex', cn: '巧手' },
  { name: 'Stealth', stat: 'dex', cn: '隐匿' },
  { name: 'Survival', stat: 'wis', cn: '生存' },
];

function getModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

type CharTab = 'info' | 'stats' | 'combat' | 'skills' | 'spells' | 'equip';

export default function CharacterSheet({ character, onClose, socket, campaignId }: CharacterSheetProps) {
  const { user } = useAuthStore();
  const { updateCharacter } = useCampaignStore();
  const [tab, setTab] = useState<CharTab>('info');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = character.userId === user?.id;
  const stats = safeObj<CharacterStats>(character.stats, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const profBonus = character.proficiency || 2;
  const saveProfs = safeArray<string>(character.statSaveProficiencies);
  const skillProfs = safeArray<string>(character.skillProficiencies);
  const spellSlots = safeObj<Record<string, { max: number; used: number }>>(character.spellSlots, {});
  const spells = safeObj<Record<string, string[]>>(character.spells, {});
  const spellcastingMod = character.spellcastingAbility
    ? getModifier(stats[character.spellcastingAbility.toLowerCase() as keyof CharacterStats] || 0)
    : 0;

  const computedSpellDc = 8 + profBonus + spellcastingMod;
  const computedSpellAtk = profBonus + spellcastingMod;
  const computedInitiative = getModifier(stats.dex);

  const tabs: { key: CharTab; label: string }[] = [
    { key: 'info', label: '信息' },
    { key: 'stats', label: '属性' },
    { key: 'combat', label: '战斗' },
    { key: 'skills', label: '技能' },
    { key: 'spells', label: '法术' },
    { key: 'equip', label: '装备' },
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        await update({ imageUrl: data.url } as any);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  const rollQuickDice = (modifier: number, label: string) => {
    if (!socket || !campaignId) return;
    socket.emit('dice:roll', {
      campaignId,
      request: { diceType: 'd20', modifier, isPrivate: false, label },
    });
  };

  // Derived values
  const currentClass = CLASS_OPTIONS.find(c => c.value === character.class);
  const currentRace = RACE_OPTIONS.find(r => r.value === character.race);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Portrait */}
      <div className="p-4 border-b border-dnd-accent/50 flex items-center gap-4 shrink-0">
        {/* Portrait */}
        <div className="relative shrink-0">
          {character.imageUrl ? (
            <img src={character.imageUrl} alt={character.name} className="w-16 h-16 rounded-lg object-cover border-2 border-dnd-accent" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-dnd-bg border-2 border-dnd-accent/30 flex items-center justify-center text-2xl text-dnd-muted">
              {character.name.charAt(0).toUpperCase()}
            </div>
          )}
          {isOwner && editing && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg text-white text-xs opacity-0 hover:opacity-100 transition-opacity"
            >
              {uploading ? '...' : '上传'}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">{character.name}</h2>
          <p className="text-xs text-dnd-muted">
            Lv{character.level} {currentRace?.label || character.race}{character.subrace ? ` (${character.subrace})` : ''} {currentClass?.label || character.class}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-dnd-primary/20 text-dnd-primary px-2 py-0.5 rounded">熟练 +{profBonus}</span>
            <span className="text-xs bg-dnd-accent/20 text-dnd-accent px-2 py-0.5 rounded">XP {character.xp || 0}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <button
              onClick={() => setEditing(!editing)}
              className={`px-3 py-1 rounded text-sm ${editing ? 'bg-dnd-primary text-white' : 'bg-dnd-accent text-white'} hover:opacity-90`}
            >
              {editing ? '完成' : '编辑'}
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
              <div className="grid grid-cols-2 gap-2">
                <EditField label="角色名" value={character.name} onChange={v => update({ name: v } as any)} />
                <div>
                  <label className="block text-xs text-dnd-muted mb-1">职业</label>
                  <select
                    value={character.class}
                    onChange={e => update({ class: e.target.value } as any)}
                    className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                  >
                    {CLASS_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label} ({c.value})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-dnd-muted mb-1">等级</label>
                  <input
                    type="number" min={1} max={20}
                    value={character.level}
                    onChange={e => update({ level: parseInt(e.target.value) || 1 } as any)}
                    className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-dnd-muted mb-1">种族</label>
                  <select
                    value={character.race}
                    onChange={e => update({ race: e.target.value } as any)}
                    className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                  >
                    {RACE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label} ({r.value})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-dnd-muted mb-1">亚种</label>
                  <select
                    value={character.subrace || ''}
                    onChange={e => update({ subrace: e.target.value || null } as any)}
                    className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">无</option>
                    {currentRace?.subraces.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-dnd-muted mb-1">性别</label>
                  <select
                    value={character.gender || ''}
                    onChange={e => update({ gender: e.target.value || null } as any)}
                    className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">未设置</option>
                    <option value="Male">男</option>
                    <option value="Female">女</option>
                    <option value="Other">其他</option>
                    <option value="未知">未知</option>
                  </select>
                </div>
                <EditField label="年龄" value={character.age ? String(character.age) : ''} type="number" onChange={v => update({ age: v ? parseInt(v) : null } as any)} />
                <EditField label="身高" value={character.height || ''} onChange={v => update({ height: v || null } as any)} />
                <EditField label="体重" value={character.weight || ''} onChange={v => update({ weight: v || null } as any)} />
                <div>
                  <label className="block text-xs text-dnd-muted mb-1">阵营</label>
                  <select
                    value={character.alignment || ''}
                    onChange={e => update({ alignment: e.target.value || null } as any)}
                    className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">未设置</option>
                    {ALIGNMENT_OPTIONS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <EditField label="信仰" value={character.faith || ''} onChange={v => update({ faith: v || null } as any)} />
                <EditField label="XP" value={String(character.xp || 0)} type="number" onChange={v => update({ xp: parseInt(v) || 0 } as any)} />
                <EditField label="熟练加值" value={String(profBonus)} type="number" onChange={v => update({ proficiency: parseInt(v) || 2 } as any)} />
                <EditField label="语言" value={character.languages || ''} onChange={v => update({ languages: v || null } as any)} />
                <EditField label="工具熟练" value={character.toolProficiencies || ''} onChange={v => update({ toolProficiencies: v || null } as any)} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <StatBlock label="职业" value={currentClass?.label || character.class} />
                <StatBlock label="等级" value={String(character.level)} />
                <StatBlock label="种族" value={currentRace?.label || character.race} />
                <StatBlock label="亚种" value={character.subrace || '-'} />
                <StatBlock label="性别" value={character.gender || '-'} />
                <StatBlock label="年龄" value={character.age ? String(character.age) : '-'} />
                <StatBlock label="身高" value={character.height || '-'} />
                <StatBlock label="体重" value={character.weight || '-'} />
                <StatBlock label="阵营" value={character.alignment || '-'} />
                <StatBlock label="信仰" value={character.faith || '-'} />
                <StatBlock label="XP" value={String(character.xp || 0)} />
                <StatBlock label="熟练加值" value={formatMod(profBonus)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-1">语言</h3>
                <p className="text-sm">{character.languages || '无'}</p>
              </div>
              <div className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-1">工具熟练</h3>
                <p className="text-sm">{character.toolProficiencies || '无'}</p>
              </div>
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-2">
                <EditField label="抗性" value={character.resistances || ''} onChange={v => update({ resistances: v || null } as any)} />
                <EditField label="免疫" value={character.immunities || ''} onChange={v => update({ immunities: v || null } as any)} />
              </div>
            )}
            {character.notes && (
              <div className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-1">笔记</h3>
                <p className="text-sm whitespace-pre-wrap">{character.notes}</p>
              </div>
            )}
            {editing && (
              <div className="grid grid-cols-1 gap-2">
                <EditField label="笔记" value={character.notes || ''} onChange={v => update({ notes: v || null } as any)} />
              </div>
            )}
          </div>
        )}

        {/* ─── Stats Tab ─── */}
        {tab === 'stats' && (
          <div className="space-y-3">
            {/* Ability Score Grid */}
            <div className="grid grid-cols-6 gap-2">
              {STAT_NAMES.map(stat => {
                const mod = getModifier(stats[stat]);
                const saveMod = mod + (saveProfs.includes(stat) ? profBonus : 0);
                return (
                  <div key={stat} className="text-center bg-dnd-bg rounded-lg p-3 relative group">
                    <span className="text-xs text-dnd-muted uppercase block mb-1">{STAT_LABELS[stat]}</span>
                    <span className="text-xl font-bold block">{stats[stat]}</span>
                    <span className="text-sm text-dnd-accent block">{formatMod(mod)}</span>
                    {socket && (
                      <button
                        onClick={(e) => { e.stopPropagation(); rollQuickDice(mod, `${STAT_FULL[stat]}检定`); }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-dnd-primary/20 hover:bg-dnd-primary/40 text-dnd-primary px-1 py-0.5 rounded"
                      >
                        d20
                      </button>
                    )}
                    {isOwner && editing && (
                      <button
                        onClick={() => toggleSaveProf(stat)}
                        className={`mt-1 text-[10px] px-1 py-0.5 rounded ${
                          saveProfs.includes(stat) ? 'bg-dnd-primary/30 text-dnd-primary' : 'text-dnd-muted border border-dnd-accent/30'
                        }`}
                      >
                        {saveProfs.includes(stat) ? '熟练' : '非熟练'}
                      </button>
                    )}
                    {!editing && saveProfs.includes(stat) && (
                      <span className="block text-[10px] text-dnd-primary mt-1">熟练</span>
                    )}
                  </div>
                );
              })}
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

            {/* Saving Throws */}
            <div className="bg-dnd-bg rounded-lg p-3">
              <h3 className="text-xs font-semibold text-dnd-muted mb-2">豁免</h3>
              <div className="grid grid-cols-3 gap-1 text-sm">
                {STAT_NAMES.map(stat => {
                  const saveMod = getModifier(stats[stat]) + (saveProfs.includes(stat) ? profBonus : 0);
                  return (
                    <div key={stat} className="flex justify-between items-center group">
                      <span className="text-dnd-muted">{STAT_FULL[stat]}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{formatMod(saveMod)}</span>
                        {socket && (
                          <button
                            onClick={() => rollQuickDice(saveMod, `${STAT_FULL[stat]}豁免`)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-dnd-primary/20 hover:bg-dnd-primary/40 text-dnd-primary px-1 rounded"
                          >
                            d20
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Passive Perception */}
            <div className="bg-dnd-bg rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-dnd-muted">被动察觉</span>
              <span className="text-lg font-bold text-dnd-primary">
                {10 + getSkillMod('perception', skillProfs, stats, profBonus)}
              </span>
            </div>
          </div>
        )}

        {/* ─── Combat Tab ─── */}
        {tab === 'combat' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <HpBar label="HP" current={character.hpCurrent} max={character.hpMax} temp={character.tempHp} />
              <StatBlock label="AC" value={String(character.ac)} highlight />
              <div className="bg-dnd-bg rounded-lg p-3">
                <span className="block text-xs text-dnd-muted">先攻</span>
                <span className="block text-lg font-bold">{formatMod(computedInitiative)}</span>
              </div>
              <StatBlock label="速度" value={`${character.speed || 30} ft`} />
              <StatBlock label="黑暗视觉" value={`${character.darkvision || 0} ft`} />
              <StatBlock label="生命骰" value={character.hitDice || '-'} />
            </div>

            {editing && (
              <div className="grid grid-cols-2 gap-2">
                <EditField label="HP当前" value={String(character.hpCurrent)} type="number" onChange={v => update({ hpCurrent: parseInt(v) || 0 } as any)} />
                <EditField label="HP最大" value={String(character.hpMax)} type="number" onChange={v => update({ hpMax: parseInt(v) || 1 } as any)} />
                <EditField label="临时HP" value={String(character.tempHp)} type="number" onChange={v => update({ tempHp: parseInt(v) || 0 } as any)} />
                <EditField label="AC" value={String(character.ac)} type="number" onChange={v => update({ ac: parseInt(v) || 10 } as any)} />
                <EditField label="速度(ft)" value={String(character.speed || 30)} type="number" onChange={v => update({ speed: parseInt(v) || 30 } as any)} />
                <EditField label="黑暗视觉(ft)" value={String(character.darkvision || 0)} type="number" onChange={v => update({ darkvision: parseInt(v) || 0 } as any)} />
                <EditField label="生命骰" value={character.hitDice || ''} onChange={v => update({ hitDice: v || null } as any)} />
              </div>
            )}

            {/* Spellcasting */}
            {character.spellcastingAbility && (
              <div className="bg-dnd-bg rounded-lg p-3 space-y-2">
                <h3 className="text-xs font-semibold text-dnd-muted">施法</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-dnd-muted text-xs block">施法属性</span>
                    <span className="font-bold">{character.spellcastingAbility}</span>
                  </div>
                  <div>
                    <span className="text-dnd-muted text-xs block">法术DC</span>
                    <span className="font-bold text-dnd-primary">{character.spellSaveDc || computedSpellDc}</span>
                  </div>
                  <div>
                    <span className="text-dnd-muted text-xs block">攻击加值</span>
                    <span className="font-bold text-dnd-accent">{formatMod(character.spellAttackBonus || computedSpellAtk)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-dnd-bg rounded-lg p-3">
                <span className="text-xs text-dnd-muted block">抗性</span>
                <span className="text-sm">{character.resistances || '无'}</span>
              </div>
              <div className="bg-dnd-bg rounded-lg p-3">
                <span className="text-xs text-dnd-muted block">免疫</span>
                <span className="text-sm">{character.immunities || '无'}</span>
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
                  className={`flex items-center justify-between px-3 py-2 rounded transition-colors group ${
                    isOwner && editing ? 'cursor-pointer' : ''
                  } ${
                    isProf ? 'bg-dnd-primary/10 border border-dnd-primary/30' : 'bg-dnd-bg border border-dnd-accent/20 hover:border-dnd-accent/40'
                  }`}
                  onClick={() => { if (isOwner && editing) toggleSkillProf(skill.name); }}
                >
                  <div className="flex items-center gap-2">
                    {isProf && <span className="text-[10px] bg-dnd-primary/30 text-dnd-primary px-1 rounded">P</span>}
                    <span className="text-sm">{skill.cn}</span>
                    <span className="text-xs text-dnd-muted hidden sm:inline">{skill.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dnd-muted uppercase">{STAT_LABELS[skill.stat]}</span>
                    <span className="font-bold text-sm w-8 text-right">{formatMod(mod)}</span>
                    {socket && (
                      <button
                        onClick={(e) => { e.stopPropagation(); rollQuickDice(mod, skill.cn); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-dnd-primary/20 hover:bg-dnd-primary/40 text-dnd-primary px-1 rounded"
                      >
                        d20
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Spells Tab ─── */}
        {tab === 'spells' && (
          <SpellsPanel
            character={character}
            isOwner={isOwner}
            editing={editing}
            spells={spells}
            spellSlots={spellSlots}
            computedSpellDc={computedSpellDc}
            computedSpellAtk={computedSpellAtk}
            update={update}
            resetSpellSlots={resetSpellSlots}
            useSpellSlot={useSpellSlot}
          />
        )}

        {/* ─── Equip Tab ─── */}
        {tab === 'equip' && (
          <div className="space-y-3">
            {/* Weapons */}
            {character.weapons && (character.weapons as any).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-dnd-muted">武器</h3>
                {(character.weapons as any[]).map((w: any, i: number) => (
                  <div key={i} className="bg-dnd-bg rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{w.name}</span>
                      <span className="text-xs text-dnd-accent">{w.atk}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-dnd-muted mt-1">
                      <span>伤害: {w.dmg}</span>
                      <span>{w.type}</span>
                    </div>
                    {w.properties && (
                      <p className="text-[10px] text-dnd-muted mt-1">{w.properties}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Armor */}
            {character.armor && Object.keys(character.armor as any).length > 0 && (
              <div className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-2">护甲</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {Object.entries(character.armor as any).filter(([k]) => k !== 'name').map(([key, val]) => (
                    <div key={key}>
                      <span className="text-xs text-dnd-muted block capitalize">{key}</span>
                      <span className="font-medium">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Currency */}
            {character.currency && (
              <div className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-2">货币</h3>
                <div className="grid grid-cols-5 gap-1 text-center text-sm">
                  {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(c => {
                    const labels: Record<string, string> = { cp: '铜币', sp: '银币', ep: '金银币', gp: '金币', pp: '白金币' };
                    return (
                      <div key={c}>
                        <span className="text-[10px] text-dnd-muted uppercase block">{c}</span>
                        <span className="font-medium">{(character.currency as any)[c] || 0}</span>
                        <span className="text-[10px] text-dnd-muted block">{labels[c]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Equipment */}
            {character.equipment && (character.equipment as any).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-dnd-muted">装备物品</h3>
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
                <h3 className="text-xs font-semibold text-dnd-muted">背包</h3>
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

// ─── Helper: skill modifier computation ───
function getSkillMod(skillName: string, profs: string[] | null, stats: CharacterStats, profBonus: number): number {
  const skill = SKILL_LIST.find(s => s.name.toLowerCase() === skillName.toLowerCase());
  if (!skill) return 0;
  const baseMod = getModifier(stats[skill.stat]);
  return baseMod + (profs?.some(p => p.toLowerCase() === skillName.toLowerCase()) ? profBonus : 0);
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
      <div className="h-2.5 bg-dnd-darker rounded-full overflow-hidden">
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

// ─── Spells Panel ───
function SpellsPanel({ character, isOwner, editing, spells, spellSlots, computedSpellDc, computedSpellAtk, update, resetSpellSlots, useSpellSlot }: {
  character: Character;
  isOwner: boolean;
  editing: boolean;
  spells: Record<string, string[]>;
  spellSlots: Record<string, { max: number; used: number }>;
  computedSpellDc: number;
  computedSpellAtk: number;
  update: (data: Partial<Character>) => Promise<void>;
  resetSpellSlots: () => Promise<void>;
  useSpellSlot: (level: string) => Promise<void>;
}) {
  const [spellFilter, setSpellFilter] = useState('');
  const [spellLevelFilter, setSpellLevelFilter] = useState<number | -1>(-1);
  const [showResults, setShowResults] = useState(false);

  const filteredSpells = useMemo(() => {
    let list = SPELLS;
    if (spellFilter.trim()) {
      const q = spellFilter.toLowerCase();
      list = list.filter(s => s.cn.includes(q) || s.en.toLowerCase().includes(q));
    }
    if (spellLevelFilter >= 0) {
      const lvlName = spellLevelFilter === 0 ? '戏法' : `${spellLevelFilter}环`;
      list = list.filter(s => s.level === spellLevelFilter);
    }
    return list.slice(0, 50);
  }, [spellFilter, spellLevelFilter]);

  const addSpell = async (spellCn: string, levelName: string) => {
    const updated = { ...spells };
    if (!updated[levelName]) updated[levelName] = [];
    if (!updated[levelName].includes(spellCn)) {
      updated[levelName] = [...updated[levelName], spellCn];
      await update({ spells: updated as any } as any);
    }
    setSpellFilter('');
    setShowResults(false);
  };

  const removeSpell = async (levelName: string, spellName: string) => {
    const updated = { ...spells };
    updated[levelName] = updated[levelName].filter(s => s !== spellName);
    if (updated[levelName].length === 0) delete updated[levelName];
    await update({ spells: updated as any } as any);
  };

  return (
    <div className="space-y-3">
      {editing && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-dnd-muted mb-1">施法职业</label>
            <input
              type="text"
              value={character.spellcastingClass || ''}
              onChange={e => update({ spellcastingClass: e.target.value || null } as any)}
              className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-dnd-muted mb-1">施法属性</label>
            <select
              value={character.spellcastingAbility || ''}
              onChange={e => update({ spellcastingAbility: e.target.value || null } as any)}
              className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1.5 text-sm"
            >
              <option value="">未设置</option>
              {STAT_NAMES.map(s => (
                <option key={s} value={STAT_FULL[s]}>{STAT_FULL[s]}</option>
              ))}
            </select>
          </div>
          <EditField label="法术DC" value={character.spellSaveDc ? String(character.spellSaveDc) : String(computedSpellDc)} type="number" onChange={v => update({ spellSaveDc: v ? parseInt(v) : null } as any)} />
          <EditField label="法术攻击加值" value={character.spellAttackBonus ? String(character.spellAttackBonus) : String(computedSpellAtk)} type="number" onChange={v => update({ spellAttackBonus: v ? parseInt(v) : null } as any)} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="施法属性" value={character.spellcastingAbility || '-'} />
        <StatBlock label="法术DC" value={character.spellSaveDc ? String(character.spellSaveDc) : String(computedSpellDc)} highlight />
        <StatBlock label="攻击加值" value={(character.spellAttackBonus ? formatMod(character.spellAttackBonus) : formatMod(computedSpellAtk))} />
      </div>

      {/* Spell Slots */}
      {Object.keys(spellSlots).length > 0 && (
        <div className="bg-dnd-bg rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-dnd-muted">法术位</h3>
            {isOwner && (
              <button onClick={resetSpellSlots} className="text-[10px] text-dnd-primary hover:underline">全部重置</button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(spellSlots).map(([lvl, slot]) => (
              <div key={lvl} className="text-center bg-dnd-surface rounded p-2">
                <span className="text-xs text-dnd-muted block">{lvl}环</span>
                <div className="flex items-center justify-center gap-0.5 mt-1 flex-wrap">
                  {Array.from({ length: slot.max }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full border cursor-pointer ${i < slot.used ? 'bg-dnd-primary border-dnd-primary' : 'border-dnd-accent hover:border-dnd-primary'}`}
                      onClick={() => { if (!isOwner) return; useSpellSlot(lvl); }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-dnd-muted mt-1 block">{slot.max - slot.used}/{slot.max}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spell Search & Add */}
      {isOwner && editing && (
        <div className="bg-dnd-bg rounded-lg p-3 relative">
          <h3 className="text-xs font-semibold text-dnd-muted mb-2">搜索法术</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={spellFilter}
              onChange={e => { setSpellFilter(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="输入关键词搜索法术..."
              className="flex-1 bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
            />
            <select
              value={spellLevelFilter}
              onChange={e => { setSpellLevelFilter(parseInt(e.target.value)); setShowResults(true); }}
              className="bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
            >
              <option value={-1}>全部环阶</option>
              <option value={0}>戏法</option>
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}环</option>
              ))}
            </select>
          </div>
          {showResults && filteredSpells.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto border border-dnd-accent/30 rounded">
              {filteredSpells.map((s, i) => {
                const lvlName = s.level === 0 ? 'Cantrip' : `Lv${s.level}`;
                const alreadyKnown = spells[lvlName]?.includes(s.cn);
                return (
                  <button
                    key={i}
                    onClick={() => addSpell(s.cn, lvlName)}
                    disabled={alreadyKnown}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-dnd-accent/10 last:border-0 ${
                      alreadyKnown ? 'bg-dnd-primary/10 text-dnd-muted cursor-not-allowed' : 'hover:bg-dnd-primary/10 text-dnd-text'
                    }`}
                  >
                    <span className="font-medium">{s.cn}</span>
                    <span className="text-dnd-muted ml-2 text-xs">{s.en}</span>
                    <span className="text-dnd-accent ml-2 text-xs">{s.level === 0 ? '戏法' : `${s.level}环`} {s.school}</span>
                    <span className="text-dnd-muted ml-2 text-xs">{s.classes}</span>
                    {alreadyKnown && <span className="text-dnd-primary text-xs ml-2">✓ 已学会</span>}
                  </button>
                );
              })}
            </div>
          )}
          {showResults && spellFilter && filteredSpells.length === 0 && (
            <p className="text-xs text-dnd-muted mt-2">未找到匹配的法术</p>
          )}
        </div>
      )}

      {/* Known Spells */}
      {Object.entries(spells).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-dnd-muted">已准备法术</h3>
          {Object.entries(spells).map(([level, list]) => (
            <div key={level} className="bg-dnd-bg rounded-lg p-3">
              <h3 className="text-xs font-semibold text-dnd-muted mb-2">{level}</h3>
              <div className="flex flex-wrap gap-1">
                {list.map((name: string, i: number) => {
                  const spellData = SPELLS.find(s => s.cn === name);
                  return (
                    <span key={i} className="text-xs bg-dnd-surface border border-dnd-accent/30 rounded px-2 py-1 flex items-center gap-1 group">
                      <span className="font-medium">{name}</span>
                      {spellData && <span className="text-dnd-muted hidden sm:inline">{spellData.level === 0 ? '戏法' : `${spellData.level}环`}</span>}
                      {isOwner && editing && (
                        <button
                          onClick={() => removeSpell(level, name)}
                          className="text-dnd-muted hover:text-dnd-danger ml-1 leading-none"
                        >×</button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(spells).length === 0 && (
        <div className="text-center py-8 text-dnd-muted text-sm">
          {isOwner && editing ? '使用上方搜索框添加法术' : '暂无已准备的法术'}
        </div>
      )}
    </div>
  );
}
