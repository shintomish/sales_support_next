'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Task {
  id: number;
  title: string;
  priority: '高' | '中' | '低';
  status: string;
  due_date: string | null;
  description: string | null;
  customer: { id: number; company_name: string } | null;
  user: { id: number; name: string } | null;
}

interface Meta { current_page: number; last_page: number; total: number; }

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

const PRIORITIES = ['高', '中', '低'];
const STATUSES   = ['未着手', '進行中', '完了'];

const isOverdue = (due: string | null, status: string) =>
  !!due && new Date(due) < new Date() && status !== '完了';
const isToday = (due: string | null) => {
  if (!due) return false;
  const d = new Date(due), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export default function TasksPage() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [meta, setMeta]             = useState<Meta | null>(null);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const router = useRouter();

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/tasks', {
        params: { search, status: statusFilter, priority: priorityFilter, page },
      });
      setTasks(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('タスクの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, page, router]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => { setSearchInput(''); setSearch(''); setStatusFilter(''); setPriorityFilter(''); setPage(1); };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    try {
      await apiClient.delete(`/api/v1/tasks/${id}`);
      fetchTasks();
    } catch { alert('削除に失敗しました'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error}</p>
      <Button onClick={fetchTasks}>再試行</Button>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">タスク一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-1">全 {meta.total} 件</p>}
        </div>
        <Button onClick={() => router.push('/tasks/create')}>+ 新規登録</Button>
      </div>

      {/* 検索 */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8" placeholder="タイトル・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-2 text-sm min-w-32">
              <option value="">全ステータス</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
              className="border rounded-md px-3 py-2 text-sm min-w-28">
              <option value="">全優先度</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <Button onClick={handleSearch}>検索</Button>
            {(search || statusFilter || priorityFilter) && (
              <Button variant="outline" onClick={handleClear}>✕ クリア</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* テーブル */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>優先度</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead>期限日</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-12">
                    <p className="text-3xl mb-2">☑️</p>
                    タスクが登録されていません
                    <div className="mt-3">
                      <Button size="sm" onClick={() => router.push('/tasks/create')}>
                        最初のタスクを登録する
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map(t => {
                  const pStyle = PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE['低'];
                  const sStyle = STATUS_STYLE[t.status]     ?? STATUS_STYLE['未着手'];
                  const overdue = isOverdue(t.due_date, t.status);
                  const today   = isToday(t.due_date);
                  return (
                    <TableRow key={t.id}
                      className={`hover:bg-muted/50 cursor-pointer ${t.status === '完了' ? 'opacity-60' : ''}`}
                      onClick={() => router.push(`/tasks/${t.id}`)}>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: pStyle.bg, color: pStyle.color }}>
                          {t.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className={`font-semibold text-blue-600 ${t.status === '完了' ? 'line-through' : ''}`}>
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {t.description.slice(0, 40)}{t.description.length > 40 ? '…' : ''}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: sStyle.bg, color: sStyle.color }}>
                          {t.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {t.customer?.company_name ?? '-'}
                      </TableCell>
                      <TableCell>
                        {t.due_date ? (
                          <span className={`text-sm font-${overdue || today ? 'semibold' : 'normal'}`}
                                style={{ color: overdue ? '#EF4444' : today ? '#FF8C00' : '#6B7280' }}>
                            {new Date(t.due_date).toLocaleDateString('ja-JP')}
                            {today && (
                              <span className="ml-1 text-xs px-1 py-0.5 rounded"
                                    style={{ backgroundColor: '#FFF3E0', color: '#E67E00' }}>今日</span>
                            )}
                            {overdue && !today && (
                              <span className="ml-1 text-xs px-1 py-0.5 rounded"
                                    style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>期限超過</span>
                            )}
                          </span>
                        ) : <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {t.user?.name ?? '-'}
                      </TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="outline"
                            onClick={() => router.push(`/tasks/${t.id}`)}>詳細</Button>
                          <Button size="sm" variant="outline"
                            onClick={() => router.push(`/tasks/${t.id}/edit`)}>編集</Button>
                          <Button size="sm" variant="outline"
                            className="text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => handleDelete(t.id)}>削除</Button>
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

      {/* ページネーション */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="flex items-center text-sm text-gray-500">{page} / {meta.last_page}</span>
          <Button variant="outline" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}
    </div>
  );
}
