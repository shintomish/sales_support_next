import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 遅延初期化版 Supabase クライアント。
 *
 * 以前はモジュール読込時に createClient(url, key) を即評価していたため、
 * env (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY) が無いビルド環境
 * (例: Vercel の Preview スコープに env 未設定) で
 * 「supabaseKey is required」を投げ、next build が落ちていた。
 *
 * Proxy で実クライアント生成を初回プロパティアクセス時まで遅らせることで、
 * ビルド時のモジュール評価では生成せず、実行時 (env が揃う場面) にのみ生成する。
 * 呼び出し側は従来どおり `import { supabase } from '@/lib/supabase'` でよい。
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    );
  }

  _client = createClient(url, key, {
    auth: {
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
