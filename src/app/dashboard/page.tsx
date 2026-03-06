'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ───────── 型定義 ─────────
interface Kpi {
  customers: number;
  deals_active: number;
  won_this_month: number;
  revenue_this_month: number;
  deals: number;
}

interface PipelineItem {
  status: string;
  count: number;
  total: number; // 金額（円）
}

interface Task {
  id: number;
  title: string;
  priority: '高' | '中' | '低';
  due_date: string | null;
  customer: { company_name: string } | null;
}

interface Activity {
  id: number;
  subject: string;
  type: '訪問' | '電話' | 'メール' | 'その他';
  activity_date: string;
  customer: { company_name: string } | null;
}

interface WonDeal {
  id: number;
  title: string;
  amount: number;
  customer: { company_name: string } | null;
}

interface DashboardData {
  kpi: Kpi;
  pipeline: PipelineItem[];
  upcoming_tasks: Task[];
  recent_activities: Activity[];
  won_deals: WonDeal[];
}

// ───────── 定数 ─────────
const PIPELINE_STATUSES = [
  { status: '新規', bar: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  { status: '提案', bar: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' },
  { status: '交渉', bar: '#FF8C00', bg: '#FFF3E0', text: '#E67E00' },
  { status: '成約', bar: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  { status: '失注', bar: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
];

const ACTIVITY_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  訪問:  { icon: '🚶', bg: '#EFF6FF', color: '#2563EB' },
  電話:  { icon: '📞', bg: '#ECFDF5', color: '#10B981' },
  メール:{ icon: '✉️', bg: '#FFF3E0', color: '#FF8C00' },
  その他:{ icon: '•••', bg: '#F1F5F9', color: '#64748B' },
};

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  高: { bg: '#FEF2F2', color: '#991B1B' },
  中: { bg: '#FFF3E0', color: '#E67E00' },
  低: { bg: '#F1F5F9', color: '#475569' },
};

// ───────── ユーティリティ ─────────
const formatManEn = (yen: number) => Math.floor(yen / 10000).toLocaleString();
const formatDate  = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }).replace('/', '/');
const isPast = (dateStr: string | null) => !!dateStr && new Date(dateStr) < new Date();
const isToday = (dateStr: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

// ───────── コンポーネント ─────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/dashboard');
      setData(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/login');
      } else {
        setError('データの取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error ?? 'データがありません'}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
        >
          再試行
        </button>
      </div>
    );
  }

  const { kpi, pipeline, upcoming_tasks, recent_activities, won_deals } = data;
  const totalDeals = kpi.deals || 1;
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="container mx-auto py-4 px-4 max-w-7xl">

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <span className="text-sm text-gray-500">📅 {today}</span>
      </div>

      {/* ── KPIカード ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: '総顧客数',     value: kpi.customers.toLocaleString(),                      unit: '社',  bg: '#EFF6FF', color: '#2563EB', icon: '🏢' },
          { label: '進行中の商談', value: kpi.deals_active.toLocaleString(),                   unit: '件',  bg: '#FFF3E0', color: '#FF8C00', icon: '💼' },
          { label: '今月の成約',   value: kpi.won_this_month.toLocaleString(),                 unit: '件',  bg: '#ECFDF5', color: '#10B981', icon: '🏆' },
          { label: '今月の売上',   value: formatManEn(kpi.revenue_this_month),                 unit: '万円', bg: '#FDF2F8', color: '#DB2777', icon: '¥'  },
        ].map(({ label, value, unit, bg, color, icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                  <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{unit}</p>
                </div>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                     style={{ backgroundColor: bg, color }}>
                  {icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── 商談パイプライン & 期限タスク ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-start">
        {/* max-h-60（240px）で統一 */}
        {/* 商談パイプライン（2/3幅） */}
        <Card className="md:col-span-2 flex flex-col max-h-60">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span>📊</span> 商談パイプライン
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto flex-1">
            {PIPELINE_STATUSES.map(({ status, bar, bg, text }) => {
              const item   = pipeline.find(p => p.status === status);
              const count  = item?.count ?? 0;
              const total  = item?.total ?? 0;
              const pct    = Math.round((count / totalDeals) * 100);
              const showAmt = status !== '失注' && status !== '成約';
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: bg, color: text }}>
                      {status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {count}件{showAmt && ` / ${formatManEn(total)}万円`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                         style={{ width: `${pct}%`, backgroundColor: bar }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 期限が近いタスク（1/3幅） */}
        <Card className="flex flex-col max-h-60">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span>☑️</span> 期限が近いタスク
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {upcoming_tasks.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">
                <p className="text-2xl mb-1">✅</p>
                期限が近いタスクはありません
              </div>
            ) : (
              upcoming_tasks.map((task, i) => {
                const pStyle = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE['低'];
                const past   = isPast(task.due_date);
                const today_ = isToday(task.due_date);
                return (
                  <div key={task.id}
                       className={`px-4 py-3 ${i < upcoming_tasks.length - 1 ? 'border-b' : ''}`}>
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold"
                            style={{ backgroundColor: pStyle.bg, color: pStyle.color }}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      {task.customer && <span>🏢 {task.customer.company_name}</span>}
                      {task.due_date && (
                        <span className={past && !today_ ? 'text-red-500' : ''}>
                          📅 {formatDate(task.due_date)}
                          {today_ && (
                            <span className="ml-1 bg-red-500 text-white rounded px-1" style={{ fontSize: 10 }}>今日</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 直近の活動履歴 & 今月の成約 ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* 活動履歴（3/5幅） */}
        <Card className="md:col-span-3 flex flex-col max-h-60">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span>🕐</span> 直近の活動履歴
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {recent_activities.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">活動履歴がありません</div>
            ) : (
              recent_activities.map((act, i) => {
                const style = ACTIVITY_ICONS[act.type] ?? ACTIVITY_ICONS['その他'];
                return (
                  <div key={act.id}
                       className={`flex items-center gap-3 px-4 py-3 ${i < recent_activities.length - 1 ? 'border-b' : ''}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                         style={{ backgroundColor: style.bg, color: style.color }}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{act.subject}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        {act.customer && <span>🏢 {act.customer.company_name}</span>}
                        <span>📅 {formatDate(act.activity_date)}</span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                          style={{ backgroundColor: style.bg, color: style.color }}>
                      {act.type}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 今月の成約（2/5幅） */}
        <Card className="md:col-span-2 flex flex-col max-h-60">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span>🏆</span> 今月の成約商談
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {won_deals.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">
                <p className="text-2xl mb-1 opacity-30">🏆</p>
                今月の成約はありません
              </div>
            ) : (
              won_deals.map((deal, i) => (
                <div key={deal.id}
                     className={`px-4 py-3 ${i < won_deals.length - 1 ? 'border-b' : ''}`}>
                  <p className="text-sm font-medium text-gray-800">{deal.title}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-400">
                      🏢 {deal.customer?.company_name ?? '-'}
                    </span>
                    <span className="text-sm font-bold text-emerald-500">
                      ¥{Number(deal.amount).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
