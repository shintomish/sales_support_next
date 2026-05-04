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
import type { ApiError } from '@/lib/error-helpers';

interface Activity {
  id: number; type: string; subject: string;
  content: string | null; activity_date: string;
}
interface Deal {
  id: number; title: string; amount: number; status: string;
  probability: number | null; expected_close_date: string | null;
  actual_close_date: string | null; notes: string | null; created_at: string;
  customer: { id: number; company_name: string } | null;
  contact: { id: number; name: string; position: string | null } | null;
  user: { id: number; name: string } | null;
  activities: Activity[];
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  成約: { bg: '#ECFDF5', color: '#065F46' }, 失注: { bg: '#FEF2F2', color: '#991B1B' },
  交渉: { bg: '#FFF3E0', color: '#E67E00' }, 提案: { bg: '#EFF6FF', color: '#1D4ED8' },
  新規: { bg: '#F1F5F9', color: '#475569' },
};
const ACT_STYLE: Record<string, { bg: string; color: string }> = {
  訪問: { bg: '#EFF6FF', color: '#2563EB' }, 電話: { bg: '#ECFDF5', color: '#10B981' },
  メール: { bg: '#FFF3E0', color: '#FF8C00' }, その他: { bg: '#F1F5F9', color: '#64748B' },
};
const Em = () => <span className="text-gray-300">—</span>;

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
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else if ((err as ApiError).response?.status === 404) router.push('/deals');
      else setError('商談情報の取得に失敗しました');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchDeal(); }, [fetchDeal]);

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
        <Button variant="outline" onClick={() => router.push('/deals')}>一覧に戻る</Button>
        <Button onClick={fetchDeal}>再試行</Button>
      </div>
    </div>
  );
  if (!deal) return null;

  const style = STATUS_STYLE[deal.status] ?? STATUS_STYLE['新規'];

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{deal.title}</h1>
            <span className="text-sm px-3 py-1 rounded-full font-semibold"
                  style={{ backgroundColor: style.bg, color: style.color }}>{deal.status}</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            登録日: {new Date(deal.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/deals/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/deals')}>← 一覧に戻る</Button>
        </div>
      </div>

      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base text-gray-700">ℹ️ 基本情報</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">顧客</p>
              {deal.customer
                ? <button className="text-sm text-blue-500 hover:underline font-medium"
                    onClick={() => router.push(`/customers/${deal.customer!.id}`)}>{deal.customer.company_name}</button>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">担当者</p>
              {deal.contact
                ? <button className="text-sm text-blue-500 hover:underline font-medium"
                    onClick={() => router.push(`/contacts/${deal.contact!.id}`)}>
                    {deal.contact.name}{deal.contact.position ? `（${deal.contact.position}）` : ''}
                  </button>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">営業担当</p>
              <p className="text-sm font-medium text-gray-800">{deal.user?.name ?? <Em />}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">予定金額</p>
              <p className="text-xl font-bold text-blue-600">¥{Number(deal.amount).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">ステータス</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: style.bg, color: style.color }}>{deal.status}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">成約確度</p>
              {deal.probability != null ? (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${deal.probability}%` }} />
                  </div>
                  <span className="text-sm font-bold">{deal.probability}%</span>
                </div>
              ) : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">予定成約日</p>
              <p className="text-sm font-medium text-gray-800">
                {deal.expected_close_date
                  ? new Date(deal.expected_close_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                  : <Em />}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">実際の成約日</p>
              <p className="text-sm font-medium text-gray-800">
                {deal.actual_close_date
                  ? new Date(deal.actual_close_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                  : <Em />}
              </p>
            </div>
            {deal.notes && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-gray-400 mb-2">備考</p>
                <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">{deal.notes}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700 flex items-center gap-2">
            🕐 活動履歴
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-normal">{deal.activities?.length ?? 0}件</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-2">活動日</TableHead>
                <TableHead className="font-semibold text-gray-600">種別</TableHead>
                <TableHead className="font-semibold text-gray-600">件名</TableHead>
                <TableHead className="font-semibold text-gray-600">内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deal.activities?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-10">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <span className="text-3xl">🕐</span><p className="text-sm">活動履歴が登録されていません</p>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/activities/create?deal_id=${id}`)}>
                      活動を登録する
                    </Button>
                  </div>
                </TableCell></TableRow>
              ) : deal.activities?.map(a => {
                const aStyle = ACT_STYLE[a.type] ?? ACT_STYLE['その他'];
                return (
                  <TableRow key={a.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                    onClick={() => router.push(`/activities/${a.id}`)}>
                    <TableCell className="text-sm text-gray-400 whitespace-nowrap py-2">{new Date(a.activity_date).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: aStyle.bg, color: aStyle.color }}>{a.type}</span>
                    </TableCell>
                    <TableCell className="font-medium text-gray-700">{a.subject}</TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {a.content ? a.content.slice(0, 50) + (a.content.length > 50 ? '…' : '') : <Em />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
