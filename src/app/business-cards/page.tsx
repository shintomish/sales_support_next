'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface BusinessCard {
  id: number;
  company_name: string | null;
  person_name: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: string;
  image_path: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  registered: { label: '登録済み', bg: '#ECFDF5', color: '#065F46' },
  processed:  { label: '処理済み', bg: '#EFF6FF', color: '#1D4ED8' },
  pending:    { label: '保留中',   bg: '#F1F5F9', color: '#475569' },
};

export default function BusinessCardsPage() {
  const [cards, setCards]     = useState<BusinessCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  const fetchCards = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/cards');
      setCards(res.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('名刺の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

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
      <Button onClick={fetchCards}>再試行</Button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">名刺管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">全 {cards.length} 件</p>
        </div>
        <Button onClick={() => router.push('/business-cards/create')} className="gap-1">
          <span className="text-base">↑</span> アップロード
        </Button>
      </div>

      {/* テーブル */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-600 py-3">画像</TableHead>
                <TableHead className="font-semibold text-gray-600">会社名</TableHead>
                <TableHead className="font-semibold text-gray-600">氏名</TableHead>
                <TableHead className="font-semibold text-gray-600">役職</TableHead>
                <TableHead className="font-semibold text-gray-600">連絡先</TableHead>
                <TableHead className="font-semibold text-gray-600">ステータス</TableHead>
                <TableHead className="font-semibold text-gray-600">登録日</TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <span className="text-5xl">🪪</span>
                      <p className="font-medium text-gray-500">名刺が登録されていません</p>
                      <Button size="sm" variant="outline"
                        onClick={() => router.push('/business-cards/create')}>
                        名刺をアップロードする
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cards.map(card => {
                  const statusStyle = STATUS_STYLE[card.status] ?? { label: card.status, bg: '#F1F5F9', color: '#475569' };
                  return (
                    <TableRow key={card.id}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors border-b last:border-0"
                      onClick={() => router.push(`/business-cards/${card.id}`)}>
                      <TableCell className="py-3">
                        {card.image_path ? (
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL}/storage/${card.image_path}`}
                            alt={`${card.person_name ?? ''}の名刺`}
                            className="h-14 w-20 object-cover rounded-md shadow-sm border border-gray-100"
                          />
                        ) : (
                          <div className="h-14 w-20 bg-gray-100 rounded-md flex items-center justify-center border border-gray-200">
                            <span className="text-xs text-gray-400">画像なし</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-700">{card.company_name ?? <span className="text-gray-300">—</span>}</TableCell>
                      <TableCell className="font-semibold text-gray-800">{card.person_name ?? <span className="text-gray-300">—</span>}</TableCell>
                      <TableCell className="text-gray-600 text-sm">{card.position ?? <span className="text-gray-300">—</span>}</TableCell>
                      <TableCell>
                        {card.email && <div className="text-sm text-gray-600">{card.email}</div>}
                        {(card.mobile ?? card.phone) && (
                          <div className="text-sm text-gray-400">{card.mobile ?? card.phone}</div>
                        )}
                        {!card.email && !card.mobile && !card.phone && <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {new Date(card.created_at).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button title="詳細" onClick={() => router.push(`/business-cards/${card.id}`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">👁</button>
                          <button title="編集" onClick={() => router.push(`/business-cards/${card.id}/edit`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">✏️</button>
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
    </div>
  );
}
