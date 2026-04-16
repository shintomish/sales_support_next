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
  fax: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  is_supplier: boolean;
  is_customer: boolean;
  invoice_number: string | null;
  payment_site: number | null;
  vendor_payment_site: number | null;
  primary_contact: { id: number; name: string; email: string | null } | null;
  created_at: string;
  contacts: Contact[];
  deals: Deal[];
}

const DEAL_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  成約: { bg: '#ECFDF5', color: '#065F46' },
  失注: { bg: '#FEF2F2', color: '#991B1B' },
  交渉: { bg: '#FFF3E0', color: '#E67E00' },
  提案: { bg: '#EFF6FF', color: '#1D4ED8' },
  新規: { bg: '#F1F5F9', color: '#475569' },
};

const Em = () => <span className="text-gray-300">—</span>;

export default function CustomerDetailPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
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

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

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
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/customers')}>一覧に戻る</Button>
        <Button onClick={fetchCustomer}>再試行</Button>
      </div>
    </div>
  );

  if (!customer) return null;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">

      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-800">{customer.company_name}</h1>
            {customer.is_customer && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">売上先</Badge>}
            {customer.is_supplier && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">仕入先</Badge>}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            登録日: {new Date(customer.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/customers/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/customers')}>← 一覧に戻る</Button>
        </div>
      </div>

      {/* 基本情報 */}
      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">ℹ️ 基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">会社名</p>
              <p className="text-sm font-medium text-gray-800">{customer.company_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">業種</p>
              {customer.industry
                ? <Badge variant="secondary">{customer.industry}</Badge>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">従業員数</p>
              <p className="text-sm font-medium text-gray-800">
                {customer.employee_count ? `${customer.employee_count.toLocaleString()}名` : <Em />}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">電話番号</p>
              {customer.phone
                ? <a href={`tel:${customer.phone}`} className="text-sm text-blue-500 hover:underline font-medium">{customer.phone}</a>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">FAX</p>
              <p className="text-sm font-medium text-gray-800">{customer.fax ?? <Em />}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">住所</p>
              <p className="text-sm font-medium text-gray-800">{customer.address ?? <Em />}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">ウェブサイト</p>
              {customer.website
                ? <a href={customer.website} target="_blank" rel="noopener noreferrer"
                     className="text-sm text-blue-500 hover:underline truncate block">{customer.website}</a>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">適格請求書番号</p>
              <p className="text-sm font-medium text-gray-800">{customer.invoice_number ?? <Em />}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">入金サイト（売上先）</p>
              <p className="text-sm font-medium text-gray-800">
                {customer.payment_site != null ? `${customer.payment_site}日` : <Em />}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">支払サイト（仕入先）</p>
              <p className="text-sm font-medium text-gray-800">
                {customer.vendor_payment_site != null ? `${customer.vendor_payment_site}日` : <Em />}
              </p>
            </div>
            {customer.primary_contact && (
              <div>
                <p className="text-xs text-gray-400 mb-1">主担当者</p>
                <p
                  className="text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                  onClick={() => router.push(`/contacts/${customer.primary_contact!.id}`)}
                >
                  {customer.primary_contact.name}
                  {customer.primary_contact.email && (
                    <span className="text-gray-400 font-normal ml-1">({customer.primary_contact.email})</span>
                  )}
                </p>
              </div>
            )}
            {customer.notes && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-gray-400 mb-2">備考</p>
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                  {customer.notes}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 担当者一覧 */}
      <Card className="mb-4 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700 flex items-center gap-2">
            👤 担当者
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-normal">
              {customer.contacts?.length ?? 0}名
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-2">氏名</TableHead>
                <TableHead className="font-semibold text-gray-600">部署</TableHead>
                <TableHead className="font-semibold text-gray-600">役職</TableHead>
                <TableHead className="font-semibold text-gray-600">メール</TableHead>
                <TableHead className="font-semibold text-gray-600">電話番号</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.contacts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <span className="text-3xl">👤</span>
                      <p className="text-sm">担当者が登録されていません</p>
                      <Button size="sm" variant="outline"
                        onClick={() => router.push(`/contacts/create?customer_id=${id}`)}>
                        担当者を登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customer.contacts?.map(c => (
                  <TableRow key={c.id}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                    onClick={() => router.push(`/contacts/${c.id}`)}>
                    <TableCell className="font-semibold text-blue-600 py-2">{c.name}</TableCell>
                    <TableCell className="text-gray-600">{c.department ?? <Em />}</TableCell>
                    <TableCell className="text-gray-600">{c.position ?? <Em />}</TableCell>
                    <TableCell>
                      {c.email
                        ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                             className="text-sm text-blue-500 hover:underline">{c.email}</a>
                        : <Em />}
                    </TableCell>
                    <TableCell>
                      {c.phone
                        ? <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                             className="text-sm text-blue-500 hover:underline">{c.phone}</a>
                        : <Em />}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 商談一覧 */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700 flex items-center gap-2">
            💼 商談
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-normal">
              {customer.deals?.length ?? 0}件
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-2">商談名</TableHead>
                <TableHead className="font-semibold text-gray-600">金額</TableHead>
                <TableHead className="font-semibold text-gray-600">ステータス</TableHead>
                <TableHead className="font-semibold text-gray-600">成約確度</TableHead>
                <TableHead className="font-semibold text-gray-600">予定成約日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.deals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <span className="text-3xl">💼</span>
                      <p className="text-sm">商談が登録されていません</p>
                      <Button size="sm" variant="outline"
                        onClick={() => router.push(`/deals/create?customer_id=${id}`)}>
                        商談を登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customer.deals?.map(d => {
                  const style = DEAL_STATUS_STYLE[d.status] ?? DEAL_STATUS_STYLE['新規'];
                  return (
                    <TableRow key={d.id}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                      onClick={() => router.push(`/deals/${d.id}`)}>
                      <TableCell className="font-semibold text-blue-600 py-2">{d.title}</TableCell>
                      <TableCell className="font-semibold text-gray-700">
                        ¥{Number(d.amount).toLocaleString()}
                      </TableCell>
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
                        ) : <Em />}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {d.expected_close_date
                          ? new Date(d.expected_close_date).toLocaleDateString('ja-JP')
                          : <Em />}
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
