'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Activity {
  id: number;
  type: string;
  subject: string;
  content: string | null;
  activity_date: string;
}

interface Deal {
  id: number;
  title: string;
  amount: number;
  status: string;
  probability: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  notes: string | null;
  created_at: string;
  customer: { id: number; company_name: string } | null;
  contact: { id: number; name: string; position: string | null } | null;
  user: { id: number; name: string } | null;
  activities: Activity[];
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  成約: { bg: '#ECFDF5', color: '#065F46' },
  失注: { bg: '#FEF2F2', color: '#991B1B' },
  交渉: { bg: '#FFF3E0', color: '#E67E00' },
  提案: { bg: '#EFF6FF', color: '#1D4ED8' },
  新規: { bg: '#F1F5F9', color: '#475569' },
};

export default function DealDetailPage() {
  const [deal, setDeal]       = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchDeal = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get(`/api/v1/deals/${id}`);
      setDeal(res.data.data ?? res.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/deals');
      else setError('商談情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchDeal(); }, [fetchDeal]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/deals')}>一覧に戻る</Button>
        <Button onClick={fetchDeal}>再試行</Button>
      </div>
    </div>
  );

  if (!deal) return null;

  const style = STATUS_STYLE[deal.status] ?? STATUS_STYLE['新規'];

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              登録日: {new Date(deal.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <span className="text-sm px-3 py-1 rounded-full font-semibold"
                style={{ backgroundColor: style.bg, color: style.color }}>
            {deal.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/deals/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/deals')}>← 一覧に戻る</Button>
        </div>
      </div>

      {/* 基本情報 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">ℹ️ 基本情報</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">顧客</p>
              {deal.customer ? (
                <button className="text-sm text-blue-500 hover:underline font-medium"
                  onClick={() => router.push(`/customers/${deal.customer!.id}`)}>
                  {deal.customer.company_name}
                </button>
              ) : <p className="text-sm">-</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">担当者</p>
              <p className="text-sm font-medium">
                {deal.contact ? `${deal.contact.name}${deal.contact.position ? `（${deal.contact.position}）` : ''}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">営業担当</p>
              <p className="text-sm font-medium">{deal.user?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">予定金額</p>
              <p className="text-lg font-bold text-blue-600">¥{deal.amount?.toLocaleString() ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">ステータス</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: style.bg, color: style.color }}>
                {deal.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">成約確度</p>
              {deal.probability != null ? (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full"
                         style={{ width: `${deal.probability}%` }} />
                  </div>
                  <span className="text-sm font-bold">{deal.probability}%</span>
                </div>
              ) : '-'}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">予定成約日</p>
              <p className="text-sm font-medium">
                {deal.expected_close_date
                  ? new Date(deal.expected_close_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">実際の成約日</p>
              <p className="text-sm font-medium">
                {deal.actual_close_date
                  ? new Date(deal.actual_close_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '-'}
              </p>
            </div>
            {deal.notes && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-gray-400 mb-1">備考</p>
                <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 活動履歴 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            🕐 活動履歴
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
              {deal.activities?.length ?? 0}件
            </span>
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
              {deal.activities?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                    活動履歴が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                deal.activities?.map(a => (
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
