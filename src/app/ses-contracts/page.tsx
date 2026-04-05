'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/authStore';
import UserFilter, { defaultUserFilter } from '@/components/UserFilter';

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
  income_amount: number | null;
  billing_plus_22: number | null;
  billing_plus_29: number | null;
  sales_support_payee: string | null;
  sales_support_fee: number | null;
  adjustment_amount: number | null;
  profit: number | null;
  profit_rate_29: number | null;
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
  contract_start: string | null;
  contract_period_start: string | null;
  contract_period_end: string | null;
  affiliation_period_end: string | null;
  timesheet_received_date: string | null;
  transportation_fee: number | null;
  invoice_exists: boolean | null;
  invoice_received_date: string | null;
  notes: string | null;
  days_until_expiry: number | null;
  sales_person: string | null;
  assignees: { id: number; name: string }[];
  client_contact: string | null;
  client_mobile: string | null;
  client_phone: string | null;
  client_fax: string | null;
}

interface Summary {
  total_income: number;
  total_profit: number;
  active_count: number;
  expiring_count: number;
}

interface Meta { current_page: number; last_page: number; total: number; }
interface ImportLog {
  id: number; status: string; total_rows: number;
  created_count: number; updated_count: number;
  skipped_count: number; error_count: number;
  error_details?: { row: number; reason: string }[];
}

// ── 定数 ──────────────────────────────────────────────────────
type ColumnGroup = 'basic' | 'amount' | 'settlement' | 'work';
type ViewMode = 'list' | 'kanban';

const COLUMN_GROUPS: { key: ColumnGroup; label: string }[] = [
  { key: 'basic',      label: '📋 基本' },
  { key: 'amount',     label: '💰 金額' },
  { key: 'settlement', label: '⚖️ 精算条件' },
  { key: 'work',       label: '📅 契約・SES' },
];

const SES_STATUSES = ['稼働中', '更新交渉中', '期限切れ', '新規', '提案', '交渉', '成約', '失注'];
const KANBAN_STATUSES = ['稼働中', '更新交渉中', '新規', '提案', '交渉', '成約', '失注', '期限切れ'];

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; headerBg: string }> = {
  稼働中:     { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', headerBg: '#10B981' },
  更新交渉中: { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', headerBg: '#F59E0B' },
  新規:       { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', headerBg: '#64748B' },
  提案:       { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', headerBg: '#3B82F6' },
  交渉:       { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', headerBg: '#F97316' },
  成約:       { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', headerBg: '#22C55E' },
  失注:       { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', headerBg: '#EF4444' },
  期限切れ:   { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB', headerBg: '#9CA3AF' },
};

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const fmt = (v: number | null) => v != null ? `¥${Number(v).toLocaleString()}` : '—';
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const Em = () => <span className="text-gray-300 text-xs">—</span>;

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <Em />;
  if (days < 0)   return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">終了済</span>;
  if (days <= 7)  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold animate-pulse">⚠ {days}日</span>;
  if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">⚡ {days}日</span>;
  return <span className="text-xs text-gray-400">{days}日</span>;
}

// ── サマリーカード ─────────────────────────────────────────────
function SummaryCards({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  const cards = [
    { label: '稼働中',       value: `${summary.active_count}件`,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '期限30日以内', value: `${summary.expiring_count}件`, color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: '月次売上合計', value: fmt(summary.total_income),    color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: '月次利益合計', value: fmt(summary.total_profit),    color: 'text-purple-600',  bg: 'bg-purple-50' },
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

// ── インポートモーダル ─────────────────────────────────────────
function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile]             = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [result, setResult]         = useState<{ message: string; log: ImportLog } | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xlsm') || f.name.endsWith('.xls'))) {
      setFile(f); setResult(null);
    } else { alert('Excel ファイル（.xlsx / .xlsm）を選択してください'); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post('/api/v1/ses-contracts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.log.status === 'completed') onSuccess();
    } catch (err: any) {
      setResult({ message: 'インポートに失敗しました', log: err.response?.data?.log });
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-base font-bold text-gray-800">📥 Excel インポート（SES台帳）</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
              ${file ? 'border-green-400 bg-green-50' : ''}`}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); } }} />
            {file ? (
              <div className="space-y-1">
                <p className="text-3xl">📊</p>
                <p className="text-sm font-semibold text-green-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                <button className="text-xs text-gray-400 hover:text-red-400 underline mt-1"
                  onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}>ファイルを変更</button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-4xl">📂</p>
                <p className="text-sm font-medium text-gray-600">ここにファイルをドロップ<br /><span className="text-gray-400">または クリックして選択</span></p>
                <p className="text-xs text-gray-300">.xlsx / .xlsm 対応・最大 10MB</p>
              </div>
            )}
          </div>
          <Button className="w-full" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                インポート中...
              </span>
            ) : 'インポート実行'}
          </Button>
          {result && (
            <div className={`rounded-xl p-4 text-sm space-y-2 ${
              result.log?.status === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="font-semibold text-gray-700">{result.message}</p>
              {result.log && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '新規', value: result.log.created_count, color: 'text-green-600' },
                    { label: '更新', value: result.log.updated_count, color: 'text-blue-600' },
                    { label: 'エラー', value: result.log.error_count, color: 'text-red-500' },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-lg p-2">
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-gray-400">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── カンバンカード ─────────────────────────────────────────────
function KanbanCard({ item, onNavigate }: { item: SesContract; onNavigate: (id: number) => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['新規'];
  return (
    <div onClick={() => onNavigate(item.id)}
      className="bg-white rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow group"
      style={{ borderLeft: `3px solid ${cfg.border}` }}>
      <p className="text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug mb-1">
        {item.engineer_name ?? '—'}
      </p>
      <p className="text-xs text-gray-400 truncate mb-2">🏢 {item.customer_name ?? '—'}</p>
      {item.project_name && <p className="text-xs text-gray-500 truncate mb-2">{item.project_name}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{fmt(item.income_amount)}</span>
        <ExpiryBadge days={item.days_until_expiry} />
      </div>
      {item.contract_period_end && (
        <p className="text-xs text-gray-300 mt-1.5">📅 {fmtDate(item.contract_period_end)}</p>
      )}
    </div>
  );
}

// ── カンバン列 ─────────────────────────────────────────────────
function KanbanColumn({ status, items, onNavigate }: {
  status: string; items: SesContract[]; onNavigate: (id: number) => void;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['新規'];
  const totalIncome = items.reduce((sum, d) => sum + Number(d.income_amount ?? 0), 0);
  return (
    <div className="flex flex-col min-w-[220px] max-w-[260px] flex-shrink-0">
      <div className="rounded-t-lg px-3 py-2 flex items-center justify-between mb-1" style={{ backgroundColor: cfg.headerBg }}>
        <span className="text-xs font-bold text-white">{status}</span>
        <span className="bg-white/25 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">{items.length}</span>
      </div>
      <p className="text-xs text-gray-400 px-1 mb-2">合計: ¥{totalIncome.toLocaleString()}</p>
      <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-lg">
            <span className="text-xs text-gray-300">案件なし</span>
          </div>
        ) : items.map(d => <KanbanCard key={d.id} item={d} onNavigate={onNavigate} />)}
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────
function SesContractsPage() {
  const router = useRouter();
  const [contracts, setContracts]     = useState<SesContract[]>([]);
  const [allContracts, setAllContracts] = useState<SesContract[]>([]);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [meta, setMeta]               = useState<Meta | null>(null);
  const [grandTotal, setGrandTotal]   = useState<number | null>(null);
  const [viewMode, setViewMode]       = useState<ViewMode>('list');
  const [columnGroup, setColumnGroup] = useState<ColumnGroup>('basic');
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { user } = useAuthStore();
  const [userFilter, setUserFilter] = useState<string>('all');
  useEffect(() => { setUserFilter(defaultUserFilter(user)); }, [user]);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showImport, setShowImport]   = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [res, allRes, sumRes] = await Promise.all([
        apiClient.get('/api/v1/ses-contracts', { params: { search, status: statusFilter, page, per_page: 50, user_id: userFilter } }),
        apiClient.get('/api/v1/ses-contracts', { params: { page: 1, per_page: 200 } }),
        apiClient.get('/api/v1/ses-contracts/summary'),
      ]);
      setContracts(res.data.data);
      setMeta(res.data.meta);
      setAllContracts(allRes.data.data);
      setSummary(sumRes.data);
      if (userFilter === 'all') setGrandTotal(res.data.meta.total);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError('SES台帳の取得に失敗しました');
    } finally { setLoading(false); }
  }, [search, statusFilter, page, userFilter, router]);

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

  const kanbanGroups = KANBAN_STATUSES.reduce<Record<string, SesContract[]>>((acc, s) => {
    acc[s] = allContracts.filter(c => c.status === s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-screen py-6 px-6 max-w-[1600px] mx-auto">

      {/* タイトル */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SES台帳</h1>
          {meta && <p className="text-sm text-gray-400 mt-0.5">
            {userFilter !== 'all' && grandTotal !== null ? `${grandTotal}件中 ${meta.total}件` : `全 ${meta.total}件`}
          </p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-0.5 gap-0.5">
            {(['list', 'kanban'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  viewMode === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                {v === 'list' ? '📋 リスト' : '🗂 カンバン'}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setShowImport(true)}
            className="gap-1 border-green-300 text-green-700 hover:bg-green-50">
            📥 Excel取込
          </Button>
          <Button onClick={() => router.push('/ses-contracts/create')} className="gap-1">
            <span className="text-base">＋</span> 新規登録
          </Button>
        </div>
      </div>

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onSuccess={() => { fetchData(); }} />
      )}

      <SummaryCards summary={summary} />

      {/* カンバンビュー */}
      {viewMode === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
          {KANBAN_STATUSES.map(status => (
            <KanbanColumn key={status} status={status}
              items={kanbanGroups[status] ?? []}
              onNavigate={id => router.push(`/ses-contracts/${id}/edit`)} />
          ))}
        </div>
      )}

      {/* リストビュー */}
      {viewMode === 'list' && (
        <>
          <Card className="mb-3 shadow-sm flex-shrink-0">
            <CardContent className="py-3 px-4">
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <Input className="pl-8 bg-white" placeholder="氏名・顧客・案件名で検索"
                    value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="">全ステータス</option>
                  {SES_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <UserFilter value={userFilter} onChange={v => { setUserFilter(v); setPage(1); }} className={selectCls} />
                <Button onClick={() => { setSearch(searchInput); setPage(1); }}>検索</Button>
                {(search || statusFilter) && (
                  <Button variant="ghost" size="sm"
                    onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setPage(1); }}
                    className="text-gray-400 hover:text-gray-600">✕ クリア</Button>
                )}
                <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-0.5 gap-0.5">
                  {COLUMN_GROUPS.map(g => (
                    <button key={g.key} onClick={() => setColumnGroup(g.key)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium whitespace-nowrap ${
                        columnGroup === g.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <CardContent className="p-0 flex flex-col h-full overflow-hidden">

              {/* 基本 */}
              {columnGroup === 'basic' && (
                <>
                  <div className="flex-shrink-0 border-b bg-gray-50">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1200px'}}>
                      <colgroup>
                        <col style={{width:'60px'}} /><col style={{width:'100px'}} /><col style={{width:'80px'}} />
                        <col style={{width:'80px'}} /><col style={{width:'140px'}} /><col style={{width:'120px'}} />
                        <col style={{width:'160px'}} /><col style={{width:'90px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'70px'}} /><col style={{width:'50px'}} />
                      </colgroup>
                      <thead><tr>
                        {['項番','氏名','変更種別','所属','顧客','エンド','案件名','ステータス','契約終了','残日数','操作'].map((h,i) => (
                          <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4 text-xs">{h}</th>
                        ))}
                      </tr></thead>
                    </table>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1200px'}}>
                      <colgroup>
                        <col style={{width:'60px'}} /><col style={{width:'100px'}} /><col style={{width:'80px'}} />
                        <col style={{width:'80px'}} /><col style={{width:'140px'}} /><col style={{width:'120px'}} />
                        <col style={{width:'160px'}} /><col style={{width:'90px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'70px'}} /><col style={{width:'50px'}} />
                      </colgroup>
                      <tbody>
                        {contracts.length === 0 ? (
                          <tr><td colSpan={11} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                              <span className="text-5xl">📋</span>
                              <p>SES台帳が登録されていません</p>
                              <Button size="sm" variant="outline" onClick={() => router.push('/ses-contracts/create')}>
                                最初の案件を登録する
                              </Button>
                            </div>
                          </td></tr>
                        ) : contracts.map((c, idx) => {
                          const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['新規'];
                          return (
                            <tr key={c.id}
                              className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                              onClick={() => router.push(`/ses-contracts/${c.id}/edit`)}>
                              <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                              <td className="px-3 font-semibold text-blue-600 text-sm truncate max-w-0">{c.engineer_name ?? <Em />}</td>
                              <td className="px-3 text-xs text-gray-500">{c.change_type ?? <Em />}</td>
                              <td className="px-3 text-xs text-gray-500 truncate max-w-0">{c.affiliation ?? <Em />}</td>
                              <td className="px-3 text-xs text-gray-700 max-w-32 truncate">{c.customer_name ?? <Em />}</td>
                              <td className="px-3 text-xs text-gray-500 max-w-28 truncate">{c.end_client ?? <Em />}</td>
                              <td className="px-3 text-xs text-gray-700 truncate max-w-0">{c.project_name ?? <Em />}</td>
                              <td className="px-3">
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                  style={{ backgroundColor: cfg.bg, color: cfg.color }}>{c.status}</span>
                              </td>
                              <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_period_end)}</td>
                              <td className="px-3"><ExpiryBadge days={c.days_until_expiry} /></td>
                              <td className="px-3" onClick={e => e.stopPropagation()}>
                                <button onClick={() => router.push(`/ses-contracts/${c.id}/edit`)}
                                  className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:bg-amber-100 hover:text-amber-600">✏️</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* 金額 */}
              {columnGroup === 'amount' && (
                <>
                  <div className="flex-shrink-0 border-b bg-gray-50">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1100px'}}>
                      <colgroup>
                        <col style={{width:'60px'}} /><col style={{width:'90px'}} /><col style={{width:'120px'}} />
                        <col style={{width:'100px'}} /><col style={{width:'100px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'130px'}} /><col style={{width:'100px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'100px'}} /><col style={{width:'100px'}} />
                      </colgroup>
                      <thead><tr>
                        {['項番','氏名','顧客','入金','支払+22%','支払+29%','営業支援費支払先','営業支援費','調整金額','利益','利益/29%'].map(h => (
                          <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4 text-xs">{h}</th>
                        ))}
                      </tr></thead>
                    </table>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1100px'}}>
                      <colgroup>
                        <col style={{width:'60px'}} /><col style={{width:'90px'}} /><col style={{width:'120px'}} />
                        <col style={{width:'100px'}} /><col style={{width:'100px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'130px'}} /><col style={{width:'100px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'100px'}} /><col style={{width:'100px'}} />
                      </colgroup>
                      <tbody>
                        {contracts.map((c, idx) => (
                          <tr key={c.id}
                            className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                            onClick={() => router.push(`/ses-contracts/${c.id}/edit`)}>
                            <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                            <td className="px-3 font-semibold text-blue-600 text-xs truncate max-w-0">{c.engineer_name ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-600 truncate max-w-0">{c.customer_name ?? <Em />}</td>
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

              {/* 精算条件 */}
              {columnGroup === 'settlement' && (
                <>
                  <div className="flex-shrink-0 border-b bg-gray-50">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1100px'}}>
                      <colgroup>
                        <col style={{width:'55px'}} /><col style={{width:'90px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'65px'}} /><col style={{width:'90px'}} /><col style={{width:'65px'}} />
                        <col style={{width:'70px'}} /><col style={{width:'80px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'65px'}} /><col style={{width:'90px'}} /><col style={{width:'65px'}} />
                        <col style={{width:'80px'}} />
                      </colgroup>
                      <thead><tr>
                        {['項番','氏名','顧客側 控除単価','控除h','超過単価','超過h','精算(分)','入金サイト','仕入側 控除単価','控除h②','超過単価②','超過h②','支払サイト'].map((h, i) => (
                          <th key={i} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4 text-xs">{h.replace('②','')}</th>
                        ))}
                      </tr></thead>
                    </table>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1100px'}}>
                      <colgroup>
                        <col style={{width:'55px'}} /><col style={{width:'90px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'65px'}} /><col style={{width:'90px'}} /><col style={{width:'65px'}} />
                        <col style={{width:'70px'}} /><col style={{width:'80px'}} /><col style={{width:'100px'}} />
                        <col style={{width:'65px'}} /><col style={{width:'90px'}} /><col style={{width:'65px'}} />
                        <col style={{width:'80px'}} />
                      </colgroup>
                      <tbody>
                        {contracts.map((c, idx) => (
                          <tr key={c.id}
                            className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                            onClick={() => router.push(`/ses-contracts/${c.id}/edit`)}>
                            <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                            <td className="px-3 font-semibold text-blue-600 text-xs truncate max-w-0">{c.engineer_name ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-600">{fmt(c.client_deduction_unit_price)}</td>
                            <td className="px-3 text-xs text-gray-600">{c.client_deduction_hours ?? '—'}</td>
                            <td className="px-3 text-xs text-gray-600">{fmt(c.client_overtime_unit_price)}</td>
                            <td className="px-3 text-xs text-gray-600">{c.client_overtime_hours ?? '—'}</td>
                            <td className="px-3 text-xs text-gray-600">{c.settlement_unit_minutes ?? '—'}</td>
                            <td className="px-3 text-xs text-gray-600">{c.payment_site ?? '—'}</td>
                            <td className="px-3 text-xs text-gray-500">{fmt(c.vendor_deduction_unit_price)}</td>
                            <td className="px-3 text-xs text-gray-500">{c.vendor_deduction_hours ?? '—'}</td>
                            <td className="px-3 text-xs text-gray-500">{fmt(c.vendor_overtime_unit_price)}</td>
                            <td className="px-3 text-xs text-gray-500">{c.vendor_overtime_hours ?? '—'}</td>
                            <td className="px-3 text-xs text-gray-500">{c.vendor_payment_site ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* 勤務表・SES */}
              {columnGroup === 'work' && (
                <>
                  <div className="flex-shrink-0 border-b bg-gray-50">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1000px'}}>
                      <colgroup>
                        <col style={{width:'50px'}} /><col style={{width:'80px'}} /><col style={{width:'80px'}} />
                        <col style={{width:'80px'}} /><col style={{width:'90px'}} /><col style={{width:'90px'}} />
                        <col style={{width:'80px'}} /><col style={{width:'75px'}} /><col style={{width:'85px'}} />
                        <col style={{width:'90px'}} /><col style={{width:'90px'}} /><col style={{width:'90px'}} />
                        <col style={{width:'85px'}} /><col style={{width:'75px'}} /><col style={{width:'65px'}} />
                        <col style={{width:'auto'}} />
                      </colgroup>
                      <thead><tr>
                        {['項番','氏名','自社担当者','所属担当者','客先担当者','携帯','TEL','FAX','契約開始','契約期間開始','契約期間終了','期間末(所属)','勤務表受領','交通費','請求書','特記事項'].map(h => (
                          <th key={h} className="font-semibold text-gray-600 py-3 px-3 text-left first:pl-4 text-xs">{h}</th>
                        ))}
                      </tr></thead>
                    </table>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="text-sm whitespace-nowrap" style={{tableLayout:'fixed', width:'100%', minWidth:'1000px'}}>
                      <colgroup>
                        <col style={{width:'50px'}} /><col style={{width:'80px'}} /><col style={{width:'80px'}} />
                        <col style={{width:'80px'}} /><col style={{width:'90px'}} /><col style={{width:'90px'}} />
                        <col style={{width:'80px'}} /><col style={{width:'75px'}} /><col style={{width:'85px'}} />
                        <col style={{width:'90px'}} /><col style={{width:'90px'}} /><col style={{width:'90px'}} />
                        <col style={{width:'85px'}} /><col style={{width:'75px'}} /><col style={{width:'65px'}} />
                        <col style={{width:'auto'}} />
                      </colgroup>
                      <tbody>
                        {contracts.map((c, idx) => (
                          <tr key={c.id}
                            className={`hover:bg-blue-50/60 cursor-pointer transition-colors border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}
                            onClick={() => router.push(`/ses-contracts/${c.id}/edit`)}>
                            <td className="py-2.5 px-3 pl-4 text-gray-400 text-xs">{c.project_number ?? <Em />}</td>
                            <td className="px-3 font-semibold text-blue-600 text-xs truncate max-w-0">{c.engineer_name ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500 truncate max-w-0">{c.assignees?.length ? c.assignees.map(a => a.name).join('・') : (c.sales_person ?? <Em />)}</td>
                            <td className="px-3 text-xs text-gray-500 truncate max-w-0">{c.affiliation_contact ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500 truncate max-w-0">{c.client_contact ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500">{c.client_mobile ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500">{c.client_phone ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500">{c.client_fax ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_start)}</td>
                            <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_period_start)}</td>
                            <td className="px-3 text-xs text-gray-500">{fmtDate(c.contract_period_end)}</td>
                            <td className="px-3 text-xs text-gray-500">{c.affiliation_period_end ?? <Em />}</td>
                            <td className="px-3 text-xs text-gray-500">{fmtDate(c.timesheet_received_date)}</td>
                            <td className="px-3 text-xs text-gray-500">{fmt(c.transportation_fee)}</td>
                            <td className="px-3 text-xs">
                              {c.invoice_exists === true ? <span className="text-emerald-600">✓ 受領</span>
                               : c.invoice_exists === false ? <span className="text-red-400">✗ 未受領</span>
                               : <Em />}
                            </td>
                            <td className="px-3 text-xs text-gray-500 max-w-40 truncate">{c.notes ?? <Em />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

            </CardContent>
          </Card>

          {meta && meta.last_page > 1 && (
            <div className="flex justify-center items-center gap-3 mt-4 flex-shrink-0">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← 前へ</Button>
              <span className="text-sm text-gray-500">{page} / {meta.last_page} ページ</span>
              <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>次へ →</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><SesContractsPage /></Suspense>;
}
