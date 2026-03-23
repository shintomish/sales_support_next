'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// ── 型定義 ────────────────────────────────────────────────────
interface SesContract {
  id: number;
  project_number: number | null;
  engineer_name: string | null;
  change_type: string | null;
  affiliation: string | null;
  affiliation_contact: string | null;
  email: string | null;
  phone: string | null;
  customer_name: string | null;
  end_client: string | null;
  project_name: string | null;
  nearest_station: string | null;
  status: string;
  invoice_number: string | null;
  // 金額
  income_amount: number | null;
  billing_plus_22: number | null;
  billing_plus_29: number | null;
  sales_support_payee: string | null;
  sales_support_fee: number | null;
  adjustment_amount: number | null;
  profit: number | null;
  profit_rate_29: number | null;
  // 精算条件
  client_deduction_unit_price: number | null;
  client_deduction_hours: number | null;
  client_overtime_unit_price: number | null;
  client_overtime_hours: number | null;
  settlement_unit_minutes: number | null;
  payment_site: number | null;
  vendor_deduction_unit_price: number | null;
  vendor_deduction_hours: number | null;
  vendor_overtime_unit_price: number | null;
  vendor_overtime_hours: number | null;
  vendor_payment_site: number | null;
  // 契約期間
  contract_start: string | null;
  contract_period_start: string | null;
  contract_period_end: string | null;
  affiliation_period_end: string | null;
  // 勤務表
  timesheet_received_date: string | null;
  transportation_fee: number | null;
  invoice_exists: boolean | null;
  invoice_received_date: string | null;
  notes: string | null;
  days_until_expiry: number | null;
}

interface Summary {
  total_income: number;
  total_profit: number;
  active_count: number;
  expiring_count: number;
}

interface Meta { current_page: number; last_page: number; total: number; }

// ── 定数 ──────────────────────────────────────────────────────
type ColumnGroup = 'basic' | 'amount' | 'settlement' | 'work';

const COLUMN_GROUPS: { key: ColumnGroup; label: string }[] = [
  { key: 'basic',      label: '📋 基本' },
  { key: 'amount',     label: '💰 金額' },
  { key: 'settlement', label: '⚖️ 精算条件' },
  { key: 'work',       label: '📅 勤務表・SES情報' },
];

const SES_STATUSES = ['稼働中', '更新交渉中', '期限切れ', '新規', '提案', '交渉', '成約', '失注'];

const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  稼働中:     { bg: '#ECFDF5', color: '#065F46' },
  更新交渉中: { bg: '#FFFBEB', color: '#92400E' },
  期限切れ:   { bg: '#F9FAFB', color: '#6B7280' },
  新規:       { bg: '#F1F5F9', color: '#475569' },
  提案:       { bg: '#EFF6FF', color: '#1D4ED8' },
  交渉:       { bg: '#FFF7ED', color: '#C2410C' },
  成約:       { bg: '#F0FDF4', color: '#166534' },
  失注:       { bg: '#FEF2F2', color: '#991B1B' },
};

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

// ── ユーティリティ ────────────────────────────────────────────
const fmt = (v: number | null) => v != null ? `¥${Number(v).toLocaleString()}` : '—';
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const Em = () => <span className="text-gray-300 text-xs">—</span>;

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <Em />;
  if (days < 0)  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">終了済</span>;
  if (days <= 7)  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold animate-pulse">⚠ {days}日</span>;
  if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">⚡ {days}日</span>;
  return <span className="text-xs text-gray-400">{days}日</span>;
}

// ── サマリーカード ─────────────────────────────────────────────
function SummaryCards({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  const cards = [
    { label: '稼働中', value: `${summary.active_count}件`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '期限30日以内', value: `${summary.expiring_count}件`, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '月次売上合計', value: fmt(summary.total_income), color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '月次利益合計', value: fmt(summary.total_profit), color: 'text-purple-600', bg: 'bg-purple-50' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 flex-shrink-0">
      {cards.map(c => (
        <div key={c.label} className={`${c.bg} rounded-xl px-4 py-3`}>
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────
function SesContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<SesContract[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [columnGroup, setColumnGroup] = useState<ColumnGroup>('basic');
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [res, sumRes] = await Promise.all([
        apiClient.get('/api/v1/ses-contracts', {
          params: { search, status: statusFilter, page, per_page: 50 },
        }),
        apiClient.get('/api/v1/ses-contracts/summary'),
      ]);
      setContracts(res.data.data);
      setMeta(res.data.meta);
      setSummary(sumRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('SES台帳の取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, statusFilter, page, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-5xl">⚠️</p>
        <p className="text-gray-600">{error}</p>
        <Button onClick={fetchData}>再試行</Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen py-6 px-6 max-w-[1600px] mx-auto">

      {/* ── タイトル ── */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SES台帳</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">全 {meta.total} 件</p>}
        </div>
      </div>

      {/* ── サマリーカード ── */}
      <SummaryCards summary={summary} />

      {/* ── フィルタ・列グループ切り替え ── */}
      <Card className="mb-3 shadow-sm flex-shrink-0">
        <CardContent className="py-3 px-4">
          <div className="flex gap-2 items-center flex-wrap">
            {/* 検索 */}
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input className="pl-8 bg-white" placeholder="氏名・顧客・案件名で検索"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
              />
            </div>
            {/* ステータス */}
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">全ステータス</option>
              {SES_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button onClick={() => { setSearch(searchInput); setPage(1); }}>検索</Button>
            {(search || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setPage(1); }}
                className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
            )}

            {/* 列グループ切り替え */}
            <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-0.5 gap-0.5">
              {COLUMN_GROUPS.map(g => (
                <button key={g.key} onClick={() => setColumnGroup(g.key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium whitespace-nowrap ${
                    columnGroup === g.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── テーブル ── */}
      <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <CardContent className="p-0 flex flex-col h-full overflow-hidden">

          {/* ── 基本グループ ── */}
          {columnGroup === 'basic' && (
            <>
              <div className="flex-shrink-0 border-b bg-gray-50 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr>
                      {['項番','氏名','変更種別','所属','顧客','エンド','案件名','最寄駅','ステータス','契約終了','残日数'].map(h => (
                        <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm whitespace-nowrap">
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr><td colSpan={11} className="py-16 text-center text-gray-400">データがありません</td></tr>
                    ) : contracts.map((c, idx) => {
                      const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['新規'];
                      return (
                        <tr key={c.id}
                          className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                          onClick={() => router.push(`/deals/${c.id}`)}>
                          <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                          <td className="px-3 font-semibold text-blue-600">{c.engineer_name ?? <Em />}</td>
                          <td className="px-3 text-xs text-gray-500">{c.change_type ?? <Em />}</td>
                          <td className="px-3 text-xs text-gray-500">{c.affiliation ?? <Em />}</td>
                          <td className="px-3 text-xs text-gray-700 max-w-32 truncate">{c.customer_name ?? <Em />}</td>
                          <td className="px-3 text-xs text-gray-500 max-w-28 truncate">{c.end_client ?? <Em />}</td>
                          <td className="px-3 text-xs text-gray-700 max-w-40 truncate">{c.project_name ?? <Em />}</td>
                          <td className="px-3 text-xs text-gray-500">{c.nearest_station ?? <Em />}</td>
                          <td className="px-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: cfg.bg, color: cfg.color }}>{c.status}</span>
                          </td>
                          <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_period_end)}</td>
                          <td className="px-3"><ExpiryBadge days={c.days_until_expiry} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 金額グループ ── */}
          {columnGroup === 'amount' && (
            <>
              <div className="flex-shrink-0 border-b bg-gray-50 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr>
                      {['項番','氏名','顧客','入金','支払+22%','支払+29%','営業支援費支払先','営業支援費','調整金額','利益','利益/29%'].map(h => (
                        <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm whitespace-nowrap">
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr><td colSpan={11} className="py-16 text-center text-gray-400">データがありません</td></tr>
                    ) : contracts.map((c, idx) => (
                      <tr key={c.id}
                        className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                        onClick={() => router.push(`/deals/${c.id}`)}>
                        <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                        <td className="px-3 font-semibold text-blue-600">{c.engineer_name ?? <Em />}</td>
                        <td className="px-3 text-xs text-gray-600 max-w-28 truncate">{c.customer_name ?? <Em />}</td>
                        <td className="px-3 text-sm font-semibold text-gray-800">{fmt(c.income_amount)}</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.billing_plus_22)}</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.billing_plus_29)}</td>
                        <td className="px-3 text-xs text-gray-500 max-w-28 truncate">{c.sales_support_payee ?? <Em />}</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.sales_support_fee)}</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.adjustment_amount)}</td>
                        <td className="px-3 text-sm font-semibold text-emerald-600">{fmt(c.profit)}</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.profit_rate_29)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 精算条件グループ ── */}
          {columnGroup === 'settlement' && (
            <>
              <div className="flex-shrink-0 border-b bg-gray-50 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr>
                      {['項番','氏名','顧客側 控除単価','控除時間','超過単価','超過時間','精算単位(分)','入金サイト','仕入側 控除単価','控除時間','超過単価','超過時間','支払サイト'].map(h => (
                        <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm whitespace-nowrap">
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr><td colSpan={13} className="py-16 text-center text-gray-400">データがありません</td></tr>
                    ) : contracts.map((c, idx) => (
                      <tr key={c.id}
                        className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                        onClick={() => router.push(`/deals/${c.id}`)}>
                        <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                        <td className="px-3 font-semibold text-blue-600 text-xs">{c.engineer_name ?? <Em />}</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.client_deduction_unit_price)}</td>
                        <td className="px-3 text-xs text-gray-600">{c.client_deduction_hours ?? <Em />}h</td>
                        <td className="px-3 text-xs text-gray-600">{fmt(c.client_overtime_unit_price)}</td>
                        <td className="px-3 text-xs text-gray-600">{c.client_overtime_hours ?? <Em />}h</td>
                        <td className="px-3 text-xs text-gray-600">{c.settlement_unit_minutes ?? <Em />}分</td>
                        <td className="px-3 text-xs text-gray-600">{c.payment_site ?? <Em />}日</td>
                        <td className="px-3 text-xs text-gray-500">{fmt(c.vendor_deduction_unit_price)}</td>
                        <td className="px-3 text-xs text-gray-500">{c.vendor_deduction_hours ?? <Em />}h</td>
                        <td className="px-3 text-xs text-gray-500">{fmt(c.vendor_overtime_unit_price)}</td>
                        <td className="px-3 text-xs text-gray-500">{c.vendor_overtime_hours ?? <Em />}h</td>
                        <td className="px-3 text-xs text-gray-500">{c.vendor_payment_site ?? <Em />}日</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 勤務表・SES情報グループ ── */}
          {columnGroup === 'work' && (
            <>
              <div className="flex-shrink-0 border-b bg-gray-50 overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr>
                      {['項番','氏名','契約開始','契約期間開始','契約期間終了','期間末(所属)','勤務表受領','交通費','請求書','特記事項','適格請求書番号'].map(h => (
                        <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm whitespace-nowrap">
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr><td colSpan={11} className="py-16 text-center text-gray-400">データがありません</td></tr>
                    ) : contracts.map((c, idx) => (
                      <tr key={c.id}
                        className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                        onClick={() => router.push(`/deals/${c.id}`)}>
                        <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                        <td className="px-3 font-semibold text-blue-600 text-xs">{c.engineer_name ?? <Em />}</td>
                        <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_start)}</td>
                        <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_period_start)}</td>
                        <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_period_end)}</td>
                        <td className="px-3 text-xs text-gray-500">{c.affiliation_period_end ?? <Em />}</td>
                        <td className="px-3 text-xs text-gray-500">{fmtDate(c.timesheet_received_date)}</td>
                        <td className="px-3 text-xs text-gray-500">{fmt(c.transportation_fee)}</td>
                        <td className="px-3 text-xs">
                          {c.invoice_exists === true
                            ? <span className="text-emerald-600">✓ 受領</span>
                            : c.invoice_exists === false
                            ? <span className="text-red-400">✗ 未受領</span>
                            : <Em />}
                        </td>
                        <td className="px-3 text-xs text-gray-500 max-w-40 truncate">{c.notes ?? <Em />}</td>
                        <td className="px-3 text-xs text-gray-400 max-w-48 truncate">{c.invoice_number ?? <Em />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </CardContent>
      </Card>

      {/* ── ページネーション ── */}
      {meta && meta.last_page > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4 flex-shrink-0">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
          <span className="text-sm text-gray-500">{page} / {meta.last_page} ページ</span>
          <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><SesContractsPage /></Suspense>;
}
