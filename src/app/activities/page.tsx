'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Activity {
  id: number;
  type: string;
  subject: string;
  activity_date: string;
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

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const router = useRouter();

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
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, customerFilter, dateFrom, dateTo, page, router]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => {
    setSearchInput(''); setSearch(''); setTypeFilter('');
    setCustomerFilter(''); setDateFrom(''); setDateTo(''); setPage(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await apiClient.delete(`/api/v1/activities/${id}`);
      fetchActivities();
    } catch { alert('削除に失敗しました'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <Button onClick={fetchActivities}>再試行</Button>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">活動履歴</h1>
          {meta && <p className="text-sm text-gray-400 mt-1">全 {meta.total} 件</p>}
        </div>
        <Button onClick={() => router.push('/activities/create')}>+ 新規登録</Button>
      </div>

      {/* 検索 */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8" placeholder="件名・内容・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-2 text-sm min-w-28">
              <option value="">全種別</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-2 text-sm min-w-36">
              <option value="">全顧客</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="w-36" />
            <span className="text-gray-400 text-sm">〜</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="w-36" />
            <Button onClick={handleSearch}>検索</Button>
            {(search || typeFilter || customerFilter || dateFrom || dateTo) && (
              <Button variant="outline" onClick={handleClear}>✕</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* テーブル */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>活動日</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>件名</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead>関連商談</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-12">
                    <p className="text-3xl mb-2">🕐</p>
                    活動履歴が登録されていません
                    <div className="mt-3">
                      <Button size="sm" onClick={() => router.push('/activities/create')}>
                        最初の活動を登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                activities.map(a => {
                  const style = TYPE_STYLE[a.type] ?? TYPE_STYLE['その他'];
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/activities/${a.id}`)}>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {new Date(a.activity_date).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                              style={{ backgroundColor: style.bg, color: style.color }}>
                          {style.icon} {a.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600">{a.subject}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {a.customer?.company_name ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {a.contact?.name ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {a.deal?.title ?? '-'}
                      </TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="outline"
                            onClick={() => router.push(`/activities/${a.id}`)}>詳細</Button>
                          <Button size="sm" variant="outline"
                            onClick={() => router.push(`/activities/${a.id}/edit`)}>編集</Button>
                          <Button size="sm" variant="outline"
                            className="text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => handleDelete(a.id)}>削除</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ページネーション */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="flex items-center text-sm text-gray-500">{page} / {meta.last_page}</span>
          <Button variant="outline" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}
    </div>
  );
}
