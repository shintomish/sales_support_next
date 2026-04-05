'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/authStore';
import UserFilter, { defaultUserFilter } from '@/components/UserFilter';
import SortableHeader from '@/components/SortableHeader';


interface Deal {
  id: number; title: string; amount: number; status: string;
  probability: number | null; expected_close_date: string | null;
  customer: { id: number; company_name: string } | null;
  deal_type?: string;
}
interface Customer { id: number; company_name: string; }
interface Meta { current_page: number; last_page: number; total: number; }

// ── ステータス定義（SES拡張済み）──────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; headerBg: string }> = {
  稼働中:     { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', headerBg: '#10B981' },
  更新交渉中: { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', headerBg: '#F59E0B' },
  新規:       { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', headerBg: '#64748B' },
  提案:       { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', headerBg: '#3B82F6' },
  交渉:       { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', headerBg: '#F97316' },
  成約:       { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', headerBg: '#22C55E' },
  失注:       { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', headerBg: '#EF4444' },
  期限切れ:   { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB', headerBg: '#9CA3AF' },
};

// カンバンに表示するステータスの順序
const KANBAN_STATUSES = ['稼働中', '更新交渉中', '新規', '提案', '交渉', '成約', '失注', '期限切れ'];
// リスト表示のステータス選択肢
const LIST_STATUSES = ['新規', '提案', '交渉', '成約', '失注', '稼働中', '更新交渉中', '期限切れ'];

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

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

// ── カンバンカードコンポーネント ──────────────────────────────
function KanbanCard({ deal, onNavigate }: { deal: Deal; onNavigate: (id: number) => void }) {
  const cfg = STATUS_CONFIG[deal.status] ?? STATUS_CONFIG['新規'];
  return (
    <div
      onClick={() => onNavigate(deal.id)}
      className="bg-white rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow group"
      style={{ borderLeft: `3px solid ${cfg.border}` }}
    >
      <p className="text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug mb-2">
        {deal.title}
      </p>
      {deal.customer && (
        <p className="text-xs text-gray-400 truncate mb-2">
          🏢 {deal.customer.company_name}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">
          ¥{Number(deal.amount).toLocaleString()}
        </span>
        {deal.probability != null && (
          <div className="flex items-center gap-1">
            <div className="w-12 h-1 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${deal.probability}%` }} />
            </div>
            <span className="text-xs text-gray-400">{deal.probability}%</span>
          </div>
        )}
      </div>
      {deal.expected_close_date && (
        <p className="text-xs text-gray-300 mt-1.5">
          📅 {new Date(deal.expected_close_date).toLocaleDateString('ja-JP')}
        </p>
      )}
    </div>
  );
}

// ── カンバン列コンポーネント ──────────────────────────────────
function KanbanColumn({
  status, deals, onNavigate,
}: {
  status: string;
  deals: Deal[];
  onNavigate: (id: number) => void;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['新規'];
  const totalAmount = deals.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="flex flex-col min-w-[220px] max-w-[260px] flex-shrink-0">
      {/* 列ヘッダー */}
      <div
        className="rounded-t-lg px-3 py-2 flex items-center justify-between mb-2"
        style={{ backgroundColor: cfg.headerBg }}
      >
        <span className="text-xs font-bold text-white">{status}</span>
        <span className="bg-white/25 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
          {deals.length}
        </span>
      </div>

      {/* 合計金額 */}
      <p className="text-xs text-gray-400 px-1 mb-2">
        合計: ¥{totalAmount.toLocaleString()}
      </p>

      {/* カード一覧 */}
      <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
        {deals.length === 0 ? (
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-lg">
            <span className="text-xs text-gray-300">案件なし</span>
          </div>
        ) : (
          deals.map(d => (
            <KanbanCard key={d.id} deal={d} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  );
}

// ── 売上予測グラフ ─────────────────────────────────────────────
function RevenueChart({ deals }: { deals: Deal[] }) {
  const revenueStatuses = ['稼働中', '更新交渉中', '成約', '提案', '交渉'];
  const data = revenueStatuses.map(s => {
    const filtered = deals.filter(d => d.status === s);
    const total = filtered.reduce((sum, d) => sum + Number(d.amount), 0);
    return { status: s, total, count: filtered.length };
  }).filter(d => d.total > 0);

  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.total));

  return (
    <Card className="mb-4 shadow-sm flex-shrink-0">
      <CardContent className="py-3 px-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">売上予測（ステータス別）</p>
        <div className="flex items-end gap-3 h-24">
          {data.map(d => {
            const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG['新規'];
            const heightPct = maxVal > 0 ? (d.total / maxVal) * 100 : 0;
            return (
              <div key={d.status} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-semibold">
                  ¥{(d.total / 10000).toFixed(0)}万
                </span>
                <div className="w-full flex items-end justify-center" style={{ height: '56px' }}>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      backgroundColor: cfg.headerBg,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 truncate w-full text-center">{d.status}</span>
                <span className="text-xs text-gray-300">{d.count}件</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── メインコンポーネント ───────────────────────────────────────
function DealsPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [deals, setDeals]         = useState<Deal[]>([]);
  const [allDeals, setAllDeals]   = useState<Deal[]>([]); // カンバン用（全件）
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [viewMode, setViewMode]     = useState<'list' | 'kanban'>('list');
  const [searchInput, setSearchInput]       = useState(searchParams.get('search') ?? '');
  const [search, setSearch]                 = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter]     = useState(searchParams.get('status') ?? '');
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer_id') ?? '');
  const [amountMin, setAmountMin]           = useState(searchParams.get('amount_min') ?? '');
  const [amountMax, setAmountMax]           = useState(searchParams.get('amount_max') ?? '');
  const { user } = useAuthStore();
  const [userFilter, setUserFilter] = useState<string>('all');
  useEffect(() => { setUserFilter(defaultUserFilter(user)); }, [user]);
  const [page, setPage]       = useState(Number(searchParams.get('page') ?? '1'));
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
      const [res, cRes, allRes] = await Promise.all([
        apiClient.get('/api/v1/deals', {
          params: { search, status: statusFilter, customer_id: customerFilter, amount_min: amountMin, amount_max: amountMax, page, user_id: userFilter, sort_by: sortField || undefined, sort_order: sortField ? sortOrder : undefined },
        }),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        // カンバン・グラフ用に全件取得（ページなし・最大200件）
        apiClient.get('/api/v1/deals', { params: { page: 1, per_page: 200 } }),
      ]);
      setDeals(res.data.data);
      setMeta(res.data.meta);
      setCustomers(cRes.data.data);
      setAllDeals(allRes.data.data);
      if (userFilter === 'all') setGrandTotal(res.data.meta.total);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('商談データの取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, statusFilter, customerFilter, amountMin, amountMax, page, userFilter, sortField, sortOrder, router]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);
  useEffect(() => {
    updateUrl({ search, status: statusFilter, customer_id: customerFilter, amount_min: amountMin, amount_max: amountMax, page: String(page) });
  }, [search, statusFilter, customerFilter, amountMin, amountMax, page, updateUrl]);

  const handleSort = (field: string) => {
    if (sortField === field) { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  };

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

  // カンバン用: ステータス別にグループ化
  const kanbanGroups = KANBAN_STATUSES.reduce<Record<string, Deal[]>>((acc, s) => {
    acc[s] = allDeals.filter(d => d.status === s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-screen py-8 px-6 max-w-[1400px] mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">商談管理</h1>
          {meta && (
            <p className="text-sm text-gray-400 mt-0.5">
              {userFilter !== 'all' && grandTotal !== null
                ? `${grandTotal}件中 ${meta.total}件`
                : `全 ${meta.total}件`}
              {hasFilter && ' （絞り込み中）'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* ビュー切り替えタブ */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'list'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              📋 リスト
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'kanban'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              🗂 カンバン
            </button>
          </div>
          <Button onClick={() => router.push('/deals/create')} className="gap-1">
            <span className="text-base">＋</span> 新規登録
          </Button>
        </div>
      </div>

      {/* ── カンバンビュー ── */}
      {viewMode === 'kanban' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* 売上予測グラフ */}
          <RevenueChart deals={allDeals} />

          {/* カンバンボード */}
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
            {KANBAN_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                deals={kanbanGroups[status] ?? []}
                onNavigate={(id) => router.push(`/deals/${id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── リストビュー ── */}
      {viewMode === 'list' && (
        <>
          {/* 検索フィルタ */}
          <Card className="mb-4 shadow-sm flex-shrink-0">
            <CardContent className="py-3 px-4 space-y-2">
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
                  {LIST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1); }} className={`${selectCls} min-w-36`}>
                  <option value="">全顧客</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
                <UserFilter value={userFilter} onChange={v => { setUserFilter(v); setPage(1); }} className={selectCls} />
                <Button onClick={handleSearch}>検索</Button>
                {hasFilter && (
                  <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
                )}
              </div>
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

          {/* テーブル */}
          <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <CardContent className="p-0 flex flex-col h-full overflow-hidden">
              <div className="flex-shrink-0 border-b bg-gray-50">
                <table className="w-full text-sm table-fixed">
                  <ColGroup />
                  <thead>
                    <tr>
                      <SortableHeader label="商談名" field="title" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="font-semibold text-gray-600 py-3 px-4 text-left">顧客</th>
                      <SortableHeader label="金額" field="amount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortableHeader label="ステータス" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="font-semibold text-gray-600 py-3 px-4 text-left">成約確度</th>
                      <SortableHeader label="予定成約日" field="expected_close_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="font-semibold text-gray-600 py-3 px-4 text-center">操作</th>
                    </tr>
                  </thead>
                </table>
              </div>
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
                      const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG['新規'];
                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}
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
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}
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
                              <button title="詳細" onClick={() => router.push(`/deals/${d.id}`)}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">👁</button>
                              <button title="編集" onClick={() => router.push(`/deals/${d.id}/edit`)}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">✏️</button>
                              <button title="削除" disabled={deletingId === d.id} onClick={() => handleDelete(d.id)}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40">🗑</button>
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

          {/* ページネーション */}
          {meta && meta.last_page > 1 && (
            <div className="flex justify-center items-center gap-3 mt-5 flex-shrink-0">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
              <span className="text-sm text-gray-500">{page} / {meta.last_page} ページ</span>
              <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
            </div>
          )}
        </>
      )}

    </div>
  );
}

export default function Page() {
  return <Suspense><DealsPage /></Suspense>;
}
