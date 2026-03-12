// src/components/NotificationToast.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OverdueTask } from '@/hooks/useNotifications';

interface Props {
  tasks: OverdueTask[];
}

export default function NotificationToast({ tasks }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (tasks.length > 0 && !dismissed) {
      // 少し遅らせて表示
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tasks.length, dismissed]);

  // 8秒後に自動で消える
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible || tasks.length === 0) return null;

  const shown = tasks.slice(0, 3); // 最大3件表示

  return (
    <div className="fixed top-4 right-4 z-50 w-80 animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="bg-white border border-red-200 rounded-xl shadow-lg overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔴</span>
            <p className="text-sm font-semibold text-red-700">
              期限切れタスクが {tasks.length} 件あります
            </p>
          </div>
          <button
            onClick={() => { setVisible(false); setDismissed(true); }}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* タスク一覧 */}
        <div className="divide-y divide-gray-100">
          {shown.map(task => {
            const daysOverdue = Math.floor(
              (new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
            );
            return (
              <div key={task.id} className="px-4 py-2.5">
                <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">
                    {task.customer?.company_name ?? ''}
                  </span>
                  <span className="text-xs text-red-500 font-semibold">
                    {daysOverdue}日超過
                  </span>
                </div>
              </div>
            );
          })}
          {tasks.length > 3 && (
            <div className="px-4 py-2 text-xs text-gray-400 text-center">
              他 {tasks.length - 3} 件
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          <button
            onClick={() => {
              setVisible(false);
              router.push('/tasks?due_filter=overdue');
            }}
            className="w-full text-xs text-red-600 font-semibold hover:text-red-700 transition-colors"
          >
            期限切れタスクを全て確認 →
          </button>
        </div>
      </div>
    </div>
  );
}

