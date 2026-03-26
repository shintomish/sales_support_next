'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import apiClient from '@/lib/axios';

export function useUnreadEmailCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiClient.get('/api/v1/emails/unread-count');
      setUnreadCount(res.data.count ?? 0);
    } catch {
      // 取得失敗時は0のまま
    }
  };

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

    return () => { supabase.removeChannel(channel); };
  }, []);

  return unreadCount;
}
