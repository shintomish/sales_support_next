// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/axios';

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
    return () => clearInterval(timer);
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
