// src/hooks/__tests__/useStaleResponseGuard.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStaleResponseGuard } from '../useStaleResponseGuard';

/**
 * useStaleResponseGuard の挙動を pin する Unit テスト (docs/730 #5)。
 *
 * カバレッジ:
 *   - mark で current が更新される
 *   - 異なる id を mark した後、古い id は isStale=true
 *   - 同じ id は isCurrent=true
 *   - null 状態 (初期) でも crash しない
 */

describe('useStaleResponseGuard', () => {
  it('marks the initial id as current', () => {
    const { result } = renderHook(() => useStaleResponseGuard<number>());

    act(() => {
      result.current.mark(1);
    });

    expect(result.current.isCurrent(1)).toBe(true);
    expect(result.current.isStale(1)).toBe(false);
  });

  it('treats an older id as stale once a newer one is marked', () => {
    const { result } = renderHook(() => useStaleResponseGuard<number>());

    act(() => {
      result.current.mark(1);
    });
    act(() => {
      result.current.mark(2);
    });

    expect(result.current.isStale(1)).toBe(true);
    expect(result.current.isStale(2)).toBe(false);
    expect(result.current.isCurrent(2)).toBe(true);
  });

  it('simulates a race: two async selects with delayed responses — only the latest wins', async () => {
    const { result } = renderHook(() => useStaleResponseGuard<number>());

    // 連続クリック: item 1 → item 2
    act(() => result.current.mark(1));
    act(() => result.current.mark(2));

    // 古いレスポンス (item 1) が遅れて到着するシナリオ
    const oldResponseId = 1;
    const newResponseId = 2;
    // 「await から戻ってきた」体で isStale チェック:
    expect(result.current.isStale(oldResponseId)).toBe(true);
    expect(result.current.isStale(newResponseId)).toBe(false);
  });

  it('returns true for isStale when nothing is marked (initial state)', () => {
    const { result } = renderHook(() => useStaleResponseGuard<number>());

    // 何も mark していない状態では current=null。任意の id は stale 扱い
    expect(result.current.isStale(1)).toBe(true);
    expect(result.current.isCurrent(1)).toBe(false);
  });

  it('supports string ids as well', () => {
    const { result } = renderHook(() => useStaleResponseGuard<string>());

    act(() => result.current.mark('email-a'));
    expect(result.current.isCurrent('email-a')).toBe(true);

    act(() => result.current.mark('email-b'));
    expect(result.current.isStale('email-a')).toBe(true);
    expect(result.current.isCurrent('email-b')).toBe(true);
  });
});
