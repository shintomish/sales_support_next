'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function BusinessCardsPage() {
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ★ エラー状態を追加
  const router = useRouter();
  const fetchUser = useAuthStore((state) => state.fetchUser);

  const fetchCards = useCallback(async () => { // ★ useCallbackで安定化
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/cards');
      setCards(res.data.data);
    } catch (err: any) {
      // ★ 401のみloginへ、それ以外はエラー表示
      if (err.response?.status === 401) {
        router.push('/login');
      } else {
        setError('名刺の取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUser().then(() => fetchCards());
  }, [fetchCards]); // ★ 依存配列を明示

  const getStatusBadge = (status: string) => {
    const map: Record<string, JSX.Element> = {
      registered: <Badge className="bg-green-500">登録済み</Badge>,
      processed: <Badge className="bg-blue-500">処理済み</Badge>,
      pending: <Badge variant="secondary">保留中</Badge>,
    };
    return map[status] ?? <Badge variant="outline">{status}</Badge>; // ★ switch→オブジェクトで簡潔に
  };

  // ★ 各状態を個別に返す（loading/error/空を分離）
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchCards}>再試行</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">名刺管理</h1>
        <Button onClick={() => router.push('/business-cards/create')}>
          アップロード
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>画像</TableHead>
                <TableHead>会社名</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead>役職</TableHead>
                <TableHead>連絡先</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    名刺が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((card) => (
                  <TableRow key={card.id} className="hover:bg-muted/50 cursor-pointer" // ★ ホバー追加
                    onClick={() => router.push(`/business-cards/${card.id}`)}>
                    <TableCell>
                      {card.image_path ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL}/storage/${card.image_path}`}
                          alt={`${card.person_name ?? ''}の名刺`} // ★ alt改善
                          className="h-16 w-24 object-cover rounded"
                        />
                      ) : (
                        <div className="h-16 w-24 bg-gray-100 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-400">画像なし</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{card.company_name ?? '-'}</TableCell>
                    <TableCell className="font-medium">{card.person_name ?? '-'}</TableCell>
                    <TableCell>{card.position ?? '-'}</TableCell>
                    <TableCell>
                      <div>{card.email}</div>
                      <div className="text-sm text-gray-500">{card.mobile ?? card.phone}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(card.status)}</TableCell>
                    <TableCell>{new Date(card.created_at).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline"
                          onClick={() => router.push(`/business-cards/${card.id}`)}>
                          詳細
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => router.push(`/business-cards/${card.id}/edit`)}>
                          編集
                        </Button>
                      </div>
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
