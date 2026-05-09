// ─── User ───
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ───
export interface AuthPayload {
  userId: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Campaign ───
export type CampaignRole = 'dm' | 'player' | 'observer';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  dmId: string;
  dm?: User;
  players?: CampaignPlayer[];
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPlayer {
  campaignId: string;
  userId: string;
  user?: User;
  role: CampaignRole;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  settings?: Record<string, unknown>;
}

// ─── Map ───
export interface MapData {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  gridSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridColor: string;
  gridLineWidth: number;
  fogData: string | null;
  createdAt: string;
}

export interface CreateMapRequest {
  name: string;
  imageUrl: string;
  width?: number;
  height?: number;
  gridSize?: number;
  gridColor?: string;
  gridLineWidth?: number;
}

export interface UpdateGridRequest {
  gridSize?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  gridColor?: string;
  gridLineWidth?: number;
  width?: number;
  height?: number;
}

// ─── Token ───
export type TokenType = 'character' | 'npc' | 'monster' | 'object';

export interface Token {
  id: string;
  mapId: string;
  campaignId: string;
  type: TokenType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ownerId: string | null;
  imageUrl: string | null;
  color: string;
  hpCurrent: number | null;
  hpMax: number | null;
  ac: number | null;
  darkvision: number | null;
  speed: number | null;
  isHidden: boolean;
  statusEffects: string[];
  characterId: string | null;
  createdAt: string;
}

export interface CreateTokenRequest {
  mapId: string;
  type: TokenType;
  name: string;
  x?: number;
  y?: number;
  ownerId?: string;
  imageUrl?: string;
  color?: string;
  hpCurrent?: number;
  hpMax?: number;
  ac?: number;
  darkvision?: number;
  speed?: number;
  characterId?: string;
}

export interface UpdateTokenRequest {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  type?: TokenType;
  ownerId?: string | null;
  imageUrl?: string | null;
  color?: string;
  hpCurrent?: number | null;
  hpMax?: number | null;
  ac?: number | null;
  darkvision?: number | null;
  speed?: number | null;
  isHidden?: boolean;
  statusEffects?: string[];
  characterId?: string | null;
}

// ─── Character ───
export interface CharacterStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Character {
  id: string;
  userId: string;
  campaignId: string;
  name: string;
  class: string;
  level: number;
  race: string;
  subrace: string | null;
  gender: string | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  alignment: string | null;
  faith: string | null;
  xp: number;
  proficiency: number;
  hpCurrent: number;
  hpMax: number;
  tempHp: number;
  ac: number;
  initiative: number;
  speed: number;
  darkvision: number;
  passivePerception: number;
  spellcastingClass: string | null;
  spellcastingAbility: string | null;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  hitDice: string | null;
  stats: CharacterStats;
  statSaveProficiencies: string[] | null;
  skills: Record<string, number> | null;
  skillProficiencies: string[] | null;
  spells: Record<string, unknown> | null;
  spellSlots: Record<string, { max: number; used: number }> | null;
  weapons: Record<string, unknown>[] | null;
  armor: Record<string, unknown> | null;
  currency: Record<string, number> | null;
  equipment: Record<string, unknown>[] | null;
  inventory: Record<string, unknown> | null;
  resistances: string | null;
  immunities: string | null;
  languages: string | null;
  toolProficiencies: string | null;
  notes: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterRequest {
  name: string;
  class: string;
  race: string;
  stats: CharacterStats;
  hpMax: number;
  ac: number;
  // optional extended fields
  subrace?: string;
  gender?: string;
  level?: number;
  proficiency?: number;
  speed?: number;
  darkvision?: number;
  initiative?: number;
  passivePerception?: number;
  // ... other fields can be set later via update
}

// ─── Combat ───
export interface CombatParticipant {
  id: string;
  combatId: string;
  tokenId: string;
  label: string | null;
  initiative: number;
  isActiveTurn: boolean;
}

export interface CombatLogEntry {
  type: 'start' | 'end' | 'turn' | 'add' | 'remove' | 'initiative';
  message: string;
  round: number;
  timestamp: string;
}

export interface CombatTracker {
  id: string;
  campaignId: string;
  mapId: string | null;
  isActive: boolean;
  round: number;
  currentTurnIndex: number;
  participants: CombatParticipant[];
  log: CombatLogEntry[] | null;
  createdAt: string;
}

// ─── Dice ───
export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceRoll {
  id: string;
  userId: string;
  campaignId: string;
  diceType: DiceType;
  modifier: number;
  result: number;
  isPrivate: boolean;
  label: string | null;
  rolledAt: string;
}

export interface DiceRollRequest {
  diceType: DiceType;
  modifier?: number;
  isPrivate?: boolean;
  label?: string;
}

// ─── Chat ───
export type ChatMessageType = 'text' | 'system' | 'dice';

export interface ChatMessage {
  id: string;
  campaignId: string;
  userId: string;
  username: string;
  content: string;
  type: ChatMessageType;
  isPrivate: boolean;
  createdAt: string;
}

// ─── WebSocket Events ───
export type ServerToClientEvents = {
  'room:players': (players: CampaignPlayer[]) => void;
  'map:load': (map: MapData) => void;
  'map:fog:update': (fogData: string) => void;
  'map:grid:update': (grid: UpdateGridRequest) => void;
  'token:create': (token: Token) => void;
  'token:move': (token: { id: string; x: number; y: number }) => void;
  'token:update': (token: Token) => void;
  'token:delete': (tokenId: string) => void;
  'token:select': (tokenId: string | null) => void;
  'combat:start': (combat: CombatTracker) => void;
  'combat:end': () => void;
  'combat:next_turn': (combat: CombatTracker) => void;
  'combat:prev_turn': (combat: CombatTracker) => void;
  'combat:add': (participant: CombatParticipant) => void;
  'combat:remove': (participantId: string) => void;
  'combat:initiative:update': (participant: CombatParticipant) => void;
  'dice:roll': (roll: DiceRoll) => void;
  'dice:roll_private': (roll: DiceRoll) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:whisper': (message: ChatMessage) => void;
};

export type ClientToServerEvents = {
  'room:join': (campaignId: string) => void;
  'room:leave': (campaignId: string) => void;
  'map:fog:update': (data: { campaignId: string; fogData: string }) => void;
  'map:grid:update': (data: { campaignId: string; grid: UpdateGridRequest }) => void;
  'token:create': (data: { campaignId: string; token: CreateTokenRequest }) => void;
  'token:drag': (data: { tokenId: string; x: number; y: number }) => void;
  'token:move': (data: { tokenId: string; x: number; y: number }) => void;
  'token:update': (data: { tokenId: string; updates: UpdateTokenRequest }) => void;
  'token:delete': (tokenId: string) => void;
  'token:select': (tokenId: string | null) => void;
  'combat:start': (campaignId: string) => void;
  'combat:end': (combatId: string) => void;
  'combat:next_turn': (combatId: string) => void;
  'combat:prev_turn': (combatId: string) => void;
  'combat:add': (data: { combatId: string; tokenId: string; initiative: number; label?: string }) => void;
  'combat:remove': (data: { combatId: string; participantId: string }) => void;
  'combat:initiative:update': (data: { participantId: string; initiative: number }) => void;
  'dice:roll': (data: { campaignId: string; request: DiceRollRequest }) => void;
  'chat:message': (data: { campaignId: string; content: string }) => void;
  'chat:whisper': (data: { campaignId: string; content: string }) => void;
};
