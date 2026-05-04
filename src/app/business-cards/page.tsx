'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';
import UserFilter, { defaultUserFilter } from '@/components/UserFilter';
import SortableHeader from '@/components/SortableHeader';
import type { ApiError } from '@/lib/error-helpers';

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

// ヘッダー・ボディで幅を揃えるcolgroup定義
const ColGroup = () => (
  <colgroup>
    <col style={{ width: '10%' }} />
    <col style={{ width: '18%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '20%' }} />
    <col style={{ width: '11%' }} />
    <col style={{ width: '10%' }} />
    <col style={{ width: '7%' }} />
  </colgroup>
);

export default function BusinessCardsPage() {
  const [cards, setCards]     = useState<BusinessCard[]>([]);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuthStore();
  const [userFilter, setUserFilter] = useState<string>('all');
  useEffect(() => { setUserFilter(defaultUserFilter(user)); }, [user]);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('asc'); }
  };

  const fetchCards = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/cards', { params: { user_id: userFilter, sort_by: sortField, sort_order: sortOrder } });
      setCards(res.data.data);
      if (userFilter === 'all') setGrandTotal(res.data.data.length);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else setError('名刺の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [router, userFilter, sortField, sortOrder]);

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
    <div className="flex flex-col h-screen py-8 px-6 max-w-7xl mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">名刺管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {userFilter !== 'all' && grandTotal !== null ? `${grandTotal}件中 ${cards.length}件` : `全 ${cards.length}件`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UserFilter value={userFilter} onChange={setUserFilter}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Button onClick={() => router.push('/business-cards/create')} className="gap-1">
            <span className="text-base">↑</span> アップロード
          </Button>
        </div>
      </div>

      {/* ── テーブル（ボディのみスクロール） ── */}
      <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <CardContent className="p-0 flex flex-col h-full overflow-hidden">

          {/* テーブルヘッダー（固定） */}
          <div className="flex-shrink-0 border-b bg-gray-50">
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <thead>
                <tr>
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">画像</th>
                  <SortableHeader label="会社名" field="company_name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="氏名" field="person_name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="役職" field="position" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">連絡先</th>
                  <SortableHeader label="ステータス" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="登録日" field="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <th className="font-semibold text-gray-600 py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* テーブルボディ（スクロール） */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <tbody>
                {cards.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <span className="text-5xl">🪪</span>
                        <p className="font-medium text-gray-500">名刺が登録されていません</p>
                        <Button size="sm" variant="outline" onClick={() => router.push('/business-cards/create')}>
                          名刺をアップロードする
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : cards.map((card, index) => {
                  const statusStyle = STATUS_STYLE[card.status] ?? { label: card.status, bg: '#F1F5F9', color: '#475569' };
                  return (
                    <tr
                      key={card.id}
                      className={`
                        hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0
                        ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                      `}
                      onClick={() => router.push(`/business-cards/${card.id}`)}
                    >
                      <td className="py-3 px-4">
                        {card.image_path ? (
                          <img
                            src={
                              card.image_path.startsWith('http')
                                ? card.image_path  // Supabase URL
                                : `${process.env.NEXT_PUBLIC_API_URL}/storage/${card.image_path}` // 旧ローカルパス
                            }
                            alt={`${card.person_name ?? ''}の名刺`}
                            className="h-14 w-20 object-cover rounded-md shadow-sm border border-gray-100"
                          />
                        ) : (
                          <div className="h-14 w-20 bg-gray-100 rounded-md flex items-center justify-center border border-gray-200">
                            <span className="text-xs text-gray-400">画像なし</span>
                          </div>
                        )}
                      </td>
                      <td className="text-gray-700 px-4 truncate">
                        {card.company_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="font-semibold text-gray-800 px-4 truncate">
                        {card.person_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-gray-600 text-sm px-4 truncate">
                        {card.position ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4">
                        {card.email && <div className="text-sm text-gray-600 truncate">{card.email}</div>}
                        {(card.mobile ?? card.phone) && (
                          <div className="text-sm text-gray-400">{card.mobile ?? card.phone}</div>
                        )}
                        {!card.email && !card.mobile && !card.phone && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="text-sm text-gray-400 px-4">
                        {new Date(card.created_at).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button
                            title="詳細"
                            onClick={() => router.push(`/business-cards/${card.id}`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                          >👁</button>
                          <button
                            title="編集"
                            onClick={() => router.push(`/business-cards/${card.id}/edit`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                          >✏️</button>
                          <button
                            title="削除"
                            onClick={async () => {
                              if (!confirm(`${card.person_name ?? card.company_name ?? 'この名刺'} を削除しますか？`)) return;
                              try {
                                await apiClient.delete(`/api/v1/cards/${card.id}`);
                                fetchCards();
                              } catch {
                                alert('削除に失敗しました');
                              }
                            }}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
