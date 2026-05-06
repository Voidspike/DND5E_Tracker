import { create } from 'zustand';
import { campaignApi, mapApi, tokenApi, characterApi } from '../services/api';

interface CampaignState {
  campaigns: any[];
  currentCampaign: any | null;
  maps: any[];
  tokens: any[];
  characters: any[];
  loading: boolean;
  error: string | null;

  fetchCampaigns: () => Promise<void>;
  fetchCampaign: (id: string) => Promise<void>;
  createCampaign: (name: string, description?: string) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  joinCampaign: (code: string) => Promise<void>;

  fetchMaps: (campaignId: string) => Promise<void>;
  createMap: (campaignId: string, data: any) => Promise<void>;
  deleteMap: (id: string) => Promise<void>;

  fetchTokens: (mapId: string) => Promise<void>;
  createToken: (data: any) => Promise<void>;
  updateToken: (id: string, data: any) => Promise<void>;
  deleteToken: (id: string) => Promise<void>;

  fetchCharacters: (campaignId: string) => Promise<void>;
  createCharacter: (data: any) => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  currentCampaign: null,
  maps: [],
  tokens: [],
  characters: [],
  loading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const campaigns = await campaignApi.list();
      set({ campaigns, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchCampaign: async (id) => {
    set({ loading: true, error: null });
    try {
      const currentCampaign = await campaignApi.get(id);
      set({ currentCampaign, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createCampaign: async (name, description) => {
    const campaign = await campaignApi.create({ name, description });
    set((s) => ({ campaigns: [campaign, ...s.campaigns] }));
  },

  deleteCampaign: async (id) => {
    await campaignApi.delete(id);
    set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) }));
  },

  joinCampaign: async (code) => {
    try {
      set({ loading: true, error: null });
      await campaignApi.join(code);
      await get().fetchCampaigns();
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchMaps: async (campaignId) => {
    const maps = await mapApi.list(campaignId);
    set({ maps });
  },

  createMap: async (campaignId, data) => {
    const map = await mapApi.create(campaignId, data);
    set((s) => ({ maps: [...s.maps, map] }));
  },

  deleteMap: async (id) => {
    await mapApi.delete(id);
    set((s) => ({ maps: s.maps.filter((m) => m.id !== id) }));
  },

  fetchTokens: async (mapId) => {
    const tokens = await tokenApi.list(mapId);
    set({ tokens });
  },

  createToken: async (data) => {
    const token = await tokenApi.create(data);
    set((s) => ({ tokens: [...s.tokens, token] }));
  },

  updateToken: async (id, data) => {
    const token = await tokenApi.update(id, data);
    set((s) => ({ tokens: s.tokens.map((t) => (t.id === id ? token : t)) }));
  },

  deleteToken: async (id) => {
    await tokenApi.delete(id);
    set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) }));
  },

  fetchCharacters: async (campaignId) => {
    const characters = await characterApi.listByCampaign(campaignId);
    set({ characters });
  },

  createCharacter: async (data) => {
    const character = await characterApi.create(data);
    set((s) => ({ characters: [...s.characters, character] }));
  },
}));
