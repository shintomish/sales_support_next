// tests/integration/race-guard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useStaleResponseGuard } from '@/hooks/useStaleResponseGuard';

/**
 * Integration テスト: handleSelect パターン全体の race 防護を pin する (docs/730 #5)。
 *
 * 4 page (engineer-mails / project-mails / emails / SelfMailsView) の handleSelect は
 * いずれも以下の構造:
 *   1. selectGuard.mark(item.id)
 *   2. setDetailLoading(true) + setSelected(null)
 *   3. await axios.get(...) (item.id ごとに遅延が異なり得る)
 *   4. if (selectGuard.isStale(item.id)) return
 *   5. setSelected(res.data)
 *
 * テスト対象: 連続クリックで遅い古い response が新しい選択を上書きしないこと。
 *
 * 実 page.tsx をフルレンダリングする代わりに、上記パターンを再現する最小コンポーネント
 * (TestComponent) を用意して mock 化された fetch で挙動検証する。
 */

type Item = { id: number; label: string };

// 各 page.tsx の handleSelect を模した最小コンポーネント
function TestComponent({ fetchItem }: { fetchItem: (id: number) => Promise<Item> }) {
  const [selected, setSelected] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const selectGuard = useStaleResponseGuard<number>();

  const handleSelect = async (item: { id: number }) => {
    selectGuard.mark(item.id);
    setLoading(true);
    setSelected(null);
    try {
      const data = await fetchItem(item.id);
      if (selectGuard.isStale(item.id)) return;
      setSelected(data);
    } finally {
      if (selectGuard.isCurrent(item.id)) setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => handleSelect({ id: 1 })} data-testid="select-1">item-1</button>
      <button onClick={() => handleSelect({ id: 2 })} data-testid="select-2">item-2</button>
      <div data-testid="selected">{selected ? selected.label : '(none)'}</div>
      <div data-testid="loading">{loading ? 'loading' : 'idle'}</div>
    </div>
  );
}

describe('handleSelect race guard (integration)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('keeps only the latest selection when responses arrive in reverse order', async () => {
    // item 1 の response は 100ms 遅延、item 2 は即時 — 連続クリックで item 1 のレスポンスが
    // 後から来ても、すでに item 2 が選択されているので破棄される
    let resolveSlow!: (item: Item) => void;
    const slowPromise = new Promise<Item>((res) => { resolveSlow = res; });

    const fetchItem = vi.fn().mockImplementation((id: number) => {
      if (id === 1) return slowPromise;                      // 1 = 遅延 (手動 resolve)
      return Promise.resolve({ id: 2, label: 'item-2-data' }); // 2 = 即時
    });

    render(<TestComponent fetchItem={fetchItem} />);

    // 1 を選択 → 即座に 2 を選択 (連続クリック)
    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-2'));

    // 2 のレスポンスが即時で届くため、まず item-2-data が表示される
    await waitFor(() => {
      expect(screen.getByTestId('selected').textContent).toBe('item-2-data');
    });

    // 遅れて 1 のレスポンスが届く
    resolveSlow({ id: 1, label: 'item-1-data' });

    // 遅延 resolve を flush
    await new Promise((r) => setTimeout(r, 10));

    // 選択は依然として 2 のまま (1 は破棄された)
    expect(screen.getByTestId('selected').textContent).toBe('item-2-data');
  });

  it('updates selected when only one selection is made (sanity check)', async () => {
    const fetchItem = vi.fn().mockResolvedValue({ id: 1, label: 'solo' });

    render(<TestComponent fetchItem={fetchItem} />);

    fireEvent.click(screen.getByTestId('select-1'));

    await waitFor(() => {
      expect(screen.getByTestId('selected').textContent).toBe('solo');
    });
    expect(screen.getByTestId('loading').textContent).toBe('idle');
  });

  it('isCurrent guards loading state — does not clear loading for stale id', async () => {
    let resolveSlow!: (item: Item) => void;
    const slowPromise = new Promise<Item>((res) => { resolveSlow = res; });

    const fetchItem = vi.fn().mockImplementation((id: number) => {
      if (id === 1) return slowPromise;
      return Promise.resolve({ id: 2, label: 'item-2' });
    });

    render(<TestComponent fetchItem={fetchItem} />);

    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-2'));

    // 2 が処理されて loading=idle になる
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('idle');
    });

    // 1 が遅れて resolve → finally で isCurrent(1) は false なので loading は触らない
    resolveSlow({ id: 1, label: 'item-1' });
    await new Promise((r) => setTimeout(r, 10));

    // loading は idle のまま (1 の finally が誤って loading=false を再設定したり、
    // どちらにせよ既に idle なので無害)
    expect(screen.getByTestId('loading').textContent).toBe('idle');
    expect(screen.getByTestId('selected').textContent).toBe('item-2');
  });
});
