'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

interface Customer {
  id: number; company_name: string; industry: string | null;
  employee_count: number | null; phone: string | null; created_at: string;
}
interface Meta { current_page: number; last_page: number; total: number; }

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

// ヘッダー・ボディで幅を揃えるcolgroup定義
const ColGroup = () => (
  <colgroup>
    <col style={{ width: '34%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '17%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '11%' }} />
  </colgroup>
);

function CustomersPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [searchInput, setSearchInput]       = useState(searchParams.get('search') ?? '');
  const [search, setSearch]                 = useState(searchParams.get('search') ?? '');
  const [industryFilter, setIndustryFilter] = useState(searchParams.get('industry') ?? '');
  const [page, setPage]     = useState(Number(searchParams.get('page') ?? '1'));
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSort = (field: string) => {
    if (sortField === field) { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  };

  const updateUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v && v !== '1') p.set(k, v); });
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  const fetchCustomers = useCallback(async () => {
    try {
      setError(null);
      const [res, indRes] = await Promise.all([
        apiClient.get('/api/v1/customers', { params: { search, industry: industryFilter, page, sort_by: sortField || undefined, sort_order: sortField ? sortOrder : undefined } }),
        apiClient.get('/api/v1/customers/industries'),
      ]);
      setCustomers(res.data.data);
      setMeta(res.data.meta);
      setIndustries(indRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('顧客データの取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, industryFilter, page, sortField, sortOrder, router]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { updateUrl({ search, industry: industryFilter, page: String(page) }); }, [search, industryFilter, page, updateUrl]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearchInput(''); setSearch(''); setIndustryFilter(''); setPage(1); };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try { await apiClient.delete(`/api/v1/customers/${id}`); fetchCustomers(); }
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
      <Button onClick={fetchCustomers}>再試行</Button>
    </div>
  );

  const hasFilter = !!(search || industryFilter);

  return (
    <div className="flex flex-col h-screen py-8 px-6 max-w-7xl mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">顧客一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件{hasFilter && ' （絞り込み中）'}</p>}
        </div>
        <Button onClick={() => router.push('/customers/create')} className="gap-1">
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      {/* ── 検索フィルタ ── */}
      <Card className="mb-4 shadow-sm flex-shrink-0">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="会社名・業種で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={industryFilter} onChange={e => { setIndustryFilter(e.target.value); setPage(1); }}
              className={selectCls}>
              <option value="">全業種</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <Button onClick={handleSearch}>検索</Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">
                ✕ クリア
              </Button>
            )}
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
                  <SortableHeader label="会社名" field="company_name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="業種" field="industry" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="従業員数" field="employee_count" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="電話番号" field="phone" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="登録日" field="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
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
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <span className="text-5xl">🏢</span>
                        <p className="font-medium text-gray-500">
                          {hasFilter ? '条件に一致する顧客が見つかりません' : '顧客が登録されていません'}
                        </p>
                        {!hasFilter && (
                          <Button size="sm" variant="outline" onClick={() => router.push('/customers/create')}>
                            最初の顧客を登録する
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : customers.map((c, index) => (
                  <tr
                    key={c.id}
                    // 偶数行(index=0,2,4...): white / 奇数行(index=1,3,5...): bg-gray-50
                    className={`
                      hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0
                      ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                    `}
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <td className="font-semibold text-blue-600 py-3 px-4 truncate">{c.company_name}</td>
                    <td className="px-4">
                      {c.industry
                        ? <Badge variant="secondary" className="text-xs">{c.industry}</Badge>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-gray-600 px-4">
                      {c.employee_count
                        ? `${c.employee_count.toLocaleString()}名`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-gray-600 px-4">{c.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td className="text-sm text-gray-400 px-4">
                      {new Date(c.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button
                          title="詳細"
                          onClick={() => router.push(`/customers/${c.id}`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                        >👁</button>
                        <button
                          title="編集"
                          onClick={() => router.push(`/customers/${c.id}/edit`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                        >✏️</button>
                        <button
                          title="削除"
                          disabled={deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
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
  return <Suspense><CustomersPage /></Suspense>;
}
