// src/components/Sidebar.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';
import NotificationToast from '@/components/NotificationToast';
import apiClient from '@/lib/axios';

type SubItem = {
  label: string;
  path: string;
  icon: string;
  badge?: number;
  sesOnly?: boolean;
  superAdminOnly?: boolean;
};

type Entry =
  | { type: 'item'; label: string; path: string; icon: string; badge?: number; sesOnly?: boolean }
  | { type: 'group'; key: string; label: string; icon: string; sesOnly?: boolean; items: SubItem[] };

const LS_SIDEBAR_COLLAPSED = 'sidebar_collapsed';

export default function Sidebar() {
  const router   = useRouter();
  const pathname = usePathname();
  const logout   = useAuthStore((state) => state.logout);
  const user     = useAuthStore((state) => state.user);

  const [collapsedRaw, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = localStorage.getItem(LS_SIDEBAR_COLLAPSED);
    if (s !== null) setCollapsed(s === '1');
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_SIDEBAR_COLLAPSED, collapsedRaw ? '1' : '0');
    }
  }, [collapsedRaw]);

  // md breakpoint (>=768px) 判定 — mobile では collapsed を強制 false にして
  // renderItem/renderGroup を触らずに drawer をフル表示する
  const [isMd, setIsMd] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsMd(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const collapsed = isMd ? collapsedRaw : false;

  // mobile drawer 開閉 (< md でのみ意味を持つ。永続化しない)
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: notifData, refetch: refetchNotifications } = useNotifications();

  // バッジクリック時に該当 doc_type の通知を既読化して、サーバ側で「誰がいつ消したか」を記録
  const markNotificationsRead = async (
    type: 'approved' | 'rejected',
    docType: 'invoice' | 'purchase_order',
    targetPath: string,
  ) => {
    try {
      await apiClient.post('/api/v1/notifications/mark-read', { type, doc_type: docType });
    } catch {
      // 既読化失敗してもナビゲートは継続
    } finally {
      router.push(targetPath);
      refetchNotifications();
    }
  };
  const overdueCount   = notifData?.overdue_tasks_count ?? 0;
  const overdueTasks   = notifData?.overdue_tasks ?? [];
  const pendingApprovalCount = notifData?.pending_approvals_count ?? 0;
  const rejectedInvoiceCount = notifData?.rejected_invoices_count ?? 0;

  // 一般メンバー向け通知 (admin には FE 側でも非表示にする二重防御)
  const isAdminUser = user?.role === 'super_admin' || user?.role === 'tenant_admin';
  const rawRecentlyApproved = notifData?.recently_approved ?? [];
  const recentlyApproved = isAdminUser ? [] : rawRecentlyApproved;
  const recentlyApprovedCount = isAdminUser ? 0 : (notifData?.recently_approved_count ?? 0);

  // doc_type 別カウント（請求書/注文書 メニューバッジに反映）
  const pendingApprovals = notifData?.pending_approvals ?? [];
  const rejectedInvoices = notifData?.rejected_invoices ?? [];

  const invoiceBadgeCount =
    pendingApprovals.filter(r => r.doc_type === 'invoice').length
    + rejectedInvoices.filter(r => r.doc_type === 'invoice').length
    + recentlyApproved.filter(r => r.doc_type === 'invoice').length;

  const purchaseOrderBadgeCount =
    pendingApprovals.filter(r => r.doc_type === 'purchase_order').length
    + rejectedInvoices.filter(r => r.doc_type === 'purchase_order').length
    + recentlyApproved.filter(r => r.doc_type === 'purchase_order').length;
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
      type: 'group', key: 'invoicing', label: '販売管理', icon: '🧾', sesOnly: true,
      items: [
        { label: 'SES台帳',         path: '/ses-contracts',                 icon: '📋' },
        { label: '月別売上',        path: '/monthly-sales',                 icon: '📈' },
        { label: '勤務表',          path: '/timesheets',                    icon: '⏰' },
        // ── 見積書（doc_type=estimate）─────────────────────
        { label: '見積書作成',      path: '/estimates?create=1',            icon: '🧮' },
        { label: '見積書一覧',      path: '/estimates',                     icon: '📝' },
        { label: '見積書送信履歴',  path: '/estimate-send-histories',       icon: '📤' },
        // ── 注文書（doc_type=purchase_order）─────────────
        { label: '注文書作成',      path: '/purchase-orders?create=1',      icon: '🧾' },
        { label: '注文書一覧',      path: '/purchase-orders',               icon: '📦', badge: purchaseOrderBadgeCount },
        { label: '注文書送信履歴',  path: '/purchase-order-send-histories', icon: '📤' },
        // ── 請求書 ─────────────────────────────────────────
        { label: '請求書作成',      path: '/billing-summaries',             icon: '💴' },
        { label: '請求書一覧',      path: '/invoices',                      icon: '📄', badge: invoiceBadgeCount },
        { label: '請求書送信履歴',  path: '/invoice-send-histories',        icon: '📤' },
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
        { label: 'メール',           path: '/emails',                icon: '✉️',  badge: unreadEmails },
        { label: '検索マッチング',   path: '/mail-search',           icon: '🔎', sesOnly: true },
        { label: '案件メール',       path: '/project-mails',         icon: '📨', sesOnly: true },
        { label: '技術者メール',     path: '/engineer-mails',        icon: '👤', sesOnly: true },
        { label: '手動登録 案件',     path: '/project-mails/manual',  icon: '🗂', sesOnly: true },
        { label: '手動登録 技術者',   path: '/engineer-mails/manual', icon: '🗂', sesOnly: true },
      ],
    },
    { type: 'item', label: '配信管理', path: '/deliveries',     icon: '📤', sesOnly: true },
    { type: 'item', label: '名刺管理', path: '/business-cards', icon: '🪪' },
    {
      type: 'group', key: 'settings', label: '設定', icon: '⚙️',
      items: [
        { label: 'メール署名設定',   path: '/settings/email-template', icon: '✍️' },
        { label: '配信テンプレ',     path: '/settings/delivery-templates', icon: '📝', sesOnly: true },
        { label: '請求書発行元設定', path: '/settings/invoice-issuer', icon: '🏢', sesOnly: true },
        { label: '日次レポート配信先', path: '/settings/report-recipients', icon: '📊', sesOnly: true },
        { label: '不具合・要望を送る', path: '/settings/feedback', icon: '💬' },
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
  const isSuperAdmin = user?.role === 'super_admin';
  const adminGroup: Extract<Entry, { type: 'group' }> = {
    type: 'group', key: 'admin', label: '管理', icon: '🛡️',
    items: [
      { label: 'ユーザー管理', path: '/admin/users', icon: '🛡️' },
      { label: 'データ統計',   path: '/admin/stats', icon: '📊' },
      { label: 'ご意見一覧',   path: '/admin/feedback', icon: '💬', superAdminOnly: true },
    ].filter((it) => !it.superAdminOnly || isSuperAdmin) as SubItem[],
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

  // ページ遷移時：mobile drawer を自動 close (PC では効果なし)
  useEffect(() => {
    setMobileOpen(false);
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
        title={collapsed ? it.label : undefined}
        className={`relative w-full text-left rounded-md text-sm transition-colors flex items-center ${
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-4 py-2'
        } ${
          active
            ? 'bg-gray-700 text-white border-l-2 border-blue-400'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
      >
        <span className="flex-shrink-0">{it.icon}</span>
        {!collapsed && (
          <span className="flex-1 min-w-0 whitespace-nowrap truncate">{it.label}</span>
        )}
        {it.badge != null && it.badge > 0 && (
          collapsed ? (
            <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {it.badge}
            </span>
          ) : (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center tabular-nums">
              {it.badge}
            </span>
          )
        )}
      </button>
    );
  };

  // グループの描画（クリックで開閉）
  const renderGroup = (g: Extract<Entry, { type: 'group' }>) => {
    // 折りたたみ時はグループヘッダーを省略し、サブ項目をアイコン縦並びで直接表示
    if (collapsed) {
      return (
        <div key={g.key} className="space-y-1">
          {g.items.map((it) => renderItem(it))}
        </div>
      );
    }
    const isOpen   = openGroups.has(g.key);
    const sumBadge = g.items.reduce((acc, it) => acc + (it.badge ?? 0), 0);
    return (
      <div key={g.key}>
        <button
          onClick={() => toggleGroup(g.key)}
          className="w-full text-left px-4 py-2 rounded-md text-sm transition-colors flex items-center gap-3 text-gray-200 hover:bg-gray-700 hover:text-white"
        >
          <span className="flex-shrink-0">{g.icon}</span>
          <span className="flex-1 min-w-0 whitespace-nowrap truncate font-semibold">{g.label}</span>
          {!isOpen && sumBadge > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {sumBadge}
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

      {/* ハンバーガーボタン (md 未満のみ、drawer 閉時のみ表示) */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="メニューを開く"
          className="md:hidden fixed top-3 left-3 z-[160] w-11 h-11 rounded-md bg-gray-900 text-white shadow-lg flex items-center justify-center text-2xl leading-none hover:bg-gray-800 transition-colors"
        >
          ≡
        </button>
      )}

      {/* mobile drawer backdrop (md 未満のみ表示) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-[140]"
          aria-hidden="true"
        />
      )}

      <aside
        className={
          // md 未満: off-canvas (fixed)、mobileOpen で開閉。
          // md 以上: 既存挙動完全維持 (sticky + collapsed で w-16/w-64)。
          // 幅は mobile は常に w-64 (collapsed は PC 専用概念)。
          `${collapsed ? 'md:w-16' : 'md:w-64'} w-64 ` +
          `transition-all duration-300 h-screen ` +
          `fixed inset-y-0 left-0 z-[150] ` +
          `${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ` +
          `md:sticky md:top-0 md:translate-x-0 md:z-auto md:inset-auto ` +
          `bg-gray-900 text-white flex flex-col`
        }
      >
        {/* ロゴ + トグルボタン */}
        <div className={`${collapsed ? 'p-3' : 'p-6'} border-b border-gray-700 flex items-center justify-between gap-2`}>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold">営業支援システム</h1>
              <p className="text-xs text-blue-400 mt-1 tracking-widest">SALES SUPPORT SYSTEM</p>
            </div>
          )}
          {/* PC: collapse トグル (md+ のみ) */}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
            title={collapsed ? '展開' : '折りたたむ'}
            className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white transition-colors items-center justify-center text-sm"
          >
            {collapsed ? '▶' : '◀'}
          </button>
          {/* mobile: drawer close (< md のみ) */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="メニューを閉じる"
            className="md:hidden flex-shrink-0 w-8 h-8 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* メニュー */}
        <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto`}>
          {!collapsed && (
            <p className="text-xs text-gray-500 px-2 mb-2 tracking-widest">メインメニュー</p>
          )}
          {visibleMenu.map((e) => (e.type === 'item' ? renderItem(e) : renderGroup(e)))}

          {showAdmin && (
            <>
              {!collapsed && (
                <p className="text-xs text-gray-500 px-2 mt-6 mb-2 tracking-widest">管理</p>
              )}
              {renderGroup(adminGroup)}
            </>
          )}
        </nav>

        {/* 期限切れサマリー */}
        {!collapsed && overdueCount > 0 && (
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

        {/* 承認待ちサマリー（テナント管理者以上のみ） */}
        {!collapsed && pendingApprovalCount > 0 && (
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-amber-900/40 border border-amber-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm">📝</span>
              <div>
                <p className="text-xs text-amber-200 font-semibold">承認待ち</p>
                <p className="text-xs text-amber-300">{pendingApprovalCount}件が承認待ち</p>
              </div>
            </div>
            {pendingApprovals.filter(r => r.doc_type === 'invoice').length > 0 && (
              <button
                onClick={() => router.push('/invoices?approval_status=pending')}
                className="mt-2 w-full text-xs text-amber-200 hover:text-white transition-colors text-left"
              >
                請求書 {pendingApprovals.filter(r => r.doc_type === 'invoice').length}件 →
              </button>
            )}
            {pendingApprovals.filter(r => r.doc_type === 'purchase_order').length > 0 && (
              <button
                onClick={() => router.push('/purchase-orders?approval_status=pending')}
                className="mt-1 w-full text-xs text-amber-200 hover:text-white transition-colors text-left"
              >
                注文書 {pendingApprovals.filter(r => r.doc_type === 'purchase_order').length}件 →
              </button>
            )}
          </div>
        )}

        {/* 却下サマリー（一般メンバー向け） */}
        {!collapsed && rejectedInvoiceCount > 0 && (
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-red-900/40 border border-red-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠</span>
              <div>
                <p className="text-xs text-red-300 font-semibold">差戻し</p>
                <p className="text-xs text-red-400">{rejectedInvoiceCount}件が差戻されました</p>
              </div>
            </div>
            {rejectedInvoices.filter(r => r.doc_type === 'invoice').length > 0 && (
              <button
                onClick={() => markNotificationsRead('rejected', 'invoice', '/invoices?approval_status=rejected')}
                className="mt-2 w-full text-xs text-red-300 hover:text-white transition-colors text-left"
              >
                請求書 {rejectedInvoices.filter(r => r.doc_type === 'invoice').length}件 →
              </button>
            )}
            {rejectedInvoices.filter(r => r.doc_type === 'purchase_order').length > 0 && (
              <button
                onClick={() => markNotificationsRead('rejected', 'purchase_order', '/purchase-orders?approval_status=rejected')}
                className="mt-1 w-full text-xs text-red-300 hover:text-white transition-colors text-left"
              >
                注文書 {rejectedInvoices.filter(r => r.doc_type === 'purchase_order').length}件 →
              </button>
            )}
          </div>
        )}

        {/* 直近承認サマリー（一般メンバー向け、7日以内に承認された自身の申請） */}
        {!collapsed && recentlyApprovedCount > 0 && (
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-green-900/40 border border-green-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm">✅</span>
              <div>
                <p className="text-xs text-green-300 font-semibold">承認されました</p>
                <p className="text-xs text-green-400">{recentlyApprovedCount}件 (直近7日)</p>
              </div>
            </div>
            {recentlyApproved.filter(r => r.doc_type === 'invoice').length > 0 && (
              <button
                onClick={() => markNotificationsRead('approved', 'invoice', '/invoices?approval_status=approved')}
                className="mt-2 w-full text-xs text-green-300 hover:text-white transition-colors text-left"
              >
                請求書 {recentlyApproved.filter(r => r.doc_type === 'invoice').length}件 →
              </button>
            )}
            {recentlyApproved.filter(r => r.doc_type === 'purchase_order').length > 0 && (
              <button
                onClick={() => markNotificationsRead('approved', 'purchase_order', '/purchase-orders?approval_status=approved')}
                className="mt-1 w-full text-xs text-green-300 hover:text-white transition-colors text-left"
              >
                注文書 {recentlyApproved.filter(r => r.doc_type === 'purchase_order').length}件 →
              </button>
            )}
          </div>
        )}

        {/* ログアウト */}
        <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-gray-700`}>
          {user && !collapsed && (
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
          {collapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              title={user ? `${user.name} / ログアウト` : 'ログアウト'}
              className="w-full h-9 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center text-base"
            >
              ↩
            </button>
          ) : (
            <Button variant="outline" className="w-full text-gray-900" onClick={handleLogout}>
              ↩ ログアウト
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
