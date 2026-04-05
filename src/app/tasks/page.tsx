'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/authStore';
import UserFilter, { defaultUserFilter } from '@/components/UserFilter';
import SortableHeader from '@/components/SortableHeader';

interface Task {
  id: number; title: string; priority: string; status: string;
  due_date: string | null; description: string | null;
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
const DUE_FILTERS = [
  { value: 'today',   label: '今日' },
  { value: 'overdue', label: '期限超過' },
  { value: 'week',    label: '今週' },
];

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const isOverdue = (due: string | null, status: string) =>
  !!due && new Date(due) < new Date() && status !== '完了';
const isToday = (due: string | null) => {
  if (!due) return false;
  const d = new Date(due), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

// ヘッダー・ボディで幅を揃えるcolgroup定義
const ColGroup = () => (
  <colgroup>
    <col style={{ width: '9%' }} />
    <col style={{ width: '26%' }} />
    <col style={{ width: '11%' }} />
    <col style={{ width: '17%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '10%' }} />
  </colgroup>
);

function TasksPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [tasks, setTasks]     = useState<Task[]>([]);
  const [meta, setMeta]       = useState<Meta | null>(null);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [searchInput, setSearchInput]         = useState(searchParams.get('search') ?? '');
  const [search, setSearch]                   = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter]       = useState(searchParams.get('status') ?? '');
  const [priorityFilter, setPriorityFilter]   = useState(searchParams.get('priority') ?? '');
  const [dueFilter, setDueFilter]             = useState(searchParams.get('due_filter') ?? '');
  const { user } = useAuthStore();
  const [userFilter, setUserFilter] = useState<string>('all');
  useEffect(() => { setUserFilter(defaultUserFilter(user)); }, [user]);
  const [page, setPage]       = useState(Number(searchParams.get('page') ?? '1'));
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const updateUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v && v !== '1') p.set(k, v); });
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/tasks', {
        params: { search, status: statusFilter, priority: priorityFilter, due_filter: dueFilter, page, user_id: userFilter, sort_by: sortField || undefined, sort_order: sortField ? sortOrder : undefined },
      });
      setTasks(res.data.data);
      setMeta(res.data.meta);
      if (userFilter === 'all') setGrandTotal(res.data.meta.total);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('タスクの取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, statusFilter, priorityFilter, dueFilter, page, userFilter, sortField, sortOrder, router]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => {
    updateUrl({ search, status: statusFilter, priority: priorityFilter, due_filter: dueFilter, page: String(page) });
  }, [search, statusFilter, priorityFilter, dueFilter, page, updateUrl]);

  const handleSort = (field: string) => {
    if (sortField === field) { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  };

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleClear  = () => {
    setSearchInput(''); setSearch(''); setStatusFilter('');
    setPriorityFilter(''); setDueFilter(''); setPage(1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('削除してもよろしいですか？')) return;
    setDeletingId(id);
    try { await apiClient.delete(`/api/v1/tasks/${id}`); fetchTasks(); }
    catch { alert('削除に失敗しました'); }
    finally { setDeletingId(null); }
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
      <Button onClick={fetchTasks}>再試行</Button>
    </div>
  );

  const hasFilter = !!(search || statusFilter || priorityFilter || dueFilter);

  return (
    <div className="flex flex-col h-screen py-8 px-6 max-w-7xl mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">タスク一覧</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">
            {userFilter !== 'all' && grandTotal !== null ? `${grandTotal}件中 ${meta.total}件` : `全 ${meta.total}件`}
            {hasFilter && ' （絞り込み中）'}
          </p>}
        </div>
        <Button onClick={() => router.push('/tasks/create')} className="gap-1">
          <span className="text-base">＋</span> 新規登録
        </Button>
      </div>

      {/* ── 検索フィルタ ── */}
      <Card className="mb-4 shadow-sm flex-shrink-0">
        <CardContent className="py-3 px-4 space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="タイトル・会社名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">全ステータス</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">全優先度</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <UserFilter value={userFilter} onChange={v => { setUserFilter(v); setPage(1); }} className={selectCls} />
            <Button onClick={handleSearch}>検索</Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
            )}
          </div>
          {/* 期限クイックフィルター */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-500">期限:</span>
            {DUE_FILTERS.map(f => (
              <button key={f.value} type="button"
                onClick={() => { setDueFilter(prev => prev === f.value ? '' : f.value); setPage(1); }}
                className="text-xs px-3 py-1 rounded-full border transition-all"
                style={dueFilter === f.value
                  ? { backgroundColor: f.value === 'overdue' ? '#FEF2F2' : f.value === 'today' ? '#FFF3E0' : '#EFF6FF',
                      color: f.value === 'overdue' ? '#991B1B' : f.value === 'today' ? '#E67E00' : '#1D4ED8',
                      borderColor: f.value === 'overdue' ? '#EF4444' : f.value === 'today' ? '#FF8C00' : '#3B82F6',
                      fontWeight: 600 }
                  : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                {f.value === 'overdue' ? '🔴' : f.value === 'today' ? '🟡' : '📅'} {f.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── テーブル（ボディのみスクロール） ── */}
      <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <CardContent className="p-0 flex flex-col h-full overflow-hidden">

          {/* テーブルヘッダー（固定） */}
          <div className="flex-shrink-0 border-b bg-gray-50">
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <thead>
                <tr>
                  <SortableHeader label="優先度" field="priority" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="タイトル" field="title" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="ステータス" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <th className="font-semibold text-gray-600 py-3 px-4 text-left">顧客</th>
                  <SortableHeader label="期限日" field="due_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="担当者" field="assignee" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
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
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <span className="text-5xl">☑️</span>
                        <p className="font-medium text-gray-500">
                          {hasFilter ? '条件に一致するタスクが見つかりません' : 'タスクが登録されていません'}
                        </p>
                        {!hasFilter && (
                          <Button size="sm" variant="outline" onClick={() => router.push('/tasks/create')}>
                            最初のタスクを登録する
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : tasks.map((t, index) => {
                  const pStyle  = PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE['低'];
                  const sStyle  = STATUS_STYLE[t.status]     ?? STATUS_STYLE['未着手'];
                  const overdue = isOverdue(t.due_date, t.status);
                  const today   = isToday(t.due_date);
                  return (
                    <tr
                      key={t.id}
                      className={`
                        hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0
                        ${t.status === '完了' ? 'opacity-60' : ''}
                        ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                      `}
                      onClick={() => router.push(`/tasks/${t.id}`)}
                    >
                      <td className="py-3 px-4">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: pStyle.bg, color: pStyle.color }}
                        >{t.priority}</span>
                      </td>
                      <td className="px-4">
                        <p className={`font-semibold text-blue-600 truncate ${t.status === '完了' ? 'line-through' : ''}`}>
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {t.description.slice(0, 40)}{t.description.length > 40 ? '…' : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-4">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: sStyle.bg, color: sStyle.color }}
                        >{t.status}</span>
                      </td>
                      <td className="text-sm text-gray-500 px-4 truncate">
                        {t.customer?.company_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4">
                        {t.due_date ? (
                          <span
                            className="text-sm"
                            style={{
                              color: overdue ? '#EF4444' : today ? '#FF8C00' : '#9CA3AF',
                              fontWeight: overdue || today ? 600 : 400,
                            }}
                          >
                            {new Date(t.due_date).toLocaleDateString('ja-JP')}
                            {today && <span className="ml-1 text-xs px-1 rounded" style={{ backgroundColor: '#FFF3E0', color: '#E67E00' }}>今日</span>}
                            {overdue && !today && <span className="ml-1 text-xs px-1 rounded" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>超過</span>}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-sm text-gray-500 px-4 truncate">
                        {t.user?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <button
                            title="詳細"
                            onClick={() => router.push(`/tasks/${t.id}`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                          >👁</button>
                          <button
                            title="編集"
                            onClick={() => router.push(`/tasks/${t.id}/edit`)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                          >✏️</button>
                          <button
                            title="削除"
                            disabled={deletingId === t.id}
                            onClick={() => handleDelete(t.id)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
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

      {/* ── ページネーション ── */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center items-center gap-3 mt-5 flex-shrink-0">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="text-sm text-gray-500">{page} / {meta.last_page} ページ</span>
          <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}

    </div>
  );
}

export default function Page() {
  return <Suspense><TasksPage /></Suspense>;
}
