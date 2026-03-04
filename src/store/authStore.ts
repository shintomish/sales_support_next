import { create } from 'zustand';
import apiClient from '@/lib/axios';

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

// Cookieからトークンを取得するヘルパー
const getTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  loading: true,

  login: async (email, password) => {
    const res = await apiClient.post('/api/v1/login', { email, password });
    const { token, user } = res.data;

    // Cookieとaxiosヘッダーにトークンをセット
    document.cookie = `auth_token=${token}; path=/`;
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    set({ user, token });
  },

  logout: async () => {
    await apiClient.post('/api/v1/logout');
    document.cookie = 'auth_token=; path=/; max-age=0'; // Cookie削除
    delete apiClient.defaults.headers.common['Authorization'];
    set({ user: null, token: null });
  },

  fetchUser: async () => {
    try {
      // CookieからトークンをリストアしてAPIを叩く
      const token = getTokenFromCookie();
      if (!token) {
        set({ user: null, loading: false });
        return;
      }
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await apiClient.get('/api/v1/me');
      set({ user: res.data, token, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
