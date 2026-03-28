// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/axios';
import { supabase } from '@/lib/supabase';

export interface OverdueTask {
  id: number;
  title: string;
  priority: '高' | '中' | '低';
  due_date: string;
  customer: { company_name: string } | null;
}

export interface NotificationData {
  overdue_tasks: OverdueTask[];
  overdue_tasks_count: number;
}

export function useNotifications() {
  const [data, setData]       = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/notifications');
      setData(res.data);
    } catch {
      // 通知取得失敗は静かに無視
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    // 5分ごとに再取得
    const timer = setInterval(fetch, 5 * 60 * 1000);

    // タスク更新時に即時再取得（期限日変更でバッジを即反映）
    const channel = supabase
      .channel('notifications-tasks')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        () => { fetch(); }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
