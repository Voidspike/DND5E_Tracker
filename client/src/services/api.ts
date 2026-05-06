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
    throw new Error(err.error || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ───
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (username: string, email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
  me: () => request<any>('/auth/me'),
};

// ─── Campaigns ───
export const campaignApi = {
  list: () => request<any[]>('/campaigns'),
  get: (id: string) => request<any>(`/campaigns/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<any>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/campaigns/${id}`, { method: 'DELETE' }),
  join: (code: string) => request<any>(`/campaigns/join/${code}`, { method: 'POST' }),
  leave: (id: string) => request<any>(`/campaigns/${id}/leave`, { method: 'POST' }),
  kickPlayer: (id: string, userId: string) =>
    request<void>(`/campaigns/${id}/players/${userId}`, { method: 'DELETE' }),
};

// ─── Maps ───
export const mapApi = {
  list: (campaignId: string) => request<any[]>(`/maps/campaign/${campaignId}`),
  create: (campaignId: string, data: any) =>
    request<any>(`/maps/campaign/${campaignId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/maps/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/maps/${id}`, { method: 'DELETE' }),
};

// ─── Tokens ───
export const tokenApi = {
  list: (mapId: string) => request<any[]>(`/tokens/map/${mapId}`),
  create: (data: any) => request<any>('/tokens', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/tokens/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tokens/${id}`, { method: 'DELETE' }),
};

// ─── Characters ───
export const characterApi = {
  listByCampaign: (campaignId: string) => request<any[]>(`/characters/campaign/${campaignId}`),
  listMine: () => request<any[]>('/characters/me'),
  create: (data: any) =>
    request<any>('/characters', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/characters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
