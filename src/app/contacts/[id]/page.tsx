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

interface Deal {
  id: number;
  title: string;
  amount: number;
  status: string;
  probability: number | null;
  expected_close_date: string | null;
}

interface Activity {
  id: number;
  type: string;
  subject: string;
  content: string | null;
  activity_date: string;
}

interface Contact {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  customer: { id: number; company_name: string } | null;
  deals: Deal[];
  activities: Activity[];
  created_at: string;
}

const DEAL_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  成約: { bg: '#ECFDF5', color: '#065F46' },
  失注: { bg: '#FEF2F2', color: '#991B1B' },
  交渉: { bg: '#FFF3E0', color: '#E67E00' },
  提案: { bg: '#EFF6FF', color: '#1D4ED8' },
  新規: { bg: '#F1F5F9', color: '#475569' },
};

export default function ContactDetailPage() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchContact = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get(`/api/v1/contacts/${id}`);
      setContact(res.data.data ?? res.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/contacts');
      else setError('担当者情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchContact(); }, [fetchContact]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/contacts')}>一覧に戻る</Button>
        <Button onClick={fetchContact}>再試行</Button>
      </div>
    </div>
  );

  if (!contact) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          {contact.customer && (
            <button
              className="text-sm text-gray-400 mt-1 hover:text-blue-500"
              onClick={() => router.push(`/customers/${contact.customer!.id}`)}
            >
              🏢 {contact.customer.company_name}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/contacts/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/contacts')}>← 一覧に戻る</Button>
        </div>
      </div>

      {/* 基本情報 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">ℹ️ 基本情報</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { label: '氏名',     value: <span className="font-bold">{contact.name}</span> },
              { label: '会社名',   value: contact.customer
                ? <button className="text-blue-500 hover:underline"
                    onClick={() => router.push(`/customers/${contact.customer!.id}`)}>
                    {contact.customer.company_name}
                  </button>
                : '-' },
              { label: '部署',     value: contact.department ?? '-' },
              { label: '役職',     value: contact.position
                ? <Badge variant="secondary">{contact.position}</Badge>
                : '-' },
              { label: 'メール',   value: contact.email
                ? <a href={`mailto:${contact.email}`} className="text-blue-500 hover:underline">
                    {contact.email}
                  </a>
                : '-' },
              { label: '電話番号', value: contact.phone
                ? <a href={`tel:${contact.phone}`} className="text-blue-500 hover:underline">
                    {contact.phone}
                  </a>
                : '-' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
            {contact.notes && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-gray-400 mb-1">備考</p>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 関連商談 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            💼 関連商談
            <Badge variant="secondary">{contact.deals?.length ?? 0}件</Badge>
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
              {contact.deals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                    関連する商談がありません
                  </TableCell>
                </TableRow>
              ) : (
                contact.deals?.map(d => {
                  const style = DEAL_STATUS_STYLE[d.status] ?? DEAL_STATUS_STYLE['新規'];
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-blue-600">{d.title}</TableCell>
                      <TableCell className="font-bold">¥{d.amount.toLocaleString()}</TableCell>
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

      {/* 活動履歴 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            🕐 活動履歴
            <Badge variant="secondary">{contact.activities?.length ?? 0}件</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>活動日</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>件名</TableHead>
                <TableHead>内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contact.activities?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                    活動履歴が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                contact.activities?.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(a.activity_date).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {a.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{a.subject}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {a.content ? a.content.slice(0, 50) + (a.content.length > 50 ? '…' : '') : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
