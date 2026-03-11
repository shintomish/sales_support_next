'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Activity {
  id: number; type: string; subject: string; activity_date: string;
  customer: { id: number; company_name: string } | null;
  contact: { id: number; name: string } | null;
  deal: { id: number; title: string } | null;
}
interface Customer { id: number; company_name: string; }
interface Meta { current_page: number; last_page: number; total: number; }

const TYPE_STYLE: Record<string, { icon: string; bg: string; color: string }> = {
  訪問:   { icon: '🚶', bg: '#EFF6FF', color: '#2563EB' },
  電話:   { icon: '📞', bg: '#ECFDF5', color: '#10B981' },
  メール: { icon: '✉️', bg: '#FFF3E0', color: '#FF8C00' },
  その他: { icon: '•••', bg: '#F1F5F9', color: '#64748B' },
};
const TYPES = ['訪問', '電話', 'メール', 'その他'];
const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function ActivitiesPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [searchInput, setSearchInput]       = useState(searchParams.get('search') ?? '');
  const [search, setSearch]                 = useState(searchParams.get('search') ?? '');
  const [typeFilter, setTypeFilter]         = useState(searchParams.get('type') ?? '');
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer_id') ?? '');
  const [dateFrom, setDateFrom]             = useState(searchParams.get('date_from') ?? '');
  const [dateTo, setDateTo]                 = useState(searchParams.get('date_to') ?? '');
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

  const fetchActivities = useCallback(async () => {
    try {
      setError(null);
      const [actRes, cusRes] = await Promise.all([
        apiClient.get('/api/v1/activities', {
          params: { search, type: typeFilter, customer_id: customerFilter, date_from: dateFrom, date_to: dateTo, page },
        }),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
      ]);
      setActivities(actRes.data.data);
      setMeta(actRes.data.meta);
      setCustomers(cusRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('活動履歴の取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, typeFilter, customerFilter, dateFrom, dateTo, page, router]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);
  useEffect(() => {
    updateUrl({ search, type: typeFilter, customer_id: customerFilter, date_from: dateFrom, date_to: dateTo, page: String(page) });
  }, [search, typeFilter, customerFilter, dateFrom, dateTo, page, updateUrl]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => {
    setSearchInput(''); setSearch(''); setTypeFilter('');
    setCustomerFilter(''); setDateFrom(''); setDateTo(''); setPage(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try { await apiClient.delete(`/api/v1/activities/${id}`); fetchActivities(); }
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
      <Button onClick={fetchActivities}>再試行</Button>
    </div>
  );

  const hasFilter = !!(search || typeFilter || customerFilter || dateFrom || dateTo);

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">活動履歴</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件{hasFilter && ' （絞り込み中）'}</p>}
        </div>
        <Button onClick={() => router.push('/activities/create')} className="gap-1">
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      <Card className="mb-4 shadow-sm">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="件名・内容・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">全種別</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1); }} className={`${selectCls} min-w-36`}>
              <option value="">全顧客</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-36 bg-white" />
            <span className="text-gray-400 text-sm">〜</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-36 bg-white" />
            <Button onClick={handleSearch}>検索</Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-3">活動日</TableHead>
                <TableHead className="font-semibold text-gray-600">種別</TableHead>
                <TableHead className="font-semibold text-gray-600">件名</TableHead>
                <TableHead className="font-semibold text-gray-600">顧客</TableHead>
                <TableHead className="font-semibold text-gray-600">担当者</TableHead>
                <TableHead className="font-semibold text-gray-600">関連商談</TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <span className="text-5xl">🕐</span>
                    <p className="font-medium text-gray-500">
                      {hasFilter ? '条件に一致する活動履歴が見つかりません' : '活動履歴が登録されていません'}
                    </p>
                    {!hasFilter && <Button size="sm" variant="outline" onClick={() => router.push('/activities/create')}>最初の活動を登録する</Button>}
                  </div>
                </TableCell></TableRow>
              ) : activities.map(a => {
                const style = TYPE_STYLE[a.type] ?? TYPE_STYLE['その他'];
                return (
                  <TableRow key={a.id}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                    onClick={() => router.push(`/activities/${a.id}`)}>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap py-3">
                      {new Date(a.activity_date).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                            style={{ backgroundColor: style.bg, color: style.color }}>
                        {style.icon} {a.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-blue-600">{a.subject}</TableCell>
                    <TableCell className="text-sm text-gray-500">{a.customer?.company_name ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-sm text-gray-500">{a.contact?.name ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-sm text-gray-500">{a.deal?.title ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button title="詳細" onClick={() => router.push(`/activities/${a.id}`)} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">👁</button>
                        <button title="編集" onClick={() => router.push(`/activities/${a.id}/edit`)} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">✏️</button>
                        <button title="削除" disabled={deletingId === a.id} onClick={() => handleDelete(a.id)} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40">🗑</button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {meta && meta.last_page > 1 && (
        <div className="flex justify-center items-center gap-3 mt-5">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="text-sm text-gray-500">{page} / {meta.last_page} ページ</span>
          <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}
    </div>
  );
}
