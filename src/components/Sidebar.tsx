// src/components/Sidebar.tsx
'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await logout();
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  const menuItems = [
    { label: 'ダッシュボード', path: '/dashboard',       icon: '⊞' },
    { label: '顧客管理',       path: '/customers',       icon: '👥' },
    { label: '担当者管理',     path: '/contacts',        icon: '👤' },
    { label: '商談管理',       path: '/deals',           icon: '💼' },
    { label: '活動履歴',       path: '/activities',      icon: '🕐' },
    { label: 'タスク管理',     path: '/tasks',           icon: '☑' },
    { label: '名刺管理',       path: '/business-cards',  icon: '🪪' },
  ];

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      {/* ロゴ */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-lg font-bold">営業支援システム</h1>
        <p className="text-xs text-blue-400 mt-1 tracking-widest">SALES SUPPORT SYSTEM</p>
      </div>

      {/* メニュー */}
      <nav className="flex-1 p-4 space-y-1">
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
            {item.label}
          </button>
        ))}
      </nav>

      {/* ログアウト */}
      <div className="p-4 border-t border-gray-700">
        {/* ★ ユーザー名追加 */}
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
        <Button
          variant="outline"
          className="w-full text-gray-900"
          onClick={handleLogout}
        >
          ↩ ログアウト
        </Button>
      </div>
    </aside>
  );
}
