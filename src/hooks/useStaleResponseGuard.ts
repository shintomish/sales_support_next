// src/hooks/useStaleResponseGuard.ts
import { useCallback, useRef } from 'react';

/**
 * 連続クリック時の async race を防ぐ ref-based ガード (docs/730 #5)。
 *
 * 用途:
 *   handleSelect(item) のような選択ハンドラで、複数の await を含む処理が
 *   連続クリックで重なった場合に、古い await の結果が新しい選択を上書き
 *   する事故を防ぐ。
 *
 * 使用例:
 *   const { mark, isStale } = useStaleResponseGuard<number>();
 *   const handleSelect = async (item: { id: number }) => {
 *     mark(item.id);
 *     const res = await axios.get(...);
 *     if (isStale(item.id)) return;  // 古いレスポンスは破棄
 *     setSelected(res.data);
 *   };
 *
 * 元実装は engineer-mails/page.tsx 等に直接 useRef + 比較を埋めていたが、
 * 再利用と silent regression 防護 (vitest テスト追加可能) のため hook 化。
 */
export function useStaleResponseGuard<T>() {
  const currentRef = useRef<T | null>(null);

  const mark = useCallback((id: T) => {
    currentRef.current = id;
  }, []);

  const isStale = useCallback((id: T) => {
    return currentRef.current !== id;
  }, []);

  const isCurrent = useCallback((id: T) => {
    return currentRef.current === id;
  }, []);

  return { mark, isStale, isCurrent };
}
