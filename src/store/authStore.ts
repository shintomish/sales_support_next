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
    feature_requirement_matching?: boolean;
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    // signInWithPassword 直後は getSession() がまだ新セッションを返さない
    // race condition があるため、取得直後の access_token を明示的に付与する
    const res = await apiClient.get('/api/v1/me', {
      headers: { Authorization: `Bearer ${data.session?.access_token}` },
    });
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
