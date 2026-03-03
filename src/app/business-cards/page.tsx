'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  const router = useRouter();

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await apiClient.get('/api/v1/cards');
      setCards(res.data.data);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return <Badge className="bg-green-500">登録済み</Badge>;
      case 'processed':
        return <Badge className="bg-blue-500">処理済み</Badge>;
      case 'pending':
        return <Badge variant="secondary">保留中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
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
                  <TableRow key={card.id}>
                    <TableCell>
                      {card.image_path ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL}/storage/${card.image_path}`}
                          alt="名刺"
                          className="h-16 w-24 object-cover rounded"
                        />
                      ) : (
                        <div className="h-16 w-24 bg-gray-100 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-400">画像なし</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{card.company_name ?? '-'}</TableCell>
                    <TableCell>{card.person_name ?? '-'}</TableCell>
                    <TableCell>{card.position ?? '-'}</TableCell>
                    <TableCell>
                      <div>{card.email}</div>
                      <div className="text-sm text-gray-500">
                        {card.mobile ?? card.phone}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(card.status)}</TableCell>
                    <TableCell>
                      {new Date(card.created_at).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/business-cards/${card.id}`)}
                        >
                          詳細
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/business-cards/${card.id}/edit`)}
                        >
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
