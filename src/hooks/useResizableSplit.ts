// src/hooks/useResizableSplit.ts
import { useEffect, useRef, useState, type CSSProperties } from 'react';

const MIN_PCT = 20;
const MAX_PCT = 80;

/**
 * 左右2ペイン（一覧 / 詳細）の境界をドラッグして幅を変えられる
 * リサイズ可能スプリッターの state ロジック。localStorage で幅を永続化する。
 *
 * 元実装は SelfMailsView.tsx（自社メールタブ）に直接埋まっていたが、
 * /emails・/project-mails・/engineer-mails へ横展開するため hook 化した。
 *
 * 使い方:
 *   const split = useResizableSplit('projectMails:leftPct');
 *   <div ref={split.containerRef} className="flex h-full min-h-0">
 *     <div className="... md:w-[var(--split-left)]" style={split.leftPaneStyle}>一覧</div>
 *     <ResizeHandle dragging={split.dragging} onStart={split.startDragging} onReset={split.reset} />
 *     <div className="flex-1 min-w-0">詳細</div>
 *   </div>
 *
 * leftPaneStyle は CSS 変数 --split-left を設定するだけなので、ペイン側で
 * `md:w-[var(--split-left)]`（md 未満は w-full のまま）と書けばモバイルの
 * 一画面切替レイアウトを壊さずに md+ だけ可変幅にできる。
 */
export function useResizableSplit(storageKey: string, defaultPct = 50) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultPct;
    const v = Number(localStorage.getItem(storageKey));
    return v >= MIN_PCT && v <= MAX_PCT ? v : defaultPct;
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(MIN_PCT, Math.min(MAX_PCT, pct)));
    };
    const onUp = () => {
      setDragging(false);
      try { localStorage.setItem(storageKey, String(leftPct)); } catch { /* ignore */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, leftPct, storageKey]);

  const reset = () => {
    setLeftPct(defaultPct);
    try { localStorage.setItem(storageKey, String(defaultPct)); } catch { /* ignore */ }
  };

  return {
    containerRef,
    leftPct,
    dragging,
    startDragging: () => setDragging(true),
    reset,
    leftPaneStyle: { '--split-left': `${leftPct}%` } as CSSProperties,
  };
}
