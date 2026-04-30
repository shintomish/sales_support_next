'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import RealtimeToast from '@/components/RealtimeToast';
import { useAuthStore } from '@/store/authStore';

const NO_SIDEBAR_PATHS = ['/login', '/forgot-password', '/reset-password'];

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { fetchUser, user, loading } = useAuthStore();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!loading && user && pathname === '/login') {
      router.push('/dashboard');
    }
    if (!loading && !user && !NO_SIDEBAR_PATHS.includes(pathname)) {
      router.push('/login');
    }
  }, [loading, user, pathname, router]);

  // ページ遷移時に main のスクロール位置をリセット
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const showSidebar = !NO_SIDEBAR_PATHS.includes(pathname);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main ref={mainRef} className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
      <RealtimeToast />
    </div>
  );
}
