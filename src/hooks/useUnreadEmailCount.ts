'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

export function useUnreadEmailCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const tenantId = useAuthStore((s) => s.user?.tenant_id);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/emails/unread-count');
      setUnreadCount(res.data.count ?? 0);
    } catch {
      // 取得失敗時は0のまま
    }
  }, []);

  useEffect(() => {
    // マウント時の初回 fetch。fetchUnreadCount は useCallback で安定参照。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnreadCount();

    // 15分ごとに再取得（取りこぼし防止のフォールバック）
    const intervalId = setInterval(fetchUnreadCount, 15 * 60 * 1000);
    // 全件既読ボタン押下時のカスタムイベントを受信
    const handleMarkAllRead = () => { fetchUnreadCount(); };
    window.addEventListener('emails:mark-all-read', handleMarkAllRead);

    // Realtime購読: 新着メールのINSERTのみ検知 (UPDATEは無限ループになるため除外)。
    // channel 名と postgres_changes filter に tenant_id を含めることで他テナントの
    // INSERT 通知で fetchUnreadCount が走るのを防ぐ (docs/730 §Medium #17)。
    // tenant_id 未確定 (ログイン直後) なら購読しない。
    const channel = tenantId
      ? supabase
          .channel(`sidebar-emails-unread:${tenantId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'emails', filter: `tenant_id=eq.${tenantId}` },
            () => { fetchUnreadCount(); }
          )
          .subscribe()
      : null;

    return () => {
      if (channel) supabase.removeChannel(channel);
      clearInterval(intervalId);
      window.removeEventListener('emails:mark-all-read', handleMarkAllRead);
    };
  }, [fetchUnreadCount, tenantId]);

  return { unreadCount, fetchUnreadCount };
}
