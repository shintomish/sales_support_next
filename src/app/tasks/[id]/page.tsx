'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

interface Task {
  id: number; title: string; priority: string; status: string;
  due_date: string | null; description: string | null; created_at: string;
  customer: { id: number; company_name: string } | null;
  deal: { id: number; title: string } | null;
  user: { id: number; name: string } | null;
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  高: { bg: '#FEF2F2', color: '#991B1B' },
  中: { bg: '#FFF3E0', color: '#E67E00' },
  低: { bg: '#F1F5F9', color: '#475569' },
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  完了:   { bg: '#ECFDF5', color: '#065F46' },
  進行中: { bg: '#EFF6FF', color: '#1D4ED8' },
  未着手: { bg: '#F1F5F9', color: '#475569' },
};

const isOverdue = (due: string | null, status: string) =>
  !!due && new Date(due) < new Date() && status !== '完了';

const Em = () => <span className="text-gray-300">—</span>;

export default function TaskDetailPage() {
  const [task, setTask]       = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchTask = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get(`/api/v1/tasks/${id}`);
      setTask(res.data.data ?? res.data);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else if ((err as ApiError).response?.status === 404) router.push('/tasks');
      else setError('タスク情報の取得に失敗しました');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  const handleUpdateStatus = async (status: string) => {
    try {
      await apiClient.patch(`/api/v1/tasks/${id}/status`, { status });
      fetchTask();
    } catch { alert('ステータスの更新に失敗しました'); }
  };

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
        <Button variant="outline" onClick={() => router.push('/tasks')}>一覧に戻る</Button>
        <Button onClick={fetchTask}>再試行</Button>
      </div>
    </div>
  );
  if (!task) return null;

  const pStyle  = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE['低'];
  const sStyle  = STATUS_STYLE[task.status]     ?? STATUS_STYLE['未着手'];
  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: pStyle.bg, color: pStyle.color }}>
              優先度：{task.priority}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: sStyle.bg, color: sStyle.color }}>
              {task.status}
            </span>
            {overdue && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>期限超過</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/tasks/${id}/edit`)}>✏️ 編集</Button>
          <Button variant="outline" onClick={() => router.push('/tasks')}>← 一覧に戻る</Button>
        </div>
      </div>

      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base text-gray-700">ℹ️ 基本情報</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">優先度</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: pStyle.bg, color: pStyle.color }}>{task.priority}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">ステータス</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: sStyle.bg, color: sStyle.color }}>{task.status}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">期限日</p>
              <p className="text-sm font-medium" style={{ color: overdue ? '#EF4444' : '#1F2937' }}>
                {task.due_date
                  ? new Date(task.due_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                  : <Em />}
                {overdue && (
                  <span className="ml-1 text-xs px-1 py-0.5 rounded"
                        style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>期限超過</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">顧客</p>
              {task.customer
                ? <button className="text-sm text-blue-500 hover:underline font-medium"
                    onClick={() => router.push(`/customers/${task.customer!.id}`)}>{task.customer.company_name}</button>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">関連商談</p>
              {task.deal
                ? <button className="text-sm text-blue-500 hover:underline font-medium"
                    onClick={() => router.push(`/deals/${task.deal!.id}`)}>{task.deal.title}</button>
                : <Em />}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">担当者</p>
              <p className="text-sm font-medium text-gray-800">{task.user?.name ?? <Em />}</p>
            </div>
          </div>

          {task.description && (
            <div className="mt-6">
              <p className="text-xs text-gray-400 mb-2">詳細</p>
              <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                {task.description}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {task.status !== '完了' && (
        <Card className="shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">ステータスを変更：</span>
              {task.status === '未着手' && (
                <button onClick={() => handleUpdateStatus('進行中')}
                  className="px-3 py-1.5 rounded-md text-sm border font-medium transition-all hover:opacity-80"
                  style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
                  ▶ 進行中にする
                </button>
              )}
              <button onClick={() => handleUpdateStatus('完了')}
                className="px-3 py-1.5 rounded-md text-sm border font-medium transition-all hover:opacity-80"
                style={{ backgroundColor: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}>
                ✓ 完了にする
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
