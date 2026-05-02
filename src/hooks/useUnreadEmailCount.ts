'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import apiClient from '@/lib/axios';

export function useUnreadEmailCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/emails/unread-count');
      setUnreadCount(res.data.count ?? 0);
    } catch {
      // 取得失敗時は0のまま
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Realtime購読：新着メールのINSERTのみ検知（UPDATEは無限ループになるため除外）
    const channel = supabase
      .channel('sidebar-emails-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emails' },
        () => { fetchUnreadCount(); }
      )
      .subscribe();

    // 15分ごとに再取得（取りこぼし防止のフォールバック）
    const intervalId = setInterval(fetchUnreadCount, 15 * 60 * 1000);

    // 全件既読ボタン押下時のカスタムイベントを受信
    const handleMarkAllRead = () => { fetchUnreadCount(); };
    window.addEventListener('emails:mark-all-read', handleMarkAllRead);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
      window.removeEventListener('emails:mark-all-read', handleMarkAllRead);
    };
  }, [fetchUnreadCount]);

  return { unreadCount, fetchUnreadCount };
}