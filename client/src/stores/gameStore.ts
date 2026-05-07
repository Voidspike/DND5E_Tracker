import { create } from 'zustand';
import type {
  CampaignPlayer,
  CombatTracker,
  CombatParticipant,
  DiceRoll,
  ChatMessage,
} from '@dnd/shared';

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
  type: 'text' | 'system' | 'dice' | 'whisper';
  isPrivate?: boolean;
  note?: string;
  createdAt: string;
}

interface GameState {
  onlinePlayers: OnlinePlayer[];
  selectedTokenId: string | null;
  combatTracker: CombatTracker | null;
  diceHistory: DiceRollResult[];
  chatMessages: ChatMessageItem[];
  fogData: string | null;

  setOnlinePlayers: (players: OnlinePlayer[]) => void;
  setSelectedTokenId: (id: string | null) => void;
  setCombatTracker: (tracker: CombatTracker | null) => void;
  addCombatParticipant: (participant: CombatParticipant) => void;
  removeCombatParticipant: (participantId: string) => void;
  updateCombatParticipant: (participant: CombatParticipant) => void;
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
  addCombatParticipant: (participant) =>
    set((s) => {
      if (!s.combatTracker) return s;
      return {
        combatTracker: {
          ...s.combatTracker,
          participants: [...s.combatTracker.participants, participant],
        },
      };
    }),
  removeCombatParticipant: (participantId) =>
    set((s) => {
      if (!s.combatTracker) return s;
      return {
        combatTracker: {
          ...s.combatTracker,
          participants: s.combatTracker.participants.filter(
            (p) => p.id !== participantId
          ),
        },
      };
    }),
  updateCombatParticipant: (updated) =>
    set((s) => {
      if (!s.combatTracker) return s;
      return {
        combatTracker: {
          ...s.combatTracker,
          participants: s.combatTracker.participants.map((p) =>
            p.id === updated.id ? { ...p, ...updated } : p
          ),
        },
      };
    }),
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
