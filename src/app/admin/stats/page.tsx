'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

interface Stat {
  total: number;
  added: number;
  storage?: { bucket_total_bytes: number; cards_bytes: number };
}

interface StatsResponse {
  scope: 'self' | 'tenant' | 'all';
  tenant_id: number | null;
  period_days: number;
  generated_at: string;
  stats: Record<string, Stat>;
}

const PERIODS: { value: number; label: string }[] = [
  { value: 7,   label: '7日' },
  { value: 30,  label: '30日' },
  { value: 90,  label: '90日' },
  { value: 365, label: '365日' },
];

interface Tenant {
  id: number;
  name: string;
  slug: string;
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

interface CardDef {
  key: string;
  label: string;
  icon: string;
  color: string;             // tailwind text color class
  bg: string;
  combineKeys?: string[];    // 複数テーブルの内訳を表示（メイン以外）
}

const CARDS: CardDef[] = [
  { key: 'customers',        label: '顧客管理',     icon: '👥', color: 'text-blue-600',    bg: 'bg-blue-50' },
  { key: 'contacts',         label: '担当者管理',   icon: '👤', color: 'text-cyan-600',    bg: 'bg-cyan-50' },
  { key: 'deals',            label: '商談管理',     icon: '💼', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'ses_contracts',    label: 'SES台帳',      icon: '📋', color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  { key: 'engineers',        label: '技術者管理',   icon: '🧑‍💻', color: 'text-purple-600',  bg: 'bg-purple-50',
    combineKeys: ['engineer_skills', 'engineer_profiles'] },
  { key: 'public_projects',  label: '案件マーケット', icon: '🔍', color: 'text-orange-600',  bg: 'bg-orange-50' },
  { key: 'project_mail_sources',  label: '案件メール',   icon: '📨', color: 'text-pink-600',    bg: 'bg-pink-50' },
  { key: 'engineer_mail_sources', label: '技術者メール', icon: '✉️', color: 'text-rose-600',    bg: 'bg-rose-50' },
  { key: 'delivery_campaigns',    label: '配信管理',     icon: '📤', color: 'text-amber-600',   bg: 'bg-amber-50',
    combineKeys: ['delivery_send_histories'] },
  { key: 'activities',       label: '活動履歴',     icon: '🕐', color: 'text-teal-600',    bg: 'bg-teal-50' },
  { key: 'tasks',            label: 'タスク管理',   icon: '☑',  color: 'text-lime-600',    bg: 'bg-lime-50' },
  { key: 'emails',           label: 'メール',       icon: '📧', color: 'text-sky-600',     bg: 'bg-sky-50' },
  { key: 'business_cards',   label: '名刺管理',     icon: '🪪', color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
];

const SUB_LABELS: Record<string, string> = {
  engineer_skills:        'スキル',
  engineer_profiles:      'プロフィール',
  delivery_send_histories: '送信履歴',
};

export default function AdminStatsPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const loadingMe = useAuthStore((s) => s.loading);

  // ロールガード
  useEffect(() => {
    if (loadingMe) return;
    if (!me) return;
    if (me.role !== 'super_admin' && me.role !== 'tenant_admin') router.replace('/dashboard');
  }, [me, loadingMe, router]);

  const [data,    setData]    = useState<StatsResponse | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantSel, setTenantSel] = useState<string>(''); // '' = self, 'all' = 全テナント, '<id>' = 指定
  const [period,  setPeriod]  = useState<number>(30);
  const [loading, setLoading] = useState(true);

  const isSuper = me?.role === 'super_admin';

  const fetchStats = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { period: String(period) };
      if (isSuper && tenantSel) params.tenant_id = tenantSel;
      if (refresh) params.refresh = '1';
      const res = await apiClient.get('/api/v1/admin/stats', { params });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantSel, period, isSuper]);

  useEffect(() => {
    if (!me) return;
    fetchStats();
    if (isSuper) apiClient.get('/api/v1/tenants').then((r) => setTenants(r.data)).catch(() => {});
  }, [me, fetchStats, isSuper]);

  if (loadingMe || !me || (me.role !== 'super_admin' && me.role !== 'tenant_admin')) return null;

  const scopeLabel = data?.scope === 'all'
    ? '全テナント合計'
    : (() => {
        const id = data?.tenant_id;
        const t = tenants.find((x) => x.id === id);
        return t ? t.name : '自テナント';
      })();

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      {/* 上部 */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">データ統計</h1>
            <p className="text-sm text-gray-500 mt-1">
              機能ごとのデータ件数と直近30日の増分（{scopeLabel}）
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuper && (
              <select
                className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
                value={tenantSel}
                onChange={(e) => setTenantSel(e.target.value)}
              >
                <option value="">自テナント</option>
                <option value="all">全テナント合計</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <Button variant="outline" onClick={() => fetchStats(true)} disabled={loading}>
              {loading ? '読み込み中...' : '↻ 更新'}
            </Button>
          </div>
        </div>

        {/* 期間切替 */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <span className="text-sm text-gray-600 font-semibold">期間:</span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm transition-colors border-r border-gray-200 last:border-r-0 ${
                  period === p.value
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {data?.generated_at && (
          <p className="text-xs text-gray-400 mb-3">
            キャッシュ: {new Date(data.generated_at).toLocaleString('ja-JP')} 時点（15分間）
          </p>
        )}
      </div>

      {/* カードグリッド */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CARDS.map((c) => {
            const s = data?.stats?.[c.key];
            const total = s?.total ?? 0;
            const added = s?.added ?? 0;
            const periodLabel = `${data?.period_days ?? period}日`;
            return (
              <div key={c.key} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className={`flex items-center gap-2 ${c.color}`}>
                    <span className="text-2xl">{c.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{c.label}</span>
                  </div>
                  {added > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                      +{added.toLocaleString()} (直近{periodLabel})
                    </span>
                  )}
                </div>
                <div className={`text-3xl font-bold ${c.color}`}>
                  {loading ? '...' : total.toLocaleString()}
                </div>

                {/* 内訳 */}
                {c.combineKeys && c.combineKeys.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {c.combineKeys.map((sk) => {
                      const ss = data?.stats?.[sk];
                      if (!ss) return null;
                      return (
                        <div key={sk} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{SUB_LABELS[sk] ?? sk}</span>
                          <span className="text-gray-700 font-semibold">
                            {ss.total.toLocaleString()}{ss.added > 0 && <span className="text-green-600 ml-1">(+{ss.added})</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* business_cards のストレージ */}
                {c.key === 'business_cards' && s?.storage && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">名刺画像</span>
                      <span className="text-gray-700 font-semibold">{formatBytes(s.storage.cards_bytes)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">バケット全体</span>
                      <span className="text-gray-700 font-semibold">{formatBytes(s.storage.bucket_total_bytes)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
