'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BusinessCard {
  id: number;
  company_name: string | null;
  person_name: string | null;
  department: string | null;
  position: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  image_path: string | null;
  status: string;
  ocr_text: string | null;
  created_at: string;
}

export default function BusinessCardDetailPage() {
  const [card, setCard] = useState<BusinessCard | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    fetchCard();
  }, []);

  const fetchCard = async () => {
    try {
      const res = await apiClient.get(`/api/v1/cards/${id}`);
      setCard(res.data.data ?? res.data);
    } catch {
      router.push('/business-cards');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered': return <Badge className="bg-green-500">登録済み</Badge>;
      case 'processed':  return <Badge className="bg-blue-500">処理済み</Badge>;
      case 'pending':    return <Badge variant="secondary">保留中</Badge>;
      default:           return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.push('/business-cards')}>
          ← 戻る
        </Button>
        <h1 className="text-2xl font-bold">名刺詳細</h1>
        <div className="ml-auto flex gap-2">
          {getStatusBadge(card.status)}
          <Button onClick={() => router.push(`/business-cards/${id}/edit`)}>
            編集
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 名刺画像 */}
        <Card>
          <CardHeader><CardTitle className="text-base">名刺画像</CardTitle></CardHeader>
          <CardContent>
            {card.image_path ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL}/storage/${card.image_path}`}
                alt="名刺"
                className="w-full rounded border"
              />
            ) : (
              <div className="h-40 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-gray-400">画像なし</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 基本情報 */}
        <Card>
          <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '会社名',   value: card.company_name },
              { label: '氏名',     value: card.person_name },
              { label: '部署',     value: card.department },
              { label: '役職',     value: card.position },
              { label: '郵便番号', value: card.postal_code },
              { label: '住所',     value: card.address },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="text-sm text-gray-500 w-24 shrink-0">{label}</span>
                <span className="text-sm">{value ?? '-'}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 連絡先 */}
        <Card>
          <CardHeader><CardTitle className="text-base">連絡先</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'メール',    value: card.email },
              { label: '電話',      value: card.phone },
              { label: '携帯',      value: card.mobile },
              { label: 'FAX',       value: card.fax },
              { label: 'Webサイト', value: card.website },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <span className="text-sm text-gray-500 w-24 shrink-0">{label}</span>
                <span className="text-sm">{value ?? '-'}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* OCRテキスト */}
        {card.ocr_text && (
          <Card>
            <CardHeader><CardTitle className="text-base">OCR読み取りテキスト</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {card.ocr_text}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 登録日 */}
      <p className="text-sm text-gray-400 mt-6 text-right">
        登録日: {new Date(card.created_at).toLocaleDateString('ja-JP')}
      </p>
    </div>
  );
}
