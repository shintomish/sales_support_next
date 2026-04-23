'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ───────── 型定義 ─────────
interface Kpi {
  customers: number; deals_active: number;
  won_this_month: number; revenue_this_month: number; deals: number;
}
interface PipelineItem   { status: string; count: number; total: number; }
interface MonthlyRevenue { month: string; revenue: number; }
interface Task     { id: number; title: string; priority: '高'|'中'|'低'; due_date: string|null; customer: {company_name:string}|null; }
interface Activity { id: number; subject: string; type: string; activity_date: string; customer: {company_name:string}|null; }
interface WonDeal  { id: number; title: string; amount: number; customer: {company_name:string}|null; }

interface DashboardData {
  kpi: Kpi; pipeline: PipelineItem[]; monthly_revenue: MonthlyRevenue[];
  upcoming_tasks: Task[]; recent_activities: Activity[]; won_deals: WonDeal[];
}

// ───────── 定数 ─────────
const PIPELINE_COLORS: Record<string, string> = {
  新規: '#94A3B8', 提案: '#3B82F6', 交渉: '#FF8C00', 成約: '#10B981', 稼働中: '#8B5CF6', 失注: '#EF4444',
};
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
const QUICK_ACTIONS = [
  { label: '顧客登録',   href: '/customers/create',  icon: '🏢', bg: '#EFF6FF', color: '#2563EB' },
  { label: '担当者登録', href: '/contacts/create',   icon: '👤', bg: '#F5F3FF', color: '#7C3AED' },
  { label: '商談登録',   href: '/deals/create',      icon: '💼', bg: '#FFF3E0', color: '#FF8C00' },
  { label: '活動記録',   href: '/activities/create', icon: '🕐', bg: '#ECFDF5', color: '#10B981' },
  { label: 'タスク追加', href: '/tasks/create',      icon: '✅', bg: '#FDF4FF', color: '#A21CAF' },
];

// ───────── ユーティリティ ─────────
const formatManEn = (yen: number) => Math.floor(yen / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 });
const formatDate  = (s: string) => new Date(s).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
const isPast  = (s: string|null) => !!s && new Date(s) < new Date();
const isToday = (s: string|null) => {
  if (!s) return false;
  const d = new Date(s), n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
};

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-pink-600 font-bold">¥{Number(payload[0].value).toLocaleString()}</p>
    </div>
  );
};

// ───────── メインコンポーネント ─────────
export default function DashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/api/v1/dashboard');
      setData(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('データの取得に失敗しました');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">⚠️</div>
      <p className="text-gray-600 font-medium">{error ?? 'データがありません'}</p>
      <Button onClick={fetchDashboard}>再試行</Button>
    </div>
  );

  const { kpi, pipeline, monthly_revenue, upcoming_tasks, recent_activities, won_deals } = data;
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const pieData = pipeline
    .filter(p => p.count > 0)
    .map(p => ({ name: p.status, value: p.count, color: PIPELINE_COLORS[p.status] ?? '#94A3B8' }));

  return (
    <div className="max-w-7xl mx-auto py-6 px-6">

      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <span className="text-sm text-gray-400">📅 {today}</span>
      </div>

      {/* ── KPIカード ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '総顧客数',     value: kpi.customers.toLocaleString(),      unit: '社',  bg: '#EFF6FF', color: '#2563EB', icon: '🏢' },
          { label: '進行中の商談', value: kpi.deals_active.toLocaleString(),   unit: '件',  bg: '#FFF3E0', color: '#FF8C00', icon: '💼' },
          { label: '今月の成約',   value: kpi.won_this_month.toLocaleString(), unit: '件',  bg: '#ECFDF5', color: '#10B981', icon: '🏆' },
          { label: '今月の売上',   value: formatManEn(kpi.revenue_this_month), unit: '万円', bg: '#FDF2F8', color: '#DB2777', icon: '¥'  },
        ].map(({ label, value, unit, bg, color, icon }) => (
          <Card key={label} className="shadow-sm">
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

      {/* ── クイックアクション ── */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-700">⚡ クイックアクション</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-3 flex-wrap">
            {QUICK_ACTIONS.map(({ label, href, icon, bg, color }) => (
              <button key={href} onClick={() => router.push(href)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-100 text-sm font-medium transition-all hover:shadow-md active:scale-95"
                style={{ backgroundColor: bg, color }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 月別売上 & 商談円グラフ ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* 月別売上棒グラフ */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-700">📈 月別売上（過去6ヶ月）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly_revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v === 0 ? '0' : `${Math.floor(v/10000)}万`} />
                <Tooltip content={<RevenueTooltip />} />
                <Bar dataKey="revenue" fill="#DB2777" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 商談パイプライン円グラフ */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-700">🥧 商談パイプライン</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">データなし</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="42%" outerRadius={72} dataKey="value"
                    label={({ name, value }) => `${name}:${value}`} labelLine={true} fontSize={11}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend iconSize={10}
                    formatter={(v) => <span style={{ fontSize: 11, color: '#64748B' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 期限タスク & 活動履歴 & 今月成約 ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {/* 期限が近いタスク */}
        <Card className="md:col-span-2 shadow-sm flex flex-col" style={{ maxHeight: 280 }}>
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base text-gray-700">☑️ 期限が近いタスク</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {upcoming_tasks.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">
                <p className="text-2xl mb-1">✅</p>期限が近いタスクはありません
              </div>
            ) : upcoming_tasks.map((task, i) => {
              const pStyle = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE['低'];
              const past   = isPast(task.due_date);
              const today_ = isToday(task.due_date);
              return (
                <div key={task.id} className={`px-4 py-3 ${i < upcoming_tasks.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold"
                          style={{ backgroundColor: pStyle.bg, color: pStyle.color }}>{task.priority}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    {task.customer && <span>🏢 {task.customer.company_name}</span>}
                    {task.due_date && (
                      <span className={past && !today_ ? 'text-red-500 font-semibold' : ''}>
                        📅 {formatDate(task.due_date)}
                        {today_ && <span className="ml-1 bg-red-500 text-white rounded px-1">今日</span>}
                        {past && !today_ && <span className="ml-1 bg-red-100 text-red-600 rounded px-1">超過</span>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 直近の活動履歴 */}
        <Card className="md:col-span-2 shadow-sm flex flex-col" style={{ maxHeight: 280 }}>
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base text-gray-700">🕐 直近の活動履歴</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {recent_activities.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">活動履歴がありません</div>
            ) : recent_activities.map((act, i) => {
              const style = ACTIVITY_ICONS[act.type] ?? ACTIVITY_ICONS['その他'];
              return (
                <div key={act.id}
                     className={`flex items-center gap-3 px-4 py-3 ${i < recent_activities.length - 1 ? 'border-b' : ''}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                       style={{ backgroundColor: style.bg, color: style.color }}>{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{act.subject}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      {act.customer && <span>🏢 {act.customer.company_name}</span>}
                      <span>📅 {formatDate(act.activity_date)}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                        style={{ backgroundColor: style.bg, color: style.color }}>{act.type}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 今月の成約 */}
        <Card className="md:col-span-1 shadow-sm flex flex-col" style={{ maxHeight: 280 }}>
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base text-gray-700">🏆 今月の成約</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            {won_deals.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">
                <p className="text-2xl mb-1 opacity-30">🏆</p>今月の成約はありません
              </div>
            ) : won_deals.map((deal, i) => (
              <div key={deal.id} className={`px-4 py-3 ${i < won_deals.length - 1 ? 'border-b' : ''}`}>
                <p className="text-sm font-medium text-gray-800 leading-snug">{deal.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-400 truncate">{deal.customer?.company_name ?? '-'}</span>
                  <span className="text-sm font-bold text-emerald-500 whitespace-nowrap ml-2">
                    ¥{Number(deal.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
