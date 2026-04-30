'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      // 列挙対策: 失敗してもメッセージは曖昧に
      setSubmitted(true);
      console.error(err);
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
        {/* ヘッダー */}
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
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>パスワード再設定</div>
          <div style={{ color: '#94a3b8', fontSize: 11, letterSpacing: 3, marginTop: 4 }}>FORGOT PASSWORD</div>
        </div>

        {/* フォーム */}
        <div style={{ padding: '32px 32px 28px' }}>
          {submitted ? (
            <div>
              <div style={{
                background: '#ecfdf5', color: '#065f46',
                padding: '14px 16px', borderRadius: 8,
                fontSize: 13, marginBottom: 20,
                border: '1px solid #a7f3d0',
                lineHeight: 1.6,
              }}>
                ご入力のメールアドレス宛に再設定リンクを送信しました。<br />
                メール内のリンクから新しいパスワードを設定してください。<br />
                （該当アドレスが登録されていない場合はメールが届きません）
              </div>
              <Link href="/login" style={{
                display: 'block', textAlign: 'center',
                padding: '11px', background: '#f3f4f6',
                color: '#374151', borderRadius: 8,
                textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}>
                ログイン画面に戻る
              </Link>
            </div>
          ) : (
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

              <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                登録済みのメールアドレスを入力してください。<br />
                パスワード再設定リンクをお送りします。
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  メールアドレス
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: '#f97316',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </span>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com" required
                    style={{
                      width: '100%', padding: '11px 12px 11px 38px',
                      border: '1.5px solid #e5e7eb', borderRadius: 8,
                      fontSize: 14, outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#f97316'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? '#fdba74' : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(249,115,22,0.4)',
                  transition: 'opacity 0.2s',
                  marginBottom: 16,
                }}
              >
                {loading ? '送信中...' : '再設定リンクを送信'}
              </button>

              <Link href="/login" style={{
                display: 'block', textAlign: 'center',
                fontSize: 13, color: '#6b7280', textDecoration: 'none',
              }}>
                ← ログイン画面に戻る
              </Link>
            </form>
          )}
        </div>

        {/* フッター */}
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
