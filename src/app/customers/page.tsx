'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Customer {
  id: number;
  company_name: string;
  industry: string | null;
  employee_count: number | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
}

interface Meta {
  current_page: number;
  last_page: number;
  total: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  const fetchCustomers = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/customers', {
        params: { search, page },
      });
      setCustomers(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('顧客データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [search, page, router]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearchInput(''); setSearch(''); setPage(1); };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/customers/${id}`);
      fetchCustomers();
    } catch {
      alert('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  // ローディング
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );

  // エラー
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">⚠️</div>
      <p className="text-gray-600 font-medium">{error}</p>
      <Button onClick={fetchCustomers}>再試行</Button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">顧客一覧</h1>
          {meta && (
            <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件</p>
          )}
        </div>
        <Button
          onClick={() => router.push('/customers/create')}
          className="gap-1"
        >
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      {/* 検索 */}
      <Card className="mb-4 shadow-sm">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input
                className="pl-8 bg-white"
                placeholder="会社名・業種で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>検索</Button>
            {search && (
              <Button variant="ghost" size="sm" onClick={handleClear}
                className="text-gray-400 hover:text-gray-600">
                ✕ クリア
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* テーブル */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-3">会社名</TableHead>
                <TableHead className="font-semibold text-gray-600">業種</TableHead>
                <TableHead className="font-semibold text-gray-600">従業員数</TableHead>
                <TableHead className="font-semibold text-gray-600">電話番号</TableHead>
                <TableHead className="font-semibold text-gray-600">登録日</TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <span className="text-5xl">🏢</span>
                      <p className="font-medium text-gray-500">顧客が登録されていません</p>
                      <Button size="sm" variant="outline"
                        onClick={() => router.push('/customers/create')}>
                        最初の顧客を登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map(c => (
                  <TableRow
                    key={c.id}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <TableCell className="font-semibold text-blue-600 py-3">
                      {c.company_name}
                    </TableCell>
                    <TableCell>
                      {c.industry
                        ? <Badge variant="secondary" className="text-xs">{c.industry}</Badge>
                        : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {c.employee_count ? `${c.employee_count.toLocaleString()}名` : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {c.phone ?? <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {new Date(c.created_at).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button
                          title="詳細"
                          onClick={() => router.push(`/customers/${c.id}`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                        >
                          👁
                        </button>
                        <button
                          title="編集"
                          onClick={() => router.push(`/customers/${c.id}/edit`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                        >
                          ✏️
                        </button>
                        <button
                          title="削除"
                          disabled={deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          🗑
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ページネーション */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center items-center gap-3 mt-5">
          <Button variant="outline" size="sm" disabled={page === 1}
            onClick={() => setPage(p => p - 1)}>
            ← 前へ
          </Button>
          <span className="text-sm text-gray-500">
            {page} / {meta.last_page} ページ
          </span>
          <Button variant="outline" size="sm" disabled={page === meta.last_page}
            onClick={() => setPage(p => p + 1)}>
            次へ →
          </Button>
        </div>
      )}
    </div>
  );
}
