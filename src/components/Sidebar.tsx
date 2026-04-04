// src/components/Sidebar.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';
import NotificationToast from '@/components/NotificationToast';

export default function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const logout   = useAuthStore((state) => state.logout);
  const user     = useAuthStore((state) => state.user);

  const { data: notifData } = useNotifications();
  const overdueCount  = notifData?.overdue_tasks_count ?? 0;
  const overdueTasks  = notifData?.overdue_tasks ?? [];
  const { unreadCount: unreadEmails } = useUnreadEmailCount();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  const allMenuItems = [
    { label: 'ダッシュボード', path: '/dashboard',      icon: '⊞',  badge: 0,            sesOnly: false },
    { label: '顧客管理',       path: '/customers',      icon: '👥',  badge: 0,            sesOnly: false },
    { label: '担当者管理',     path: '/contacts',       icon: '👤',  badge: 0,            sesOnly: false },
    { label: '商談管理',       path: '/deals',          icon: '💼',  badge: 0,            sesOnly: false },
    { label: 'SES台帳',        path: '/ses-contracts',   icon: '📋',  badge: 0,            sesOnly: true  },
    { label: '技術者管理',     path: '/engineers',       icon: '🧑‍💻', badge: 0,            sesOnly: true  },
    { label: '案件マーケット', path: '/public-projects', icon: '🔍',  badge: 0,            sesOnly: true  },
    { label: '案件メール',     path: '/project-mails',   icon: '📨',  badge: 0,            sesOnly: true  },
    { label: '活動履歴',       path: '/activities',      icon: '🕐',  badge: 0,            sesOnly: false },
    { label: 'タスク管理',     path: '/tasks',          icon: '☑',   badge: overdueCount, sesOnly: false },
    { label: '名刺管理',       path: '/business-cards', icon: '🪪',  badge: 0,            sesOnly: false },
    { label: 'メール',         path: '/emails',         icon: '✉️',  badge: unreadEmails, sesOnly: false },
  ];

  const menuItems = allMenuItems.filter(
    (item) => !item.sesOnly || user?.tenant?.ses_enabled
  );

  return (
    <>
      {/* トースト通知 */}
      <NotificationToast tasks={overdueTasks} />

      <aside className="w-64 h-screen sticky top-0 bg-gray-900 text-white flex flex-col">
        {/* ロゴ */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-lg font-bold">営業支援システム</h1>
          <p className="text-xs text-blue-400 mt-1 tracking-widest">SALES SUPPORT SYSTEM</p>
        </div>

        {/* メニュー */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-xs text-gray-500 px-2 mb-2 tracking-widest">メインメニュー</p>
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors flex items-center gap-3 ${
                pathname.startsWith(item.path)
                  ? 'bg-gray-700 text-white border-l-2 border-blue-400'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 期限切れサマリー（件数がある場合のみ表示） */}
        {overdueCount > 0 && (
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-red-900/40 border border-red-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔴</span>
              <div>
                <p className="text-xs text-red-300 font-semibold">期限切れタスク</p>
                <p className="text-xs text-red-400">{overdueCount}件が期限超過</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/tasks?due_filter=overdue')}
              className="mt-2 w-full text-xs text-red-300 hover:text-white transition-colors text-left"
            >
              確認する →
            </button>
          </div>
        )}

        {/* ログアウト */}
        <div className="p-4 border-t border-gray-700">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full text-gray-900" onClick={handleLogout}>
            ↩ ログアウト
          </Button>
        </div>
      </aside>
    </>
  );
}
