import axios from 'axios';
import { supabase } from '@/lib/supabase';

const apiClient = axios.create({
  baseURL: typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL,
  withCredentials: false,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// リクエストのたびにSupabaseセッションからJWTを自動セット
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return config;
});

// 401レスポンス時にトークンリフレッシュを試みてリトライ
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && data.session?.access_token) {
          originalRequest.headers['Authorization'] = `Bearer ${data.session.access_token}`;
          return apiClient(originalRequest);
        }
      } catch {}
    }
    return Promise.reject(error);
  }
);

export default apiClient;
