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

  // フィードバック時に「不具合が起きた画面 URL」をプリフィルするため、直前訪問ページを記録
  // /settings/feedback 自身は記録対象外（自分自身が記録されないようにする）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname.startsWith('/settings/feedback')) return;
    if (NO_SIDEBAR_PATHS.includes(pathname)) return;
    try {
      sessionStorage.setItem('lastVisitedUrl', `${window.location.origin}${pathname}`);
    } catch {}
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
