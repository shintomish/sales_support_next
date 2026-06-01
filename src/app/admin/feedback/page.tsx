'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import Toast from '@/components/Toast';

type FeedbackType   = 'bug' | 'request' | 'other';
type FeedbackStatus = 'new' | 'seen' | 'closed';

interface FeedbackItem {
  id: number;
  tenant_id: number;
  user_id: number | null;
  type: FeedbackType;
  subject: string;
  body: string;
  url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  user: { id: number; name: string; email: string; tenant_id: number } | null;
  tenant: { id: number; name: string } | null;
}

interface PaginatedFeedback {
  data: FeedbackItem[];
  current_page: number;
  last_page: number;
  total: number;
}

const TYPE_LABEL: Record<FeedbackType, { label: string; color: string }> = {
  bug:     { label: 'バグ',  color: 'bg-red-100 text-red-700'    },
  request: { label: '要望',  color: 'bg-blue-100 text-blue-700'  },
  other:   { label: 'その他', color: 'bg-gray-100 text-gray-700' },
};

const STATUS_LABEL: Record<FeedbackStatus, { label: string; color: string }> = {
  new:    { label: '未対応', color: 'bg-yellow-100 text-yellow-800' },
  seen:   { label: '確認済', color: 'bg-blue-100 text-blue-700'    },
  closed: { label: '完了',   color: 'bg-gray-100 text-gray-600'    },
};

export default function AdminFeedbackPage() {
  const router  = useRouter();
  const user    = useAuthStore((state) => state.user);

  const [items, setItems]       = useState<FeedbackItem[]>([]);
  const [total, setTotal]       = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  // フィルタ
  const [statusFilter, setStatusFilter] = useState<'' | FeedbackStatus>('');
  const [typeFilter,   setTypeFilter]   = useState<'' | FeedbackType>('');
  const [page, setPage] = useState(1);

  // 詳細展開
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter)   params.set('type',   typeFilter);
      params.set('page',     String(page));
      params.set('per_page', '50');
      const res = await apiClient.get<PaginatedFeedback>(`/api/v1/admin/feedback?${params.toString()}`);
      setItems(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
      setCurrentPage(res.data.current_page ?? 1);
      setLastPage(res.data.last_page ?? 1);
    } catch {
      setItems([]);
      setTotal(0);
      setLastPage(1);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, page]);

  // フィルタ変更時は 1 ページ目にリセット
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }
    fetchData();
  }, [user, router, fetchData]);

  const updateStatus = async (item: FeedbackItem, status: FeedbackStatus) => {
    setBusy(true);
    try {
      const res = await apiClient.patch<FeedbackItem>(`/api/v1/admin/feedback/${item.id}`, { status });
      setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, status: res.data.status } : x));
      setToast('ステータスを更新しました');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '更新に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Toast message={toast} onClose={() => setToast(null)} />

      <div className="flex-shrink-0 px-6 pt-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">ご意見一覧（バグ・要望）</h1>
        <p className="text-xs text-gray-400 mb-4">
          全テナント横断で表示しています（super_admin 限定）。新着が上に来ます。
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* フィルタ（スクロール時固定） */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex gap-3 items-center text-sm sticky top-0 z-20">
          <div>
            <label className="block text-xs text-gray-500 mb-1">ステータス</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | FeedbackStatus)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              <option value="">すべて</option>
              <option value="new">未対応</option>
              <option value="seen">確認済</option>
              <option value="closed">完了</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">種別</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as '' | FeedbackType)}
              className="border border-gray-200 rounded px-2 py-1 text-sm"
            >
              <option value="">すべて</option>
              <option value="bug">バグ</option>
              <option value="request">要望</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div className="ml-auto text-xs text-gray-500">全 {total} 件</div>
        </div>

        {/* 一覧（明細部スクロール・thead 固定） */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold w-[140px]">日時</th>
                  <th className="text-left px-3 py-2 font-semibold w-[80px]">種別</th>
                  <th className="text-left px-3 py-2 font-semibold">件名</th>
                  <th className="text-left px-3 py-2 font-semibold w-[180px]">テナント / 報告者</th>
                  <th className="text-center px-3 py-2 font-semibold w-[90px]">状態</th>
                  <th className="text-center px-3 py-2 font-semibold w-[200px]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">該当するフィードバックはありません</td></tr>
                ) : items.map((it) => {
                  const isExpanded = expandedId === it.id;
                  const tBadge     = TYPE_LABEL[it.type];
                  const sBadge     = STATUS_LABEL[it.status];
                  return (
                    <FeedbackRow
                      key={it.id}
                      item={it}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : it.id)}
                      onUpdate={(s) => updateStatus(it, s)}
                      busy={busy}
                      tBadge={tBadge}
                      sBadge={sBadge}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ページネーション */}
        {lastPage > 1 && (
          <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white border-t border-gray-200 z-20 flex flex-wrap items-center justify-center gap-1 md:gap-2 mt-4">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="px-3 py-1 rounded text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
            >‹ 前</button>
            {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded text-sm ${
                  p === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={currentPage >= lastPage}
              onClick={() => setPage(currentPage + 1)}
              className="px-3 py-1 rounded text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
            >次 ›</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackRow({
  item, isExpanded, onToggle, onUpdate, busy, tBadge, sBadge,
}: {
  item: FeedbackItem;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (s: FeedbackStatus) => void;
  busy: boolean;
  tBadge: { label: string; color: string };
  sBadge: { label: string; color: string };
}) {
  const formatDt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ja-JP', { hour12: false });
    } catch {
      return iso;
    }
  };
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 text-xs text-gray-600">{formatDt(item.created_at)}</td>
        <td className="px-3 py-2">
          <span className={`px-2 py-1 rounded text-xs ${tBadge.color}`}>{tBadge.label}</span>
        </td>
        <td className="px-3 py-2 text-gray-800">{item.subject}</td>
        <td className="px-3 py-2 text-xs text-gray-600">
          <div>{item.tenant?.name ?? `tenant_id=${item.tenant_id}`}</div>
          <div className="text-gray-400">{item.user?.name ?? '(unknown)'} ({item.user?.email ?? '-'})</div>
        </td>
        <td className="px-3 py-2 text-center">
          <span className={`px-2 py-1 rounded text-xs ${sBadge.color}`}>{sBadge.label}</span>
        </td>
        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
          <select
            value={item.status}
            onChange={(e) => onUpdate(e.target.value as FeedbackStatus)}
            disabled={busy}
            className="text-xs border border-gray-200 rounded px-2 py-1"
          >
            <option value="new">未対応</option>
            <option value="seen">確認済</option>
            <option value="closed">完了</option>
          </select>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-500">画面URL: </span>
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{item.url}</a> : '-'}
              </div>
              <div>
                <span className="text-gray-500">UA: </span>
                <span className="text-gray-600">{item.user_agent ?? '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">ID: </span>{item.id}
              </div>
            </div>
            <div className="mt-3 bg-white border border-gray-200 rounded p-3 whitespace-pre-wrap text-sm">
              {item.body}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
