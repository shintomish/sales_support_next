import { create } from 'zustand';
import apiClient, { getCsrfToken } from '@/lib/axios';

	interface User {
	  id: number;
	  name: string;
	  email: string;
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
	    await getCsrfToken();
	    try {
	        await apiClient.post('/login', { email, password }, {
	            maxRedirects: 0,
	            validateStatus: (status) => status === 302 || status === 200,
	        });
	    } catch {
	        // 302リダイレクトは無視
	    }
	    const res = await apiClient.get('/api/v1/me');
	    set({ user: res.data });
	},

	logout: async () => {
	    await apiClient.post('/logout');
	    set({ user: null });
	},

	fetchUser: async () => {
	    try {
	        const res = await apiClient.get('/api/v1/me');
	        set({ user: res.data, loading: false });
	    } catch {
	        set({ user: null, loading: false });
	    }
	},
}));

