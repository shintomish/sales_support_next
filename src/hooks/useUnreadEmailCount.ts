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

    // Realtime購読：新着・既読更新時に未読数を再取得
    const channel = supabase
      .channel('sidebar-emails-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emails' },
        () => { fetchUnreadCount(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emails' },
        () => { fetchUnreadCount(); }
      )
      .subscribe();

    // 全件既読ボタン押下時のカスタムイベントを受信
    const handleMarkAllRead = () => { fetchUnreadCount(); };
    window.addEventListener('emails:mark-all-read', handleMarkAllRead);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('emails:mark-all-read', handleMarkAllRead);
    };
  }, [fetchUnreadCount]);

  return { unreadCount, fetchUnreadCount };
}
