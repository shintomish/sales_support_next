'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRealtimeNotifications, RealtimeNotification } from '@/hooks/useRealtimeNotifications';

const TYPE_ICON: Record<string, string> = {
  task: '✅',
  deal: '💼',
  activity: '📋',
  business_card: '📇',
};

const TYPE_COLOR: Record<string, string> = {
  task: '#3b82f6',
  deal: '#f97316',
  activity: '#8b5cf6',
  business_card: '#10b981',
};

export default function RealtimeToast() {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  const handleNotification = useCallback((notification: RealtimeNotification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 5));
    // 5秒後に自動削除
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  useRealtimeNotifications(handleNotification);

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 360,
    }}>
      {notifications.map((n) => (
        <div key={n.id} style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          borderLeft: `4px solid ${TYPE_COLOR[n.type]}`,
          animation: 'slideIn 0.3s ease',
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{TYPE_ICON[n.type]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: '#1f2937',
              fontWeight: 500,
              lineHeight: 1.4,
            }}>
              {n.message}
            </p>
            <p style={{
              margin: '4px 0 0',
              fontSize: 11,
              color: '#9ca3af',
            }}>
              {n.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: 16,
              padding: 0,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >×</button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
