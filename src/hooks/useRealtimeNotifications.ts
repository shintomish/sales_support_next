import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export interface RealtimeNotification {
  id: string;
  type: 'task' | 'deal' | 'activity' | 'business_card';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  message: string;
  timestamp: Date;
}

type NotificationCallback = (notification: RealtimeNotification) => void;

export function useRealtimeNotifications(onNotification: NotificationCallback) {
  const { user } = useAuthStore();

  const getTaskMessage = useCallback((event: string, record: Record<string, unknown>) => {
    if (event === 'INSERT') return `新しいタスク「${record.title}」が追加されました`;
    if (event === 'UPDATE') {
      if (record.status) return `タスク「${record.title}」のステータスが「${record.status}」に変更されました`;
      return `タスク「${record.title}」が更新されました`;
    }
    return `タスク「${record.title}」が削除されました`;
  }, []);

  const getDealMessage = useCallback((event: string, record: Record<string, unknown>) => {
    if (event === 'INSERT') return `新しい商談「${record.title}」が登録されました`;
    if (event === 'UPDATE') {
      if (record.status === '成約') return `🎉 商談「${record.title}」が成約しました！`;
      if (record.status === '失注') return `商談「${record.title}」が失注になりました`;
      return `商談「${record.title}」のステータスが「${record.status}」に変更されました`;
    }
    return `商談「${record.title}」が削除されました`;
  }, []);

  const getActivityMessage = useCallback((event: string, record: Record<string, unknown>) => {
    if (event === 'INSERT') return `新しい活動「${record.subject}」が記録されました`;
    if (event === 'UPDATE') return `活動「${record.subject}」が更新されました`;
    return `活動「${record.subject}」が削除されました`;
  }, []);

  const getBusinessCardMessage = useCallback((event: string, _record: Record<string, unknown>) => {
    if (event === 'INSERT') return `📇 名刺のアップロードが完了しました`;
    if (event === 'UPDATE') return `名刺情報が更新されました`;
    return `名刺が削除されました`;
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`realtime:tenant:${user.tenant_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `tenant_id=eq.${user.tenant_id}`,
      }, (payload) => {
        onNotification({
          id: crypto.randomUUID(),
          type: 'task',
          event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          message: getTaskMessage(payload.eventType, (payload.new || payload.old) as Record<string, unknown>),
          timestamp: new Date(),
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deals',
        filter: `tenant_id=eq.${user.tenant_id}`,
      }, (payload) => {
        onNotification({
          id: crypto.randomUUID(),
          type: 'deal',
          event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          message: getDealMessage(payload.eventType, (payload.new || payload.old) as Record<string, unknown>),
          timestamp: new Date(),
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activities',
        filter: `tenant_id=eq.${user.tenant_id}`,
      }, (payload) => {
        onNotification({
          id: crypto.randomUUID(),
          type: 'activity',
          event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          message: getActivityMessage(payload.eventType, (payload.new || payload.old) as Record<string, unknown>),
          timestamp: new Date(),
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'business_cards',
        filter: `tenant_id=eq.${user.tenant_id}`,
      }, (payload) => {
        onNotification({
          id: crypto.randomUUID(),
          type: 'business_card',
          event: 'INSERT',
          message: getBusinessCardMessage('INSERT', payload.new as Record<string, unknown>),
          timestamp: new Date(),
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onNotification, getTaskMessage, getDealMessage, getActivityMessage, getBusinessCardMessage]);
}
