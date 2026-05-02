'use client';

import { useEffect } from 'react';

interface Props {
  message: string | null;
  onClose: () => void;
  /** 自動消去までの秒数（ミリ秒）。デフォルト 2500ms */
  duration?: number;
  /** 'success' | 'error' で色を切替 */
  type?: 'success' | 'error';
}

/**
 * 画面上部中央に表示される自動消去型のトースト通知。
 * alert() の代替。アクション完了の軽い通知に使う。
 */
export default function Toast({ message, onClose, duration = 2500, type = 'success' }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const cls = type === 'success'
    ? 'bg-green-600 text-white'
    : 'bg-red-600 text-white';

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className={`${cls} px-8 py-4 rounded-lg shadow-xl text-base font-medium min-w-[320px] text-center flex items-center justify-center gap-2`}>
        <span>{type === 'success' ? '✓' : '⚠'}</span>
        {message}
      </div>
    </div>
  );
}
