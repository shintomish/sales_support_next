'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    // Cookieを削除
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  const menuItems = [
    { label: '名刺管理', path: '/business-cards' },
  ];

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      {/* ロゴ */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-lg font-bold">営業支援システム</h1>
      </div>

      {/* メニュー */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
              pathname.startsWith(item.path)
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* ログアウト */}
      <div className="p-4 border-t border-gray-700">
        <Button
          variant="outline"
          className="w-full text-gray-900"
          onClick={handleLogout}
        >
          ログアウト
        </Button>
      </div>
    </aside>
  );
}
