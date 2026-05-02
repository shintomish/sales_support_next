// src/components/Sidebar.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';
import NotificationToast from '@/components/NotificationToast';

type SubItem = {
  label: string;
  path: string;
  icon: string;
  badge?: number;
  sesOnly?: boolean;
};

type Entry =
  | { type: 'item'; label: string; path: string; icon: string; badge?: number; sesOnly?: boolean }
  | { type: 'group'; key: string; label: string; icon: string; sesOnly?: boolean; items: SubItem[] };

export default function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const logout   = useAuthStore((state) => state.logout);
  const user     = useAuthStore((state) => state.user);

  const { data: notifData } = useNotifications();
  const overdueCount  = notifData?.overdue_tasks_count ?? 0;
  const overdueTasks  = notifData?.overdue_tasks ?? [];
  const { unreadCount: unreadEmails } = useUnreadEmailCount();

  const sesEnabled = !!user?.tenant?.ses_enabled;

  const handleLogout = async () => {
    try { await logout(); } catch {}
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  // メニュー定義
  const menu: Entry[] = [
    { type: 'item', label: 'ダッシュボード', path: '/dashboard', icon: '⊞' },
    {
      type: 'group', key: 'crm', label: 'CRM', icon: '📊',
      items: [
        { label: '顧客管理',   path: '/customers',  icon: '👥' },
        { label: '担当者管理', path: '/contacts',   icon: '👤' },
        { label: '商談管理',   path: '/deals',      icon: '💼' },
        { label: '活動履歴',   path: '/activities', icon: '🕐' },
        { label: 'タスク管理', path: '/tasks',      icon: '☑',  badge: overdueCount },
      ],
    },
    {
      type: 'group', key: 'invoicing', label: '請求書管理', icon: '🧾', sesOnly: true,
      items: [
        { label: 'SES台帳',    path: '/ses-contracts',     icon: '📋' },
        { label: '勤務表',     path: '/timesheets',        icon: '⏰' },
        { label: '請求書一覧', path: '/invoices',          icon: '📄' },
        { label: '請求集計',   path: '/billing-summaries', icon: '💴' },
      ],
    },
    {
      type: 'group', key: 'market', label: 'マーケット', icon: '🔍', sesOnly: true,
      items: [
        { label: '案件',     path: '/public-projects', icon: '🔍'    },
        { label: '技術者',   path: '/engineers',       icon: '🧑‍💻' },
      ],
    },
    {
      type: 'group', key: 'mails', label: 'メール', icon: '✉️',
      items: [
        { label: 'メール',       path: '/emails',         icon: '✉️',  badge: unreadEmails },
        { label: '案件メール',   path: '/project-mails',  icon: '📨', sesOnly: true },
        { label: '技術者メール', path: '/engineer-mails', icon: '👤', sesOnly: true },
      ],
    },
    { type: 'item', label: '配信管理', path: '/deliveries',     icon: '📤', sesOnly: true },
    { type: 'item', label: '名刺管理', path: '/business-cards', icon: '🪪' },
    {
      type: 'group', key: 'settings', label: '設定', icon: '⚙️',
      items: [
        { label: 'メール署名設定',   path: '/settings/email-template', icon: '✍️' },
        { label: '請求書発行元設定', path: '/settings/invoice-issuer', icon: '🏢', sesOnly: true },
      ],
    },
  ];

  // SES フィルタ適用
  const visibleMenu: Entry[] = menu
    .filter((e) => !e.sesOnly || sesEnabled)
    .map((e) => {
      if (e.type === 'group') {
        const items = e.items.filter((it) => !it.sesOnly || sesEnabled);
        return { ...e, items };
      }
      return e;
    })
    .filter((e) => e.type === 'item' || (e.type === 'group' && e.items.length > 0));

  // 管理メニュー
  const showAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin';
  const adminGroup: Extract<Entry, { type: 'group' }> = {
    type: 'group', key: 'admin', label: '管理', icon: '🛡️',
    items: [
      { label: 'ユーザー管理', path: '/admin/users', icon: '🛡️' },
      { label: 'データ統計',   path: '/admin/stats', icon: '📊' },
    ],
  };

  // 現在パスを含むグループを返す
  const findGroupForPath = (entries: Entry[], path: string): string | null => {
    for (const e of entries) {
      if (e.type === 'group' && e.items.some((it) => path.startsWith(it.path))) return e.key;
    }
    return null;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const k = findGroupForPath([...visibleMenu, adminGroup], pathname);
    if (k) set.add(k);
    return set;
  });

  // ページ遷移時：該当グループを自動展開（既に開いているものは維持）
  useEffect(() => {
    const k = findGroupForPath([...visibleMenu, adminGroup], pathname);
    if (k) {
      setOpenGroups((prev) => {
        if (prev.has(k)) return prev;
        const next = new Set(prev);
        next.add(k);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 単独項目／サブ項目の描画
  const renderItem = (it: { label: string; path: string; icon: string; badge?: number }) => {
    const active = pathname.startsWith(it.path);
    return (
      <button
        key={it.path}
        onClick={() => router.push(it.path)}
        className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors flex items-center gap-3 ${
          active
            ? 'bg-gray-700 text-white border-l-2 border-blue-400'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
      >
        <span>{it.icon}</span>
        <span className="flex-1">{it.label}</span>
        {it.badge != null && it.badge > 0 && (
          <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {it.badge > 99 ? '99+' : it.badge}
          </span>
        )}
      </button>
    );
  };

  // グループの描画（クリックで開閉）
  const renderGroup = (g: Extract<Entry, { type: 'group' }>) => {
    const isOpen   = openGroups.has(g.key);
    const sumBadge = g.items.reduce((acc, it) => acc + (it.badge ?? 0), 0);
    return (
      <div key={g.key}>
        <button
          onClick={() => toggleGroup(g.key)}
          className="w-full text-left px-4 py-2 rounded-md text-sm transition-colors flex items-center gap-3 text-gray-200 hover:bg-gray-700 hover:text-white"
        >
          <span>{g.icon}</span>
          <span className="flex-1 font-semibold">{g.label}</span>
          {!isOpen && sumBadge > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {sumBadge > 99 ? '99+' : sumBadge}
            </span>
          )}
          <span className="text-gray-500 text-xs">{isOpen ? '▾' : '▸'}</span>
        </button>
        {isOpen && (
          <div className="ml-2 mt-1 mb-2 border-l border-gray-700 pl-2 space-y-1">
            {g.items.map((it) => renderItem(it))}
          </div>
        )}
      </div>
    );
  };

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
          {visibleMenu.map((e) => (e.type === 'item' ? renderItem(e) : renderGroup(e)))}

          {showAdmin && (
            <>
              <p className="text-xs text-gray-500 px-2 mt-6 mb-2 tracking-widest">管理</p>
              {renderGroup(adminGroup)}
            </>
          )}
        </nav>

        {/* 期限切れサマリー */}
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
