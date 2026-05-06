import { create } from 'zustand';
import { authApi } from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem('token', res.token);
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  register: async (username, email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.register(username, email, password);
      localStorage.setItem('token', res.token);
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const user = await authApi.me();
      set({ user, token });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null });
    }
  },

  clearError: () => set({ error: null }),
}));
