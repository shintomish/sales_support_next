import { create } from 'zustand';
import apiClient from '@/lib/axios';
import { supabase } from '@/lib/supabase';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  tenant_id: number;
  tenant?: {
    id: number;
    name: string;
    slug: string;
    plan: string;
    ses_enabled: boolean;
  };
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    // Supabase Authでログイン
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    // LaravelからユーザープロフィールをJWT付きで取得
    const res = await apiClient.get('/api/v1/me');
    set({ user: res.data });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ user: null, loading: false });
        return;
      }
      const res = await apiClient.get('/api/v1/me');
      set({ user: res.data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
