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

interface Contact {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  customer: { id: number; company_name: string } | null;
  created_at: string;
}

interface Customer {
  id: number;
  company_name: string;
}

interface Meta {
  current_page: number;
  last_page: number;
  total: number;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchContacts = useCallback(async () => {
    try {
      setError(null);
      const [contactsRes, customersRes] = await Promise.all([
        apiClient.get('/api/v1/contacts', { params: { search, customer_id: customerId, page } }),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
      ]);
      setContacts(contactsRes.data.data);
      setMeta(contactsRes.data.meta);
      setCustomers(customersRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('担当者データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [search, customerId, page, router]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearchInput(''); setSearch(''); setCustomerId(''); setPage(1); };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await apiClient.delete(`/api/v1/contacts/${id}`);
      fetchContacts();
    } catch {
      alert('削除に失敗しました');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <Button onClick={fetchContacts}>再試行</Button>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">担当者一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-1">全 {meta.total} 件</p>}
        </div>
        <Button onClick={() => router.push('/contacts/create')}>+ 新規登録</Button>
      </div>

      {/* 検索 */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input
                className="pl-8"
                placeholder="氏名・部署・役職・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <select
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-2 text-sm min-w-40"
            >
              <option value="">全顧客</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            <Button onClick={handleSearch}>検索</Button>
            {(search || customerId) && (
              <Button variant="outline" onClick={handleClear}>✕ クリア</Button>
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
                <TableHead>氏名</TableHead>
                <TableHead>会社名</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>役職</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-12">
                    <p className="text-3xl mb-2">👤</p>
                    担当者が登録されていません
                    <div className="mt-3">
                      <Button size="sm" onClick={() => router.push('/contacts/create')}>
                        最初の担当者を登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map(c => (
                  <TableRow key={c.id} className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/contacts/${c.id}`)}>
                    <TableCell className="font-semibold text-blue-600">{c.name}</TableCell>
                    <TableCell>
                      <span
                        className="text-sm text-gray-500 hover:text-blue-500 cursor-pointer"
                        onClick={e => { e.stopPropagation(); router.push(`/customers/${c.customer?.id}`); }}
                      >
                        {c.customer?.company_name ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell>{c.department ?? '-'}</TableCell>
                    <TableCell>
                      {c.position
                        ? <Badge variant="secondary">{c.position}</Badge>
                        : <span className="text-gray-400">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">{c.email ?? '-'}</TableCell>
                    <TableCell className="text-sm">{c.phone ?? '-'}</TableCell>
                    <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="outline"
                          onClick={() => router.push(`/contacts/${c.id}`)}>詳細</Button>
                        <Button size="sm" variant="outline"
                          onClick={() => router.push(`/contacts/${c.id}/edit`)}>編集</Button>
                        <Button size="sm" variant="outline"
                          className="text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => handleDelete(c.id)}>削除</Button>
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
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="flex items-center text-sm text-gray-500">{page} / {meta.last_page}</span>
          <Button variant="outline" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}
    </div>
  );
}
