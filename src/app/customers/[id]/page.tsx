'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
}

interface Deal {
  id: number;
  title: string;
  amount: number;
  status: string;
  probability: number | null;
  expected_close_date: string | null;
}

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
  contacts: Contact[];
  deals: Deal[];
}

const DEAL_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  成約: { bg: '#ECFDF5', color: '#065F46' },
  失注: { bg: '#FEF2F2', color: '#991B1B' },
  交渉: { bg: '#FFFBEB', color: '#92400E' },
  提案: { bg: '#EFF6FF', color: '#1E40AF' },
  新規: { bg: '#F1F5F9', color: '#475569' },
};

export default function CustomerDetailPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchCustomer = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get(`/api/v1/customers/${id}`);
      setCustomer(res.data.data ?? res.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/customers');
      else setError('顧客情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/customers')}>一覧に戻る</Button>
        <Button onClick={fetchCustomer}>再試行</Button>
      </div>
    </div>
  );

  if (!customer) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{customer.company_name}</h1>
          <p className="text-sm text-gray-400 mt-1">
            登録日: {new Date(customer.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/customers/${id}/edit`)}>
            ✏️ 編集
          </Button>
            <Button variant="outline" onClick={() => router.push('/customers')}>← 一覧に戻る
          </Button>
        </div>
      </div>

      {/* 基本情報 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">ℹ️ 基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { label: '会社名',   value: customer.company_name },
              { label: '業種',     value: customer.industry
                ? <Badge variant="secondary">{customer.industry}</Badge>
                : '-' },
              { label: '従業員数', value: customer.employee_count
                ? `${customer.employee_count.toLocaleString()}名`
                : '-' },
              { label: '電話番号', value: customer.phone
                ? <a href={`tel:${customer.phone}`} className="text-blue-500 hover:underline">{customer.phone}</a>
                : '-' },
              { label: '住所',     value: customer.address ?? '-' },
              { label: 'ウェブサイト', value: customer.website
                ? <a href={customer.website} target="_blank" rel="noopener noreferrer"
                     className="text-blue-500 hover:underline truncate block">{customer.website}</a>
                : '-' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
            {customer.notes && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-gray-400 mb-1">備考</p>
                <p className="text-sm font-medium whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 担当者一覧 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            👤 担当者
            <Badge variant="secondary">{customer.contacts?.length ?? 0}名</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>役職</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>電話番号</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.contacts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                    担当者が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                customer.contacts?.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.department ?? '-'}</TableCell>
                    <TableCell>{c.position ?? '-'}</TableCell>
                    <TableCell>
                      {c.email
                        ? <a href={`mailto:${c.email}`} className="text-blue-500 hover:underline">{c.email}</a>
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {c.phone
                        ? <a href={`tel:${c.phone}`} className="text-blue-500 hover:underline">{c.phone}</a>
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 商談一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            💼 商談
            <Badge variant="secondary">{customer.deals?.length ?? 0}件</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商談名</TableHead>
                <TableHead>金額</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>成約確度</TableHead>
                <TableHead>予定成約日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.deals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                    商談が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                customer.deals?.map(d => {
                  const style = DEAL_STATUS_STYLE[d.status] ?? DEAL_STATUS_STYLE['新規'];
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell>¥{d.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: style.bg, color: style.color }}>
                          {d.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {d.probability != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full"
                                   style={{ width: `${d.probability}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{d.probability}%</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {d.expected_close_date
                          ? new Date(d.expected_close_date).toLocaleDateString('ja-JP')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
