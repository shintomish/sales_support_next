'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';
import type { ApiError } from '@/lib/error-helpers';

interface Contact {
  id: number; name: string; department: string | null; position: string | null;
  email: string | null; phone: string | null;
  customer: { id: number; company_name: string } | null;
}
interface Meta { current_page: number; last_page: number; total: number; }
interface Customer { id: number; company_name: string; }

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

// ヘッダー・ボディで幅を揃えるcolgroup定義
const ColGroup = () => (
  <colgroup>
    <col style={{ width: '13%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '22%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '10%' }} />
  </colgroup>
);

function ContactsPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [searchInput, setSearchInput]       = useState(searchParams.get('search') ?? '');
  const [search, setSearch]                 = useState(searchParams.get('search') ?? '');
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer_id') ?? '');
  const [page, setPage]       = useState(Number(searchParams.get('page') ?? '1'));
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

  const fetchContacts = useCallback(async () => {
    try {
      setError(null);
      const [cRes, cusRes] = await Promise.all([
        apiClient.get('/api/v1/contacts', { params: { search, customer_id: customerFilter, page, sort_by: sortField || undefined, sort_order: sortField ? sortOrder : undefined } }),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
      ]);
      setContacts(cRes.data.data);
      setMeta(cRes.data.meta);
      setCustomers(cusRes.data.data);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else setError('担当者データの取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, customerFilter, page, sortField, sortOrder, router]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => {
    updateUrl({ search, customer_id: customerFilter, page: String(page) });
  }, [search, customerFilter, page, updateUrl]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearchInput(''); setSearch(''); setCustomerFilter(''); setPage(1); };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try { await apiClient.delete(`/api/v1/contacts/${id}`); fetchContacts(); }
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
      <Button onClick={fetchContacts}>再試行</Button>
    </div>
  );

  const hasFilter = !!(search || customerFilter);

  return (
    <div className="flex flex-col h-screen py-8 px-6 max-w-7xl mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">担当者一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件{hasFilter && ' （絞り込み中）'}</p>}
        </div>
        <Button onClick={() => router.push('/contacts/create')} className="gap-1">
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      {/* ── 検索フィルタ ── */}
      <Card className="mb-4 shadow-sm flex-shrink-0">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="氏名・部署・役職・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1); }} className={`${selectCls} min-w-36`}>
              <option value="">全顧客</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <Button onClick={handleSearch}>検索</Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
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
                  <SortableHeader label="氏名" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="会社名" field="company_name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="部署" field="department" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="役職" field="position" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="メール" field="email" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">電話番号</th>
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
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <span className="text-5xl">👤</span>
                        <p className="font-medium text-gray-500">
                          {hasFilter ? '条件に一致する担当者が見つかりません' : '担当者が登録されていません'}
                        </p>
                        {!hasFilter && (
                          <Button size="sm" variant="outline" onClick={() => router.push('/contacts/create')}>
                            最初の担当者を登録する
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : contacts.map((c, index) => (
                  <tr
                    key={c.id}
                    className={`
                      hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0
                      ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                    `}
                    onClick={() => router.push(`/contacts/${c.id}`)}
                  >
                    <td className="font-semibold text-blue-600 py-3 px-4 truncate">{c.name}</td>
                    <td className="px-4">
                      <button
                        className="text-sm text-gray-500 hover:text-blue-500 hover:underline truncate block max-w-full"
                        onClick={e => { e.stopPropagation(); router.push(`/customers/${c.customer?.id}`); }}
                      >
                        {c.customer?.company_name ?? <span className="text-gray-300">—</span>}
                      </button>
                    </td>
                    <td className="text-gray-600 px-4 truncate">{c.department ?? <span className="text-gray-300">—</span>}</td>
                    <td className="text-gray-600 px-4 truncate">{c.position ?? <span className="text-gray-300">—</span>}</td>
                    <td className="text-sm text-gray-500 px-4 truncate">{c.email ?? <span className="text-gray-300">—</span>}</td>
                    <td className="text-sm text-gray-500 px-4 truncate">{c.phone ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button
                          title="詳細"
                          onClick={() => router.push(`/contacts/${c.id}`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                        >👁</button>
                        <button
                          title="編集"
                          onClick={() => router.push(`/contacts/${c.id}/edit`)}
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
  return <Suspense><ContactsPage /></Suspense>;
}
