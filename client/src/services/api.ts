import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Campaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  MapData,
  CreateMapRequest,
  UpdateGridRequest,
  Token,
  CreateTokenRequest,
  UpdateTokenRequest,
  Character,
  CreateCharacterRequest,
  User,
} from '@dnd/shared';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const detail = err.details ? ': ' + JSON.stringify(err.details) : '';
    throw new Error((err.error || 'Request failed') + detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ───
export const authApi = {
  login: (email: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password } as LoginRequest),
    }),
  register: (username: string, email: string, password: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password } as RegisterRequest),
    }),
  me: (): Promise<User> => request<User>('/auth/me'),
};

// ─── Campaigns ───
export const campaignApi = {
  list: (): Promise<Campaign[]> => request<Campaign[]>('/campaigns'),
  get: (id: string): Promise<Campaign> => request<Campaign>(`/campaigns/${id}`),
  create: (data: CreateCampaignRequest): Promise<Campaign> =>
    request<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateCampaignRequest): Promise<Campaign> =>
    request<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> => request<void>(`/campaigns/${id}`, { method: 'DELETE' }),
  join: (code: string): Promise<void> => request<void>(`/campaigns/join/${code}`, { method: 'POST' }),
  leave: (id: string): Promise<void> => request<void>(`/campaigns/${id}/leave`, { method: 'POST' }),
  kickPlayer: (id: string, userId: string): Promise<void> =>
    request<void>(`/campaigns/${id}/players/${userId}`, { method: 'DELETE' }),
};

// ─── Maps ───
export const mapApi = {
  list: (campaignId: string): Promise<MapData[]> => request<MapData[]>(`/maps/campaign/${campaignId}`),
  create: (campaignId: string, data: CreateMapRequest): Promise<MapData> =>
    request<MapData>(`/maps/campaign/${campaignId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateGridRequest): Promise<MapData> =>
    request<MapData>(`/maps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> => request<void>(`/maps/${id}`, { method: 'DELETE' }),
};

// ─── Tokens ───
export const tokenApi = {
  list: (mapId: string): Promise<Token[]> => request<Token[]>(`/tokens/map/${mapId}`),
  listByCampaign: (campaignId: string): Promise<Token[]> => request<Token[]>(`/tokens/campaign/${campaignId}`),
  create: (data: CreateTokenRequest): Promise<Token> =>
    request<Token>('/tokens', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateTokenRequest): Promise<Token> =>
    request<Token>(`/tokens/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> => request<void>(`/tokens/${id}`, { method: 'DELETE' }),
};

// ─── Combat ───
export const combatApi = {
  getActive: (mapId: string): Promise<any> => request<any>(`/combat/map/${mapId}/active`),
  getHistory: (mapId: string): Promise<any[]> => request<any[]>(`/combat/map/${mapId}/history`),
};

// ─── Characters ───
export const characterApi = {
  listByCampaign: (campaignId: string): Promise<Character[]> =>
    request<Character[]>(`/characters/campaign/${campaignId}`),
  listMine: (): Promise<Character[]> => request<Character[]>('/characters/me'),
  create: (data: CreateCharacterRequest): Promise<Character> =>
    request<Character>('/characters', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Character>): Promise<Character> =>
    request<Character>(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string): Promise<void> => request<void>(`/characters/${id}`, { method: 'DELETE' }),
};
