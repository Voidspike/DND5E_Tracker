import { useState, useRef, useMemo, useEffect } from 'react';
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

// Class → spellcasting ability mapping (D&D 5E)
const CLASS_SPELLCASTING_ABILITY: Record<string, string | null> = {
  'Barbarian': null, 'Bard': '魅力', 'Cleric': '感知', 'Druid': '感知',
  'Fighter': null, 'Monk': null, 'Paladin': '魅力', 'Ranger': '感知',
  'Rogue': null, 'Sorcerer': '魅力', 'Warlock': '魅力', 'Wizard': '智力',
};
const PREPARED_CASTER_CLASSES = new Set(['Cleric', 'Druid', 'Paladin', 'Wizard']);
const PREPARED_KEY = '_prepared';

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
  const { updateCharacter, updateToken, deleteCharacter, tokens: allTokens, currentCampaign } = useCampaignStore();
  const [tab, setTab] = useState<CharTab>('info');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = character.userId === user?.id;
  const isDM = currentCampaign?.dmId === user?.id;
  const canDelete = isOwner || isDM;
  const stats = safeObj<CharacterStats>(character.stats, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const profBonus = character.proficiency || 2;
  const saveProfs = safeArray<string>(character.statSaveProficiencies);
  const skillProfs = safeArray<string>(character.skillProficiencies);
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
    // Sync HP changes to linked tokens
    if (data.hpCurrent !== undefined || data.hpMax !== undefined) {
      const linkedTokens = (allTokens || []).filter((t: any) => t.characterId === character.id);
      for (const t of linkedTokens) {
        const tokenUpdates: any = {};
        if (data.hpCurrent !== undefined) tokenUpdates.hpCurrent = data.hpCurrent;
        if (data.hpMax !== undefined) tokenUpdates.hpMax = data.hpMax;
        updateToken(t.id, tokenUpdates).catch(console.error);
        if (socket && campaignId) {
          socket.emit('token:update', { tokenId: t.id, updates: tokenUpdates });
        }
      }
    }
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
          {canDelete && (
            <button
              onClick={() => {
                if (confirm(`删除角色 "${character.name}"？此操作不可撤销。`)) {
                  deleteCharacter(character.id);
                  onClose();
                }
              }}
              className="px-3 py-1 rounded text-sm bg-dnd-danger/20 text-dnd-danger hover:bg-dnd-danger/30"
            >
              删除
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
            stats={stats}
            profBonus={profBonus}
            spellsRaw={character.spells}
            spellSlotsRaw={character.spellSlots}
            update={update}
          />
        )}

        {/* ─── Equip Tab ─── */}
        {tab === 'equip' && (
          <EquipPanel
            character={character}
            isOwner={isOwner}
            editing={editing}
            update={update}
          />
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
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div>
      <label className="block text-xs text-dnd-muted mb-1">{label}</label>
      <input
        type={type}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local); }}
        className="w-full bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
      />
    </div>
  );
}

// Local-state input that syncs on blur — avoids IME composition issues
function BlurInput({ value, onChange, placeholder, className, autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  return (
    <input
      ref={inputRef}
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ─── Spells Panel ───
const SPELL_LEVEL_ORDER = ['Cantrip', 'Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5', 'Lv6', 'Lv7', 'Lv8', 'Lv9'];

function getSpellcastingInfo(classValue: string): { ability: string | null; statKey: string | null } {
  const ability = CLASS_SPELLCASTING_ABILITY[classValue] ?? null;
  const statKey = ability ? (STAT_FULL as Record<string, string>)[Object.keys(STAT_FULL).find(k => (STAT_FULL as Record<string, string>)[k] === ability) || ''] || null : null;
  return { ability, statKey };
}

// Parse spells: supports old format { "Cantrip": [...], "Lv1": [...] } and new format with _prepared key
function parseSpells(raw: unknown): { learned: Record<string, string[]>; prepared: string[] } {
  const obj = safeObj<Record<string, unknown>>(raw, {});
  const prepared = Array.isArray(obj[PREPARED_KEY]) ? (obj[PREPARED_KEY] as unknown as string[]) : [];
  const learned: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === PREPARED_KEY) continue;
    learned[k] = safeArray<string>(v);
  }
  // backward compat: if no _prepared key, all learned spells are considered prepared
  const hasPreparedKey = PREPARED_KEY in obj;
  const effectivePrepared = hasPreparedKey ? prepared : Object.values(learned).flat();
  return { learned, prepared: effectivePrepared };
}

function SpellsPanel({ character, isOwner, editing, stats, profBonus, spellsRaw, spellSlotsRaw, update }: {
  character: Character;
  isOwner: boolean;
  editing: boolean;
  stats: CharacterStats;
  profBonus: number;
  spellsRaw: unknown;
  spellSlotsRaw: unknown;
  update: (data: Partial<Character>) => Promise<void>;
}) {
  const [spellFilter, setSpellFilter] = useState('');
  const [spellLevelFilter, setSpellLevelFilter] = useState<number | -1>(-1);
  const [showResults, setShowResults] = useState(false);

  // Spellcasting info auto-derived from class
  const currentClass = CLASS_OPTIONS.find(c => c.value === character.class);
  const classCnName = currentClass?.label || character.class;
  const spellInfo = getSpellcastingInfo(character.class);
  const spellAbility = spellInfo.ability;
  const spellStatKey = spellInfo.statKey as keyof CharacterStats | null;
  const spellAbilityMod = spellStatKey ? getModifier(stats[spellStatKey] || 0) : 0;
  const effectiveSpellDc = 8 + profBonus + spellAbilityMod;
  const effectiveSpellAtk = profBonus + spellAbilityMod;

  const { learned, prepared: preparedSpells } = parseSpells(spellsRaw);
  const spellSlots = safeObj<Record<string, { max: number; used: number }>>(spellSlotsRaw, {});

  const isPreparedCaster = PREPARED_CASTER_CLASSES.has(character.class);
  const hasSpellcasting = spellAbility !== null;

  // Prepared caster limit: spellcasting mod + level (min 1). Cantrips don't count.
  const maxPrepared = Math.max(1, spellAbilityMod + character.level);
  const preparedCount = preparedSpells.filter(name => {
    const s = SPELLS.find(x => x.cn === name);
    return s && s.level > 0;
  }).length;

  const hasSpellsOrSlots = Object.keys(learned).length > 0 || Object.keys(spellSlots).length > 0;

  // Sync spellcasting server fields when entering edit mode
  const syncAndUpdate = async (data: Partial<Character>) => {
    const toSend = {
      ...data,
      spellcastingClass: character.class,
      spellcastingAbility: spellAbility,
      spellSaveDc: effectiveSpellDc,
      spellAttackBonus: effectiveSpellAtk,
    };
    await update(toSend as any);
  };

  // Filtered spell list for search
  const filteredSpells = useMemo(() => {
    let list = SPELLS;
    // Only show spells from the character's class
    if (classCnName) {
      list = list.filter(s => {
        const spellClasses = s.classes.split(/\s+/).filter(Boolean);
        return spellClasses.includes(classCnName);
      });
    }
    if (spellFilter.trim()) {
      const q = spellFilter.toLowerCase();
      list = list.filter(s => s.cn.includes(q) || s.en.toLowerCase().includes(q));
    }
    if (spellLevelFilter >= 0) {
      list = list.filter(s => s.level === spellLevelFilter);
    }
    return list.slice(0, 50);
  }, [spellFilter, spellLevelFilter, classCnName]);

  const addSpell = async (spellCn: string, spellLevel: number) => {
    const levelName = spellLevel === 0 ? 'Cantrip' : `Lv${spellLevel}`;
    const newLearned = { ...learned };
    if (!newLearned[levelName]) newLearned[levelName] = [];
    if (!newLearned[levelName].includes(spellCn)) {
      newLearned[levelName] = [...newLearned[levelName], spellCn];
    }
    // For prepared casters: new spell is NOT auto-prepared (except cantrips)
    // For known casters: new spell IS auto-prepared
    let newPrepared = [...preparedSpells];
    if (!isPreparedCaster || spellLevel === 0) {
      if (!newPrepared.includes(spellCn)) newPrepared.push(spellCn);
    }
    const spellsData = { ...newLearned, [PREPARED_KEY]: newPrepared };
    await syncAndUpdate({ spells: spellsData } as any);
    setSpellFilter('');
    setShowResults(false);
  };

  const removeSpell = async (levelName: string, spellName: string) => {
    const newLearned = { ...learned };
    newLearned[levelName] = newLearned[levelName].filter(s => s !== spellName);
    if (newLearned[levelName].length === 0) delete newLearned[levelName];
    const newPrepared = preparedSpells.filter(s => s !== spellName);
    const spellsData = { ...newLearned, [PREPARED_KEY]: newPrepared };
    await syncAndUpdate({ spells: spellsData } as any);
  };

  const togglePrepared = async (spellName: string) => {
    if (!isPreparedCaster) return;
    const isCurrentlyPrepared = preparedSpells.includes(spellName);
    const spell = SPELLS.find(s => s.cn === spellName);
    const isCantrip = spell && spell.level === 0;
    // Cantrips are always prepared — can't toggle off
    if (isCantrip && isCurrentlyPrepared) return;

    let newPrepared: string[];
    if (isCurrentlyPrepared) {
      newPrepared = preparedSpells.filter(s => s !== spellName);
    } else {
      if (preparedCount >= maxPrepared) return; // at limit
      newPrepared = [...preparedSpells, spellName];
    }
    const spellsData = { ...learned, [PREPARED_KEY]: newPrepared };
    await syncAndUpdate({ spells: spellsData } as any);
  };

  const resetSpellSlots = async () => {
    const reset: Record<string, { max: number; used: number }> = {};
    for (const [lvl, s] of Object.entries(spellSlots)) {
      reset[lvl] = { ...s, used: 0 };
    }
    await update({ spellSlots: reset } as any);
  };

  const useSpellSlot = async (level: string) => {
    const slot = spellSlots[level];
    if (!slot) return;
    const updated = { ...spellSlots, [level]: { ...slot, used: Math.min(slot.max, slot.used + 1) } };
    await update({ spellSlots: updated } as any);
  };

  return (
    <div className="space-y-3">
      {/* Spellcasting Info (always read-only, computed from class) */}
      <div className="bg-dnd-bg rounded-lg p-3">
        <h3 className="text-xs font-semibold text-dnd-muted mb-2">施法信息</h3>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div>
            <span className="text-xs text-dnd-muted block">施法职业</span>
            <span className="font-medium">{classCnName}</span>
          </div>
          <div>
            <span className="text-xs text-dnd-muted block">施法属性</span>
            <span className="font-medium">{spellAbility || '-'}</span>
          </div>
          <div>
            <span className="text-xs text-dnd-muted block">法术DC</span>
            <span className="font-bold text-dnd-primary">{effectiveSpellDc}</span>
          </div>
          <div>
            <span className="text-xs text-dnd-muted block">攻击加值</span>
            <span className="font-bold text-dnd-accent">{formatMod(effectiveSpellAtk)}</span>
          </div>
        </div>
        {!hasSpellcasting && (
          <p className="text-xs text-dnd-muted mt-2">{classCnName}无法施法</p>
        )}
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

      {/* Spell Search & Add (edit mode, owner only, only if class can cast) */}
      {isOwner && editing && hasSpellcasting && (
        <div className="bg-dnd-bg rounded-lg p-3 relative">
          <h3 className="text-xs font-semibold text-dnd-muted mb-2">搜索法术 — {classCnName}</h3>
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
                const alreadyKnown = learned[lvlName]?.includes(s.cn);
                return (
                  <button
                    key={i}
                    onClick={() => addSpell(s.cn, s.level)}
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
            <p className="text-xs text-dnd-muted mt-2">未找到{classCnName}职业的匹配法术</p>
          )}
          {showResults && !spellFilter && spellLevelFilter < 0 && filteredSpells.length === 0 && (
            <p className="text-xs text-dnd-muted mt-2">{classCnName}没有可用的法术</p>
          )}
        </div>
      )}

      {/* Learned Spells by level */}
      {Object.keys(learned).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-dnd-muted">
              {editing ? '已学会法术' : '已准备法术'}
            </h3>
            {isPreparedCaster && editing && (
              <span className={`text-xs ${preparedCount > maxPrepared ? 'text-dnd-danger' : 'text-dnd-muted'}`}>
                已准备: {preparedCount}/{maxPrepared}
              </span>
            )}
          </div>
          {SPELL_LEVEL_ORDER.map(level => {
            const list = learned[level];
            if (!list || list.length === 0) return null;
            return (
              <div key={level} className="bg-dnd-bg rounded-lg p-3">
                <h3 className="text-xs font-semibold text-dnd-muted mb-2">{level === 'Cantrip' ? '戏法' : level}</h3>
                <div className="flex flex-wrap gap-1">
                  {list.map((name: string, i: number) => {
                    const spellData = SPELLS.find(s => s.cn === name);
                    const isPrepared = preparedSpells.includes(name);
                    const isCantrip = spellData && spellData.level === 0;
                    const canTogglePrep = isPreparedCaster && editing && !isCantrip;
                    const atPrepLimit = isPreparedCaster && !isPrepared && preparedCount >= maxPrepared;
                    return (
                      <span
                        key={i}
                        className={`text-xs border rounded px-2 py-1 flex items-center gap-1 group ${
                          isPrepared
                            ? 'bg-dnd-primary/10 border-dnd-primary/40 text-dnd-text'
                            : 'bg-dnd-surface border-dnd-accent/20 text-dnd-muted'
                        }`}
                      >
                        {canTogglePrep && (
                          <button
                            onClick={() => togglePrepared(name)}
                            className="text-[10px] hover:text-dnd-primary leading-none"
                            title={isPrepared ? '取消准备' : '准备'}
                          >
                            {isPrepared ? '●' : '○'}
                          </button>
                        )}
                        <span className="font-medium">{name}</span>
                        {spellData && <span className="text-dnd-muted hidden sm:inline">{spellData.level === 0 ? '戏法' : `${spellData.level}环`}</span>}
                        {!isPrepared && !editing && <span className="text-[10px] text-dnd-muted">(未准备)</span>}
                        {atPrepLimit && <span className="text-[10px] text-dnd-muted">(已达上限)</span>}
                        {isOwner && editing && (
                          <button
                            onClick={() => removeSpell(level, name)}
                            className="text-dnd-muted hover:text-dnd-danger ml-1 leading-none"
                            title="忘记法术"
                          >×</button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasSpellsOrSlots && (
        <div className="text-center py-8 text-dnd-muted text-sm">
          {isOwner && editing && hasSpellcasting ? '使用上方搜索框添加法术' : '暂无法术'}
        </div>
      )}
    </div>
  );
}

// ─── Equip Panel ───
function armorLabel(key: string): string {
  const map: Record<string, string> = { ac: 'AC', type: '类型', stealth: '潜行', strReq: '力量需求', properties: '属性' };
  return map[key] || key;
}

const CURRENCY_COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
const CURRENCY_LABELS: Record<string, string> = { cp: '铜币', sp: '银币', ep: '金银币', gp: '金币', pp: '白金币' };

function EquipPanel({ character, isOwner, editing, update }: {
  character: Character;
  isOwner: boolean;
  editing: boolean;
  update: (data: Partial<Character>) => Promise<void>;
}) {
  const weapons = safeArray<Record<string, unknown>>(character.weapons);
  const armor = safeObj<Record<string, unknown>>(character.armor, {});
  const currency = safeObj<Record<string, number>>(character.currency, { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  const equipment = safeArray<Record<string, unknown>>(character.equipment);
  const inventory = safeObj<Record<string, unknown>>(character.inventory, {});

  const addWeapon = async () => {
    await update({ weapons: [...weapons, { name: '', atk: '+0', dmg: '1d4', type: '挥砍', properties: '' }] } as any);
  };
  const updateWeapon = async (idx: number, field: string, value: string) => {
    const updated = weapons.map((w, i) => i === idx ? { ...w, [field]: value } : w);
    await update({ weapons: updated } as any);
  };
  const removeWeapon = async (idx: number) => {
    const updated = weapons.filter((_, i) => i !== idx);
    await update({ weapons: updated.length > 0 ? updated : null } as any);
  };

  const updateArmor = async (field: string, value: string) => {
    const updated = { ...armor, [field]: value };
    await update({ armor: updated } as any);
  };

  const updateCurrency = async (coin: string, value: number) => {
    const updated = { ...currency, [coin]: value };
    await update({ currency: updated } as any);
  };

  const [equipSpellSearchIdx, setEquipSpellSearchIdx] = useState<number | null>(null);
  const [equipSpellFilter, setEquipSpellFilter] = useState('');

  const addEquipment = async () => {
    await update({ equipment: [...equipment, { name: '', qty: 1 }] } as any);
  };
  const updateEquipment = async (idx: number, field: string, value: string | number) => {
    const updated = equipment.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    await update({ equipment: updated } as any);
  };
  const removeEquipment = async (idx: number) => {
    const updated = equipment.filter((_, i) => i !== idx);
    setEquipSpellSearchIdx(null);
    await update({ equipment: updated.length > 0 ? updated : null } as any);
  };
  const setEquipmentSpell = async (idx: number, spellCn: string) => {
    const updated = equipment.map((e, i) => i === idx ? { ...e, spell: spellCn } : e);
    await update({ equipment: updated } as any);
    setEquipSpellFilter('');
    setEquipSpellSearchIdx(null);
  };
  const removeEquipmentSpell = async (idx: number) => {
    const updated = equipment.map((e: any, i: number) => {
      if (i !== idx) return e;
      const { spell, charges, ...rest } = e;
      return rest;
    });
    await update({ equipment: updated } as any);
  };

  // Filter all spells for equipment spell search
  const filteredEquipSpells = useMemo(() => {
    if (!equipSpellFilter.trim()) return [];
    const q = equipSpellFilter.toLowerCase();
    return SPELLS.filter(s => s.cn.includes(q) || s.en.toLowerCase().includes(q)).slice(0, 20);
  }, [equipSpellFilter]);

  const hasArmorData = Object.keys(armor).length > 0;
  const hasInventoryData = Object.keys(inventory).length > 0;

  return (
    <div className="space-y-3">
      {/* Weapons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dnd-muted">武器</h3>
          {isOwner && editing && (
            <button onClick={addWeapon} className="text-xs text-dnd-primary hover:underline">+ 添加武器</button>
          )}
        </div>
        {weapons.length === 0 && !editing && <p className="text-xs text-dnd-muted">无</p>}
        {weapons.length === 0 && editing && <p className="text-xs text-dnd-muted">点击上方按钮添加武器</p>}
        {weapons.map((w: any, i: number) => (
          <div key={i} className="bg-dnd-bg rounded-lg p-3">
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="名称" value={w.name || ''} onChange={v => updateWeapon(i, 'name', v)} />
                  <EditField label="攻击加值" value={w.atk || ''} onChange={v => updateWeapon(i, 'atk', v)} />
                  <EditField label="伤害" value={w.dmg || ''} onChange={v => updateWeapon(i, 'dmg', v)} />
                  <EditField label="伤害类型" value={w.type || ''} onChange={v => updateWeapon(i, 'type', v)} />
                </div>
                <EditField label="属性" value={w.properties || ''} onChange={v => updateWeapon(i, 'properties', v)} />
                <button onClick={() => removeWeapon(i)} className="text-xs text-dnd-danger hover:underline">移除</button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{w.name || '未命名'}</span>
                  <span className="text-xs text-dnd-accent">{w.atk}</span>
                </div>
                <div className="flex gap-3 text-xs text-dnd-muted mt-1">
                  <span>伤害: {w.dmg}</span>
                  <span>{w.type}</span>
                </div>
                {w.properties && <p className="text-[10px] text-dnd-muted mt-1">{w.properties}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Armor */}
      {isOwner && editing ? (
        <div className="bg-dnd-bg rounded-lg p-3 space-y-2">
          <h3 className="text-xs font-semibold text-dnd-muted">护甲</h3>
          <EditField label="名称" value={(armor as any).name || ''} onChange={v => updateArmor('name', v)} />
          <div className="grid grid-cols-2 gap-2">
            <EditField label="AC" value={(armor as any).ac || ''} onChange={v => updateArmor('ac', v)} />
            <EditField label="类型" value={(armor as any).type || ''} onChange={v => updateArmor('type', v)} />
            <EditField label="潜行" value={(armor as any).stealth || ''} onChange={v => updateArmor('stealth', v)} />
            <EditField label="力量需求" value={(armor as any).strReq || ''} onChange={v => updateArmor('strReq', v)} />
          </div>
          <EditField label="属性" value={(armor as any).properties || ''} onChange={v => updateArmor('properties', v)} />
        </div>
      ) : (
        hasArmorData && (
          <div className="bg-dnd-bg rounded-lg p-3">
            <h3 className="text-xs font-semibold text-dnd-muted mb-2">护甲</h3>
            {(armor as any).name && <p className="text-sm font-medium mb-1">{(armor as any).name}</p>}
            <div className="grid grid-cols-3 gap-2 text-sm">
              {Object.entries(armor).filter(([k]) => k !== 'name').map(([key, val]) => (
                <div key={key}>
                  <span className="text-xs text-dnd-muted block">{armorLabel(key)}</span>
                  <span className="font-medium">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Currency */}
      <div className="bg-dnd-bg rounded-lg p-3">
        <h3 className="text-xs font-semibold text-dnd-muted mb-2">货币</h3>
        {editing ? (
          <div className="grid grid-cols-5 gap-1 text-center">
            {CURRENCY_COINS.map(c => (
              <div key={c}>
                <span className="text-[10px] text-dnd-muted uppercase block">{c}</span>
                <input
                  type="number"
                  min={0}
                  value={currency[c] || 0}
                  onChange={e => updateCurrency(c, parseInt(e.target.value) || 0)}
                  className="w-full bg-dnd-surface border border-dnd-accent rounded px-1 py-0.5 text-sm text-center"
                />
                <span className="text-[10px] text-dnd-muted block">{CURRENCY_LABELS[c]}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1 text-center text-sm">
            {CURRENCY_COINS.map(c => (
              <div key={c}>
                <span className="text-[10px] text-dnd-muted uppercase block">{c}</span>
                <span className="font-medium">{currency[c] || 0}</span>
                <span className="text-[10px] text-dnd-muted block">{CURRENCY_LABELS[c]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dnd-muted">装备物品</h3>
          {isOwner && editing && (
            <button onClick={addEquipment} className="text-xs text-dnd-primary hover:underline">+ 添加物品</button>
          )}
        </div>
        {equipment.length === 0 && !editing && <p className="text-xs text-dnd-muted">无</p>}
        {equipment.length === 0 && editing && <p className="text-xs text-dnd-muted">点击上方按钮添加物品</p>}
        {equipment.map((e: any, i: number) => {
          const hasSpell = !!e.spell;
          const spellData = e.spell ? SPELLS.find(s => s.cn === e.spell) : null;
          const showSpellSearch = equipSpellSearchIdx === i;
          return (
            <div key={i} className="bg-dnd-bg rounded-lg p-3">
              {editing ? (
                <div className="space-y-2">
                  {/* Name + qty row */}
                  <div className="flex items-center gap-2">
                    <BlurInput
                      value={e.name || ''}
                      onChange={v => updateEquipment(i, 'name', v)}
                      placeholder="物品名称"
                      className="flex-1 bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      value={e.qty || 1}
                      onChange={ev => updateEquipment(i, 'qty', parseInt(ev.target.value) || 1)}
                      className="w-16 bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-sm text-center"
                    />
                    <button
                      onClick={() => removeEquipment(i)}
                      className="text-dnd-muted hover:text-dnd-danger shrink-0"
                    >✕</button>
                  </div>

                  {/* Spell attachment */}
                  {hasSpell ? (
                    <div className="flex items-center gap-2 bg-dnd-surface rounded p-2">
                      <span className="text-xs text-dnd-accent">{e.spell}</span>
                      {spellData && (
                        <span className="text-[10px] text-dnd-muted">{spellData.level === 0 ? '戏法' : `${spellData.level}环`}</span>
                      )}
                      <button
                        onClick={() => removeEquipmentSpell(i)}
                        className="text-[10px] text-dnd-danger hover:underline ml-auto"
                      >移除法术</button>
                    </div>
                  ) : showSpellSearch ? (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <BlurInput
                          value={equipSpellFilter}
                          onChange={setEquipSpellFilter}
                          placeholder="搜索法术..."
                          className="flex-1 bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => { setEquipSpellSearchIdx(null); setEquipSpellFilter(''); }}
                          className="text-xs text-dnd-muted hover:text-dnd-text px-1"
                        >取消</button>
                      </div>
                      {filteredEquipSpells.length > 0 && (
                        <div className="max-h-32 overflow-y-auto border border-dnd-accent/20 rounded">
                          {filteredEquipSpells.map((s, si) => (
                            <button
                              key={si}
                              onClick={() => setEquipmentSpell(i, s.cn)}
                              className="w-full text-left px-2 py-1 text-xs hover:bg-dnd-primary/10 border-b border-dnd-accent/10 last:border-0"
                            >
                              <span className="font-medium">{s.cn}</span>
                              <span className="text-dnd-muted ml-1">{s.en}</span>
                              <span className="text-dnd-accent ml-1">{s.level === 0 ? '戏法' : `${s.level}环`}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {equipSpellFilter && filteredEquipSpells.length === 0 && (
                        <p className="text-[10px] text-dnd-muted">未找到匹配法术</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setEquipSpellSearchIdx(i)}
                      className="text-[10px] text-dnd-primary hover:underline"
                    >+ 附加法术</button>
                  )}

                  {/* Charges (if spell attached) */}
                  {hasSpell && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-dnd-muted shrink-0">充能数:</label>
                      <input
                        type="number"
                        min={0}
                        value={e.charges ?? 0}
                        onChange={ev => updateEquipment(i, 'charges', parseInt(ev.target.value) || 0)}
                        className="w-16 bg-dnd-surface border border-dnd-accent rounded px-2 py-1 text-xs text-center"
                      />
                      <span className="text-[10px] text-dnd-muted">/天</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{e.name || '未命名'}</span>
                    {e.qty != null && <span className="text-dnd-muted">x{e.qty}</span>}
                  </div>
                  {hasSpell && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-dnd-muted">
                      <span className="text-dnd-accent">{e.spell}</span>
                      {spellData && <span>{spellData.level === 0 ? '戏法' : `${spellData.level}环`}</span>}
                      {e.charges != null && e.charges > 0 && (
                        <span className="text-dnd-primary">充能: {e.charges}/天</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inventory (legacy - read only) */}
      {hasInventoryData && equipment.length === 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-dnd-muted">背包 (旧数据)</h3>
          {Object.entries(inventory as Record<string, any>).map(([item, info]) => (
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
  );
}
