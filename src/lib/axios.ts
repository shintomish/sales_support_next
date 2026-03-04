import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: false,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// リクエストのたびにCookieからトークンを自動セット
apiClient.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/auth_token=([^;]+)/);
    if (match) {
      config.headers['Authorization'] = `Bearer ${match[1]}`;
    }
  }
  return config;
});

export const getCsrfToken = async () => {
  await apiClient.get('/sanctum/csrf-cookie');
};

export default apiClient;
