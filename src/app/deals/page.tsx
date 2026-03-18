'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Deal {
  id: number; title: string; amount: number; status: string;
  probability: number | null; expected_close_date: string | null;
  customer: { id: number; company_name: string } | null;
}
interface Customer { id: number; company_name: string; }
interface Meta { current_page: number; last_page: number; total: number; }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  成約: { bg: '#ECFDF5', color: '#065F46' }, 失注: { bg: '#FEF2F2', color: '#991B1B' },
  交渉: { bg: '#FFF3E0', color: '#E67E00' }, 提案: { bg: '#EFF6FF', color: '#1D4ED8' },
  新規: { bg: '#F1F5F9', color: '#475569' },
};
const STATUSES = ['新規', '提案', '交渉', '成約', '失注'];
const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

// ヘッダー・ボディで幅を揃えるcolgroup定義
const ColGroup = () => (
  <colgroup>
    <col style={{ width: '22%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '10%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '11%' }} />
  </colgroup>
);

function DealsPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [deals, setDeals]         = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [searchInput, setSearchInput]       = useState(searchParams.get('search') ?? '');
  const [search, setSearch]                 = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter]     = useState(searchParams.get('status') ?? '');
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer_id') ?? '');
  const [amountMin, setAmountMin]           = useState(searchParams.get('amount_min') ?? '');
  const [amountMax, setAmountMax]           = useState(searchParams.get('amount_max') ?? '');
  const [page, setPage]       = useState(Number(searchParams.get('page') ?? '1'));
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const updateUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v && v !== '1') p.set(k, v); });
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  const fetchDeals = useCallback(async () => {
    try {
      setError(null);
      const [res, cRes] = await Promise.all([
        apiClient.get('/api/v1/deals', {
          params: { search, status: statusFilter, customer_id: customerFilter, amount_min: amountMin, amount_max: amountMax, page },
        }),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
      ]);
      setDeals(res.data.data);
      setMeta(res.data.meta);
      setCustomers(cRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('商談データの取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, statusFilter, customerFilter, amountMin, amountMax, page, router]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);
  useEffect(() => {
    updateUrl({ search, status: statusFilter, customer_id: customerFilter, amount_min: amountMin, amount_max: amountMax, page: String(page) });
  }, [search, statusFilter, customerFilter, amountMin, amountMax, page, updateUrl]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => {
    setSearchInput(''); setSearch(''); setStatusFilter('');
    setCustomerFilter(''); setAmountMin(''); setAmountMax(''); setPage(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try { await apiClient.delete(`/api/v1/deals/${id}`); fetchDeals(); }
    catch { alert('削除に失敗しました'); }
    finally { setDeletingId(null); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">⚠️</div>
      <p className="text-gray-600 font-medium">{error}</p>
      <Button onClick={fetchDeals}>再試行</Button>
    </div>
  );

  const hasFilter = !!(search || statusFilter || customerFilter || amountMin || amountMax);

  return (
    <div className="flex flex-col h-screen py-8 px-6 max-w-7xl mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">商談一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件{hasFilter && ' （絞り込み中）'}</p>}
        </div>
        <Button onClick={() => router.push('/deals/create')} className="gap-1">
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      {/* ── 検索フィルタ ── */}
      <Card className="mb-4 shadow-sm flex-shrink-0">
        <CardContent className="py-3 px-4 space-y-2">
          {/* 1行目: テキスト検索・ステータス・顧客 */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="商談名・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">全ステータス</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1); }} className={`${selectCls} min-w-36`}>
              <option value="">全顧客</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <Button onClick={handleSearch}>検索</Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
            )}
          </div>
          {/* 2行目: 金額範囲 */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-500 whitespace-nowrap">金額:</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">¥</span>
              <Input type="number" min="0" placeholder="下限" className="pl-5 w-32 bg-white h-8 text-sm"
                value={amountMin} onChange={e => { setAmountMin(e.target.value); setPage(1); }} />
            </div>
            <span className="text-gray-400 text-sm">〜</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">¥</span>
              <Input type="number" min="0" placeholder="上限" className="pl-5 w-32 bg-white h-8 text-sm"
                value={amountMax} onChange={e => { setAmountMax(e.target.value); setPage(1); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── テーブル（ボディのみスクロール） ── */}
      <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <CardContent className="p-0 flex flex-col h-full overflow-hidden">

          {/* テーブルヘッダー（固定） */}
          <div className="flex-shrink-0 border-b bg-gray-50">
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <thead>
                <tr>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">商談名</th>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">顧客</th>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">金額</th>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">ステータス</th>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">成約確度</th>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">予定成約日</th>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* テーブルボディ（スクロール） */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <span className="text-5xl">💼</span>
                        <p className="font-medium text-gray-500">
                          {hasFilter ? '条件に一致する商談が見つかりません' : '商談が登録されていません'}
                        </p>
                        {!hasFilter && (
                          <Button size="sm" variant="outline" onClick={() => router.push('/deals/create')}>
                            最初の商談を登録する
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : deals.map((d, index) => {
                  const style = STATUS_STYLE[d.status] ?? STATUS_STYLE['新規'];
                  return (
                    <tr
                      key={d.id}
                      className={`
                        hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0
                        ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                      `}
                      onClick={() => router.push(`/deals/${d.id}`)}
                    >
                      <td className="font-semibold text-blue-600 py-3 px-4 truncate">{d.title}</td>
                      <td className="px-4">
                        <button
                          className="text-sm text-gray-500 hover:text-blue-500 hover:underline truncate block max-w-full"
                          onClick={e => { e.stopPropagation(); router.push(`/customers/${d.customer?.id}`); }}
                        >
                          {d.customer?.company_name ?? <span className="text-gray-300">—</span>}
                        </button>
                      </td>
                      <td className="font-semibold text-gray-700 px-4">¥{Number(d.amount).toLocaleString()}</td>
                      <td className="px-4">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: style.bg, color: style.color }}
                        >{d.status}</span>
                      </td>
                      <td className="px-4">
                        {d.probability != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${d.probability}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{d.probability}%</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-sm text-gray-400 px-4">
                        {d.expected_close_date
                          ? new Date(d.expected_close_date).toLocaleDateString('ja-JP')
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button
                            title="詳細"
                            onClick={() => router.push(`/deals/${d.id}`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                          >👁</button>
                          <button
                            title="編集"
                            onClick={() => router.push(`/deals/${d.id}/edit`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                          >✏️</button>
                          <button
                            title="削除"
                            disabled={deletingId === d.id}
                            onClick={() => handleDelete(d.id)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>

      {/* ── ページネーション ── */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center items-center gap-3 mt-5 flex-shrink-0">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="text-sm text-gray-500">{page} / {meta.last_page} ページ</span>
          <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}

    </div>
  );
}

export default function Page() {
  return <Suspense><DealsPage /></Suspense>;
}
