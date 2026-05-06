import { create } from 'zustand';

interface OnlinePlayer {
  userId: string;
  username: string;
}

interface DiceRollResult {
  id: string;
  userId: string;
  username?: string;
  diceType: string;
  modifier: number;
  result: number;
  label: string | null;
  rolledAt: string;
}

interface ChatMessageItem {
  id: string;
  userId: string;
  username: string;
  content: string;
  type: 'text' | 'system' | 'dice';
  createdAt: string;
}

interface GameState {
  onlinePlayers: OnlinePlayer[];
  selectedTokenId: string | null;
  combatTracker: any | null;
  diceHistory: DiceRollResult[];
  chatMessages: ChatMessageItem[];
  fogData: string | null;

  setOnlinePlayers: (players: OnlinePlayer[]) => void;
  setSelectedTokenId: (id: string | null) => void;
  setCombatTracker: (tracker: any | null) => void;
  addDiceRoll: (roll: DiceRollResult) => void;
  addChatMessage: (msg: ChatMessageItem) => void;
  setFogData: (data: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  onlinePlayers: [],
  selectedTokenId: null,
  combatTracker: null,
  diceHistory: [],
  chatMessages: [],
  fogData: null,

  setOnlinePlayers: (players) => set({ onlinePlayers: players }),
  setSelectedTokenId: (id) => set({ selectedTokenId: id }),
  setCombatTracker: (tracker) => set({ combatTracker: tracker }),
  addDiceRoll: (roll) => set((s) => ({ diceHistory: [roll, ...s.diceHistory].slice(0, 50) })),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setFogData: (data) => set({ fogData: data }),
  reset: () =>
    set({
      onlinePlayers: [],
      selectedTokenId: null,
      combatTracker: null,
      diceHistory: [],
      chatMessages: [],
      fogData: null,
    }),
}));
