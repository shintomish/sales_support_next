'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [sessionReady, setSessionReady]       = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [submitted, setSubmitted]             = useState(false);

  // メール内のリンクから来た場合、URLハッシュにrecoveryトークンが含まれる。
  // supabase クライアント側で detectSessionInUrl=false にしているため、
  // ここで明示的にハッシュをパースして setSession を呼ぶ。
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    const errorDescription = params.get('error_description');

    if (errorDescription) {
      setSessionReady('invalid');
      return;
    }

    if (accessToken && refreshToken && type === 'recovery') {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (!error) {
            setSessionReady('ok');
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            setSessionReady('invalid');
          }
        });
      return;
    }

    // ハッシュが無い/不正: 既にセッションが残っているかフォールバック確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady('ok');
      } else {
        timeoutId = setTimeout(() => {
          setSessionReady((prev) => (prev === 'checking' ? 'invalid' : prev));
        }, 1500);
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください');
      return;
    }
    if (password !== passwordConfirm) {
      setError('パスワードと確認用パスワードが一致しません');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // 再設定後はログアウトしてログインに戻す(再ログインしてもらう)
      await supabase.auth.signOut();
      setSubmitted(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'パスワード更新に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 50%, #1a1f3a 100%)',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 100%)',
          padding: '36px 24px 28px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            borderRadius: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>新しいパスワード</div>
          <div style={{ color: '#94a3b8', fontSize: 11, letterSpacing: 3, marginTop: 4 }}>RESET PASSWORD</div>
        </div>

        <div style={{ padding: '32px 32px 28px' }}>
          {sessionReady === 'checking' && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280', fontSize: 14 }}>
              リンクを検証中...
            </div>
          )}

          {sessionReady === 'invalid' && (
            <div>
              <div style={{
                background: '#fef2f2', color: '#dc2626',
                padding: '14px 16px', borderRadius: 8,
                fontSize: 13, marginBottom: 20,
                border: '1px solid #fecaca',
                lineHeight: 1.6,
              }}>
                リンクが無効または期限切れです。<br />
                お手数ですがもう一度パスワード再設定をお試しください。
              </div>
              <Link href="/forgot-password" style={{
                display: 'block', textAlign: 'center',
                padding: '11px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff', borderRadius: 8,
                textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}>
                再設定リンクをもう一度送信
              </Link>
            </div>
          )}

          {sessionReady === 'ok' && submitted && (
            <div style={{
              background: '#ecfdf5', color: '#065f46',
              padding: '14px 16px', borderRadius: 8,
              fontSize: 13, lineHeight: 1.6,
              border: '1px solid #a7f3d0',
              textAlign: 'center',
            }}>
              パスワードを更新しました。<br />
              ログイン画面に移動します...
            </div>
          )}

          {sessionReady === 'ok' && !submitted && (
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  background: '#fef2f2', color: '#dc2626',
                  padding: '10px 14px', borderRadius: 8,
                  fontSize: 13, marginBottom: 20,
                  border: '1px solid #fecaca',
                }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  新しいパスワード
                </label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="8文字以上" required minLength={8}
                  style={{
                    width: '100%', padding: '11px 12px',
                    border: '1.5px solid #e5e7eb', borderRadius: 8,
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#f97316'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  パスワード(確認)
                </label>
                <input
                  type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="同じパスワードを入力" required minLength={8}
                  style={{
                    width: '100%', padding: '11px 12px',
                    border: '1.5px solid #e5e7eb', borderRadius: 8,
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#f97316'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? '#fdba74' : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(249,115,22,0.4)',
                }}
              >
                {loading ? '更新中...' : 'パスワードを更新'}
              </button>
            </form>
          )}
        </div>

        <div style={{
          textAlign: 'center', padding: '0 24px 20px',
          fontSize: 12, color: '#9ca3af',
        }}>
          © 2026 Aizensolution Co.,Ltd.
        </div>
      </div>
    </div>
  );
}
