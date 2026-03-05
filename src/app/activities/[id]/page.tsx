'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Activity {
  id: number;
  type: string;
  subject: string;
  content: string | null;
  activity_date: string;
  customer: { id: number; company_name: string } | null;
  contact: { id: number; name: string } | null;
  deal: { id: number; title: string } | null;
  user: { id: number; name: string } | null;
}

const TYPE_STYLE: Record<string, { icon: string; bg: string; color: string }> = {
  訪問:   { icon: '🚶', bg: '#EFF6FF', color: '#2563EB' },
  電話:   { icon: '📞', bg: '#ECFDF5', color: '#10B981' },
  メール: { icon: '✉️', bg: '#FFF3E0', color: '#FF8C00' },
  その他: { icon: '•••', bg: '#F1F5F9', color: '#64748B' },
};

export default function ActivityDetailPage() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchActivity = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get(`/api/v1/activities/${id}`);
      setActivity(res.data.data ?? res.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/activities');
      else setError('活動履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/activities')}>一覧に戻る</Button>
        <Button onClick={fetchActivity}>再試行</Button>
      </div>
    </div>
  );

  if (!activity) return null;

  const style = TYPE_STYLE[activity.type] ?? TYPE_STYLE['その他'];

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
               style={{ backgroundColor: style.bg, color: style.color }}>
            {style.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{activity.subject}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: style.bg, color: style.color }}>
                {activity.type}
              </span>
              <span className="text-sm text-gray-400">
                {new Date(activity.activity_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/activities/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/activities')}>← 一覧に戻る</Button>
        </div>
      </div>

      {/* 基本情報 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">ℹ️ 基本情報</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">顧客</p>
              {activity.customer ? (
                <button className="text-sm text-blue-500 hover:underline font-medium"
                  onClick={() => router.push(`/customers/${activity.customer!.id}`)}>
                  {activity.customer.company_name}
                </button>
              ) : <p className="text-sm">-</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">担当者</p>
              {activity.contact ? (
                <button className="text-sm text-blue-500 hover:underline font-medium"
                  onClick={() => router.push(`/contacts/${activity.contact!.id}`)}>
                  {activity.contact.name}
                </button>
              ) : <p className="text-sm">-</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">関連商談</p>
              {activity.deal ? (
                <button className="text-sm text-blue-500 hover:underline font-medium"
                  onClick={() => router.push(`/deals/${activity.deal!.id}`)}>
                  {activity.deal.title}
                </button>
              ) : <p className="text-sm">-</p>}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">活動種別</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: style.bg, color: style.color }}>
                {style.icon} {activity.type}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">活動日</p>
              <p className="text-sm font-medium">
                {new Date(activity.activity_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">営業担当</p>
              <p className="text-sm font-medium">{activity.user?.name ?? '-'}</p>
            </div>
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs text-gray-400 mb-1">件名</p>
              <p className="text-sm font-bold">{activity.subject}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 内容 */}
      {activity.content && (
        <Card>
          <CardHeader><CardTitle className="text-base">📝 内容</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-md p-4 text-sm whitespace-pre-wrap leading-relaxed">
              {activity.content}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
