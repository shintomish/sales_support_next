'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BusinessCard {
  id: number;
  company_name: string | null; person_name: string | null;
  department: string | null;  position: string | null;
  postal_code: string | null; address: string | null;
  phone: string | null;       mobile: string | null;
  fax: string | null;         email: string | null;
  website: string | null;     image_path: string | null;
  status: string;             ocr_text: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  registered: { bg: '#ECFDF5', color: '#065F46', label: '登録済み' },
  processed:  { bg: '#EFF6FF', color: '#1D4ED8', label: '処理済み' },
  pending:    { bg: '#F1F5F9', color: '#475569', label: '保留中' },
};

const Em = () => <span className="text-gray-300">—</span>;

export default function BusinessCardDetailPage() {
  const [card, setCard]       = useState<BusinessCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchCard = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get(`/api/v1/cards/${id}`);
      setCard(res.data.data ?? res.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/business-cards');
      else setError('名刺情報の取得に失敗しました');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

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
        <Button variant="outline" onClick={() => router.push('/business-cards')}>一覧に戻る</Button>
        <Button onClick={fetchCard}>再試行</Button>
      </div>
    </div>
  );

  if (!card) return null;

  const statusStyle = STATUS_STYLE[card.status] ?? { bg: '#F1F5F9', color: '#475569', label: card.status };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">

      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {card.person_name ?? '氏名未登録'}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
              {statusStyle.label}
            </span>
            {card.company_name && (
              <span className="text-sm text-gray-500">🏢 {card.company_name}</span>
            )}
            <span className="text-xs text-gray-400">
              登録日: {new Date(card.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/business-cards/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/business-cards')}>← 一覧に戻る</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 名刺画像 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-700">🪪 名刺画像</CardTitle>
          </CardHeader>
          <CardContent>
            {card.image_path ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL}/storage/${card.image_path}`}
                alt={`${card.person_name ?? ''}の名刺`}
                className="w-full rounded-lg border border-gray-100 shadow-sm"
              />
            ) : (
              <div className="h-44 bg-gray-50 rounded-lg flex flex-col items-center justify-center gap-2 border border-dashed border-gray-200">
                <span className="text-3xl">🪪</span>
                <span className="text-sm text-gray-400">画像なし</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 基本情報 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-700">ℹ️ 基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: '会社名',   value: card.company_name },
                { label: '氏名',     value: card.person_name },
                { label: '部署',     value: card.department },
                { label: '役職',     value: card.position },
                { label: '郵便番号', value: card.postal_code },
                { label: '住所',     value: card.address },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value ?? <Em />}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 連絡先 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-700">📞 連絡先</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">メール</p>
                {card.email
                  ? <a href={`mailto:${card.email}`} className="text-sm text-blue-500 hover:underline font-medium">{card.email}</a>
                  : <Em />}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">電話</p>
                {card.phone
                  ? <a href={`tel:${card.phone}`} className="text-sm text-blue-500 hover:underline font-medium">{card.phone}</a>
                  : <Em />}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">携帯</p>
                {card.mobile
                  ? <a href={`tel:${card.mobile}`} className="text-sm text-blue-500 hover:underline font-medium">{card.mobile}</a>
                  : <Em />}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">FAX</p>
                <p className="text-sm font-medium text-gray-800">{card.fax ?? <Em />}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Webサイト</p>
                {card.website
                  ? <a href={card.website} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-blue-500 hover:underline truncate block">{card.website}</a>
                  : <Em />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OCRテキスト */}
        {card.ocr_text && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-700">📝 OCR読み取りテキスト</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {card.ocr_text}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
