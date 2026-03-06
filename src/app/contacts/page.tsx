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

interface Contact {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  customer: { id: number; company_name: string } | null;
}

interface Meta { current_page: number; last_page: number; total: number; }
interface Customer { id: number; company_name: string; }

export default function ContactsPage() {
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  const fetchContacts = useCallback(async () => {
    try {
      setError(null);
      const [cRes, cusRes] = await Promise.all([
        apiClient.get('/api/v1/contacts', { params: { search, customer_id: customerFilter, page } }),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
      ]);
      setContacts(cRes.data.data);
      setMeta(cRes.data.meta);
      setCustomers(cusRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('担当者データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [search, customerFilter, page, router]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearchInput(''); setSearch(''); setCustomerFilter(''); setPage(1); };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/contacts/${id}`);
      fetchContacts();
    } catch { alert('削除に失敗しました'); }
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

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">担当者一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件</p>}
        </div>
        <Button onClick={() => router.push('/contacts/create')} className="gap-1">
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      <Card className="mb-4 shadow-sm">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="氏名・部署・役職・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-2 text-sm bg-white min-w-36">
              <option value="">全顧客</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <Button onClick={handleSearch}>検索</Button>
            {(search || customerFilter) && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">
                ✕ クリア
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-3">氏名</TableHead>
                <TableHead className="font-semibold text-gray-600">会社名</TableHead>
                <TableHead className="font-semibold text-gray-600">部署</TableHead>
                <TableHead className="font-semibold text-gray-600">役職</TableHead>
                <TableHead className="font-semibold text-gray-600">メール</TableHead>
                <TableHead className="font-semibold text-gray-600">電話番号</TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <span className="text-5xl">👤</span>
                      <p className="font-medium text-gray-500">担当者が登録されていません</p>
                      <Button size="sm" variant="outline" onClick={() => router.push('/contacts/create')}>
                        最初の担当者を登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map(c => (
                  <TableRow key={c.id}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                    onClick={() => router.push(`/contacts/${c.id}`)}>
                    <TableCell className="font-semibold text-blue-600 py-3">{c.name}</TableCell>
                    <TableCell>
                      <button className="text-sm text-gray-500 hover:text-blue-500 hover:underline"
                        onClick={e => { e.stopPropagation(); router.push(`/customers/${c.customer?.id}`); }}>
                        {c.customer?.company_name ?? <span className="text-gray-300">—</span>}
                      </button>
                    </TableCell>
                    <TableCell className="text-gray-600">{c.department ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-gray-600">{c.position ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.email ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.phone ?? <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button title="詳細" onClick={() => router.push(`/contacts/${c.id}`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">👁</button>
                        <button title="編集" onClick={() => router.push(`/contacts/${c.id}/edit`)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">✏️</button>
                        <button title="削除" disabled={deletingId === c.id} onClick={() => handleDelete(c.id)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40">🗑</button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
