'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

type GroupType = 'deal' | 'customer';

interface DealRow {
  deal_id: number;
  deal_title: string;
  customer_id: number | null;
  customer_name: string | null;
  invoice_code: string | null;
  engineer_name: string | null;
  actual_hours: number | null;
  basic: number;
  deduction: number;
  overtime: number;
  transportation: number;
  subtotal: number;
  tax: number;
  total: number;
  tax_rate: number;
  invoice_id: number | null;
  invoice_status: 'draft' | 'issued' | null;
  invoice_pdf_path: string | null;
}

interface CustomerRow {
  customer_id: number | null;
  customer_name: string | null;
  invoice_code: string | null;
  deal_count: number;
  actual_hours: number;
  basic: number;
  deduction: number;
  overtime: number;
  transportation: number;
  subtotal: number;
  tax: number;
  total: number;
}

interface Totals {
  basic: number; deduction: number; overtime: number;
  transportation: number; subtotal: number; tax: number; total: number;
}

const yen = (n: number | null | undefined) =>
  n == null ? '-' : `¥${Number(n).toLocaleString()}`;

/** 直近12ヶ月の YYYY-MM 配列を新しい順で返す */
const recentMonths = (): string[] => {
  const arr: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
};

export default function BillingSummariesPage() {
  const router = useRouter();
  const months = recentMonths();
  // デフォルトは当月。Refinitiv 取込モーダルの請求月初期値にも伝播する
  const [yearMonth, setYearMonth] = useState<string>(months[0]);
  const [group,     setGroup]     = useState<GroupType>('deal');
  const [q,         setQ]         = useState<string>('');
  const [items,     setItems]     = useState<(DealRow | CustomerRow)[]>([]);
  const [totals,    setTotals]    = useState<Totals | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [issuingId,  setIssuingId]  = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [deletingWrId, setDeletingWrId] = useState<number | null>(null);
  const [sortBy,    setSortBy]    = useState<string>('customer');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year_month: yearMonth, group });
      if (q.trim()) params.set('q', q.trim());
      const res = await apiClient.get(`/api/v1/billing-summaries?${params.toString()}`);
      setItems(res.data.items ?? []);
      setTotals(res.data.totals ?? null);
    } finally {
      setLoading(false);
    }
  }, [yearMonth, group, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const get = (r: DealRow | CustomerRow): string | number => {
      switch (sortBy) {
        case 'customer':       return r.customer_name ?? '';
        case 'invoice_code':   return r.invoice_code ?? '';
        case 'deal':           return (r as DealRow).deal_title ?? '';
        case 'engineer':       return (r as DealRow).engineer_name ?? '';
        case 'deal_count':     return (r as CustomerRow).deal_count ?? 0;
        case 'actual_hours':   return Number(r.actual_hours ?? 0);
        case 'basic':          return Number(r.basic);
        case 'deduction':      return Number(r.deduction);
        case 'overtime':       return Number(r.overtime);
        case 'transportation': return Number(r.transportation);
        case 'subtotal':       return Number(r.subtotal);
        case 'tax':            return Number(r.tax);
        case 'total':          return Number(r.total);
        default:               return r.customer_name ?? '';
      }
    };
    arr.sort((a, b) => {
      const ka = get(a), kb = get(b);
      if (ka < kb) return sortOrder === 'asc' ? -1 : 1;
      if (ka > kb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [items, sortBy, sortOrder]);

  const issueInvoice = async (dealId: number, customerName: string | null) => {
    if (!confirm(`${customerName ?? ''} / ${yearMonth} の請求書 下書きを作成します。よろしいですか？`)) return;
    setIssuingId(dealId);
    try {
      const res = await apiClient.post<{ id: number }>('/api/v1/invoices', {
        deal_id:    dealId,
        year_month: yearMonth,
      });
      router.push(`/invoices/${res.data.id}`);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const msg = data?.errors?.deal_id?.[0] ?? data?.message ?? '請求書の発行に失敗しました';
      alert(msg);
      setIssuingId(null);
    }
  };

  const deleteWorkRecord = async (dealId: number, dealTitle: string) => {
    if (!confirm(`${dealTitle} / ${yearMonth} の勤務表を削除します。\n削除すると請求集計の表示から消えます。よろしいですか？`)) return;
    setDeletingWrId(dealId);
    try {
      await apiClient.delete(`/api/v1/deals/${dealId}/work-records/${yearMonth}`);
      await fetchData();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      alert(data?.message ?? '勤務表の削除に失敗しました');
    } finally {
      setDeletingWrId(null);
    }
  };

  const deleteInvoice = async (invoiceId: number, status: 'draft' | 'issued', customerName: string | null) => {
    const label = status === 'issued' ? '発行済' : '下書き';
    if (!confirm(`${customerName ?? ''} / ${yearMonth} の請求書（${label}）を削除します。\n誤発行のリカバリ用です。よろしいですか？`)) return;
    setDeletingId(invoiceId);
    try {
      await apiClient.delete(`/api/v1/invoices/${invoiceId}`);
      await fetchData();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      alert(data?.message ?? '請求書の削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  const downloadCsv = async () => {
    const params = new URLSearchParams({ year_month: yearMonth, group });
    if (q.trim()) params.set('q', q.trim());
    const res = await apiClient.get(
      `/api/v1/billing-summaries/export.csv?${params.toString()}`,
      { responseType: 'blob' }
    );
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-summary-${yearMonth}-${group}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col p-6 w-full">
      {/* ヘッダ */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">請求書作成</h1>
        <p className="text-xs text-gray-400 mt-1">
          月別の請求金額を案件別・取引先別で試算（消費税10%、軽減税率は未対応）
        </p>
      </div>

      {/* コントロール */}
      <div className="flex-shrink-0 flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">対象月</label>
          <select
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">集計単位</label>
          <div className="inline-flex rounded-md overflow-hidden border border-gray-200">
            <button
              type="button"
              onClick={() => setGroup('deal')}
              className={`px-3 py-2 text-sm ${group === 'deal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >案件別</button>
            <button
              type="button"
              onClick={() => setGroup('customer')}
              className={`px-3 py-2 text-sm ${group === 'customer' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >取引先別</button>
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">検索</label>
          <Input
            type="text"
            placeholder="取引先名・案件名"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <span className="text-sm text-gray-500 self-center">全 {sortedItems.length} 件</span>

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? '更新中...' : '更新'}
          </Button>
          <Button
            onClick={() => setRefModalOpen(true)}
            disabled={loading}
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
            title="Refinitiv 注文書 PDF から請求書ドラフトを作成"
          >
            📋 Refinitiv注文書から請求書発行
          </Button>
          <Button
            onClick={downloadCsv}
            disabled={loading || sortedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            title={sortedItems.length === 0 ? '該当データがありません' : ''}
          >
            CSVダウンロード
          </Button>
        </div>
      </div>

      <RefinitivImportModal
        open={refModalOpen}
        onClose={() => setRefModalOpen(false)}
        defaultYearMonth={yearMonth}
        onIssued={(invoiceId) => {
          setRefModalOpen(false);
          router.push(`/invoices/${invoiceId}`);
        }}
      />

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="table-fixed w-full min-w-[1220px] text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                {group === 'deal' ? (
                  <>
                    <SortableHeader label="取引先"       field="customer"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[140px] whitespace-nowrap" />
                    <SortableHeader label="顧客コード"   field="invoice_code" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[110px] whitespace-nowrap" />
                    <SortableHeader label="案件"         field="deal"         sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px] whitespace-nowrap" />
                    <SortableHeader label="技術者"       field="engineer"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px] whitespace-nowrap" />
                  </>
                ) : (
                  <>
                    <SortableHeader label="取引先"       field="customer"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[200px] whitespace-nowrap" />
                    <SortableHeader label="顧客コード"   field="invoice_code" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[120px] whitespace-nowrap" />
                    <th className="text-right px-2 py-3 font-semibold w-[70px] whitespace-nowrap">案件数</th>
                  </>
                )}
                <th className="text-right px-2 py-3 font-semibold w-[60px] whitespace-nowrap">実時間</th>
                <th className="text-right px-2 py-3 font-semibold w-[80px] whitespace-nowrap">基本額</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px] whitespace-nowrap">控除</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px] whitespace-nowrap">超過</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px] whitespace-nowrap">交通費</th>
                <th className="text-right px-2 py-3 font-semibold w-[80px] whitespace-nowrap">小計</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px] whitespace-nowrap">消費税</th>
                <SortableHeader label="請求合計" field="total" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[130px] whitespace-nowrap" />
                {group === 'deal' && <th className="text-center px-2 py-3 font-semibold w-[230px] whitespace-nowrap">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">該当データなし</td></tr>
              ) : group === 'deal' ? (
                (sortedItems as DealRow[]).map((r, idx) => (
                  <tr key={r.deal_id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-2 py-3 text-gray-800 truncate" title={r.customer_name ?? ''}>{r.customer_name ?? '-'}</td>
                    <td className="px-2 py-3 text-gray-500 text-xs truncate" title={r.invoice_code ?? ''}>{r.invoice_code ?? '-'}</td>
                    <td className="px-2 py-3 truncate" title={r.deal_title ?? ''}>{r.deal_title}</td>
                    <td className="px-2 py-3 text-gray-600 truncate" title={r.engineer_name ?? ''}>{r.engineer_name ?? '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.actual_hours ?? '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{yen(r.basic)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-red-600">{r.deduction ? `-${yen(r.deduction).slice(1)}` : '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.overtime ? yen(r.overtime) : '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.transportation ? yen(r.transportation) : '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{yen(r.subtotal)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{yen(r.tax)}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-semibold">{yen(r.total)}</td>
                    <td className="px-2 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/ses-contracts/${r.deal_id}/timesheets`}
                          title="勤務表を編集"
                          className="text-xs px-2 py-1 rounded text-gray-700 hover:bg-gray-100"
                        >✏️</Link>
                        <Link
                          href={`/ses-contracts/${r.deal_id}/edit`}
                          title="案件・契約を編集"
                          className="text-xs px-2 py-1 rounded text-gray-700 hover:bg-gray-100"
                        >⚙️</Link>
                        {/* 削除ボタン（請求書 or 勤務表）— 歯車の右に配置 */}
                        {r.invoice_id ? (
                          <button
                            onClick={() => deleteInvoice(r.invoice_id!, r.invoice_status!, r.customer_name)}
                            disabled={deletingId === r.invoice_id}
                            title="請求書を削除（誤発行のリカバリ用）"
                            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 inline-block w-[32px] text-center"
                          >
                            {deletingId === r.invoice_id ? '...' : '🗑️'}
                          </button>
                        ) : (
                          <button
                            onClick={() => deleteWorkRecord(r.deal_id, r.deal_title)}
                            disabled={deletingWrId === r.deal_id}
                            title="勤務表を削除（請求集計から外す）"
                            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 inline-block w-[32px] text-center"
                          >
                            {deletingWrId === r.deal_id ? '...' : '🗑️'}
                          </button>
                        )}
                        {r.invoice_status === 'issued' && r.invoice_pdf_path ? (
                          <a
                            href={r.invoice_pdf_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="請求書PDFをダウンロード"
                            className="text-xs px-2 py-1 rounded text-gray-700 hover:bg-gray-100 inline-block w-[32px] text-center"
                          >📥</a>
                        ) : (
                          <span className="inline-block w-[32px]" aria-hidden="true" />
                        )}
                        {r.invoice_id ? (
                          <Link
                            href={`/invoices/${r.invoice_id}`}
                            title={r.invoice_status === 'issued' ? '発行済の請求書を表示' : '下書きの請求書を編集'}
                            className={`text-xs px-2 py-1 rounded text-white inline-block w-[72px] text-center ${
                              r.invoice_status === 'issued' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'
                            }`}
                          >
                            {r.invoice_status === 'issued' ? '📋 発行済' : '📋 下書き'}
                          </Link>
                        ) : (
                          <button
                            onClick={() => issueInvoice(r.deal_id, r.customer_name)}
                            disabled={issuingId === r.deal_id || !r.invoice_code}
                            title={!r.invoice_code ? '取引先に顧客コードが未設定です' : '請求書の下書きを作成'}
                            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-block w-[72px] text-center"
                          >
                            {issuingId === r.deal_id ? '...' : '📝 下書き'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                (sortedItems as CustomerRow[]).map((r, idx) => (
                  <tr key={r.customer_id ?? 0} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-2 py-3 text-gray-800 truncate" title={r.customer_name ?? ''}>{r.customer_name ?? '-'}</td>
                    <td className="px-2 py-3 text-gray-500 text-xs truncate" title={r.invoice_code ?? ''}>{r.invoice_code ?? '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.deal_count}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.actual_hours}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{yen(r.basic)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-red-600">{r.deduction ? `-${yen(r.deduction).slice(1)}` : '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.overtime ? yen(r.overtime) : '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.transportation ? yen(r.transportation) : '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{yen(r.subtotal)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{yen(r.tax)}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-semibold">{yen(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {totals && sortedItems.length > 0 && (
              <tfoot className="bg-gray-50 sticky bottom-0">
                <tr className="font-semibold">
                  <td className="px-3 py-3" colSpan={group === 'deal' ? 4 : 3}>合計</td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-right tabular-nums">{yen(totals.basic)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-red-600">{totals.deduction ? `-${yen(totals.deduction).slice(1)}` : '-'}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.overtime ? yen(totals.overtime) : '-'}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{yen(totals.transportation)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{yen(totals.subtotal)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{yen(totals.tax)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{yen(totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- Refinitiv 注文書 PDF 取込モーダル ----------

interface DealOption {
  deal_id: number;
  deal_title: string;
  customer_name: string;
  engineer_name: string | null;
}

interface ParsedPo {
  po_number: string | null;
  total_amount: number | null;
  description: string | null;
  requested_delivery_date: string | null;
  amount_based_receipt: string | null;
  purchase_request_line: string | null;
  requester: string | null;
  request_number: string | null;
  plant_id: string | null;
  plant_name: string | null;
  tr_plant_id: string | null;
  ship_to_address_name: string | null;
  classification_domain: string | null;
  classification_code: string | null;
}

const EMPTY_PARSED: ParsedPo = {
  po_number: '', total_amount: null, description: '', requested_delivery_date: '',
  amount_based_receipt: '', purchase_request_line: '', requester: '', request_number: '',
  plant_id: '', plant_name: '', tr_plant_id: '', ship_to_address_name: '',
  classification_domain: '', classification_code: '',
};

function RefinitivImportModal({
  open, onClose, defaultYearMonth, onIssued,
}: {
  open: boolean;
  onClose: () => void;
  defaultYearMonth: string;
  onIssued: (invoiceId: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedPo | null>(null);
  const [dealId, setDealId] = useState<number | null>(null);
  const [yearMonth, setYearMonth] = useState<string>(defaultYearMonth);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRefinitivDeals, setAllRefinitivDeals] = useState<DealOption[]>([]);
  const [dealSearch, setDealSearch] = useState<string>('');
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // モーダルを開いた時にリフィニティブ・ジャパンの SES案件 を全件取得（以降は client-side で絞り込み）
  useEffect(() => {
    if (!open) {
      setFile(null); setParsed(null); setDealId(null); setError(null);
      setYearMonth(defaultYearMonth); setDealSearch('');
      return;
    }
    setLoadingDeals(true);
    apiClient.get<{ data: Array<{ id: number; project_name: string | null; customer_name: string | null; engineer_name: string | null }> }>(
      '/api/v1/ses-contracts',
      { params: { search: 'リフィニティブ', per_page: 200, user_id: 'all', sort_by: 'customer_name', sort_order: 'asc' } },
    ).then((res) => {
      const rows = res.data?.data ?? [];
      // 顧客=リフィニティブ・ジャパン に限定（タイトル/技術者名に「リフィニティブ」が含まれる他顧客の案件を除外）
      const refinitivOnly = rows
        .filter((r) => (r.customer_name ?? '').includes('リフィニティブ・ジャパン'))
        .map((r) => ({
          deal_id: r.id,
          deal_title: r.project_name ?? '(無題)',
          customer_name: r.customer_name ?? '',
          engineer_name: r.engineer_name ?? null,
        }));
      setAllRefinitivDeals(refinitivOnly);
    }).catch(() => {
      setAllRefinitivDeals([]);
    }).finally(() => setLoadingDeals(false));
  }, [open, defaultYearMonth]);

  // 案件検索: タイトル / 技術者名 で追加フィルタ
  const dealOptions = dealSearch.trim()
    ? allRefinitivDeals.filter((d) => {
        const q = dealSearch.trim().toLowerCase();
        return d.deal_title.toLowerCase().includes(q)
            || (d.engineer_name ?? '').toLowerCase().includes(q);
      })
    : allRefinitivDeals;

  const handleParse = async () => {
    if (!file) return;
    setParsing(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post<ParsedPo>('/api/v1/invoices/refinitiv/parse', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setParsed({ ...EMPTY_PARSED, ...res.data });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'PDFの解析に失敗しました';
      setError(msg);
    } finally { setParsing(false); }
  };

  const handleIssue = async () => {
    if (!parsed || !dealId || !parsed.po_number) {
      setError('SES契約 と PO番号 は必須です');
      return;
    }
    setIssuing(true); setError(null);
    try {
      const vendor_metadata: Record<string, unknown> = {};
      (Object.keys(parsed) as (keyof ParsedPo)[]).forEach((k) => {
        if (parsed[k] !== null && parsed[k] !== '') vendor_metadata[k] = parsed[k];
      });
      const res = await apiClient.post<{ id: number }>('/api/v1/invoices/refinitiv/issue', {
        deal_id: dealId,
        year_month: yearMonth,
        po_number: parsed.po_number,
        vendor_metadata,
      });
      onIssued(res.data.id);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const msg = data?.message ?? Object.values(data?.errors ?? {})[0]?.[0] ?? '請求書発行に失敗しました';
      setError(msg);
    } finally { setIssuing(false); }
  };

  const updateField = <K extends keyof ParsedPo>(k: K, v: ParsedPo[K]) => {
    setParsed((p) => p ? { ...p, [k]: v } : p);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div data-modal-scroll className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">📋 Refinitiv 注文書から請求書発行</h2>
        <p className="text-xs text-gray-500 mb-4">SAP Business Network 経由で受領した注文書 PDF を取り込み、対象 SES案件 から請求書ドラフトを作成します。</p>

        {error && (
          <div className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="space-y-4">
          {/* PDF アップロード（D&D + ファイル選択） */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">注文書 PDF</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped && dropped.type === 'application/pdf') {
                  setFile(dropped);
                  setParsed(null);
                  setError(null);
                } else if (dropped) {
                  setError('PDFファイルをドロップしてください');
                }
              }}
              onClick={() => !(parsing || issuing) && document.getElementById('refinitiv-pdf-input')?.click()}
              className={`border-2 border-dashed rounded-md px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
                dragOver
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : file
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {file ? (
                <>
                  <div className="font-semibold">📄 {file.name}</div>
                  <div className="text-[11px] text-gray-500 mt-1">{Math.ceil(file.size / 1024)}KB / 別のPDFをドロップまたはクリックで差し替え</div>
                </>
              ) : (
                <>
                  <div>📎 ここに注文書PDFをドラッグ&ドロップ</div>
                  <div className="text-[11px] mt-1">またはクリックしてファイル選択（10MBまで）</div>
                </>
              )}
              <input
                id="refinitiv-pdf-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setParsed(null);
                  setError(null);
                  e.target.value = '';
                }}
                className="hidden"
                disabled={parsing || issuing}
              />
            </div>
            <div className="mt-2">
              <Button
                onClick={handleParse}
                disabled={!file || parsing || issuing}
                variant="outline"
                className="text-sm"
              >
                {parsing ? '解析中...' : 'PDFを解析'}
              </Button>
            </div>
          </div>

          {/* 抽出結果プレビュー */}
          {parsed && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">抽出結果（必要なら編集してください）</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">PO Number *</label>
                  <Input value={parsed.po_number ?? ''} onChange={(e) => updateField('po_number', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">希望納入日 (YYYY-MM-DD)</label>
                  <Input value={parsed.requested_delivery_date ?? ''} onChange={(e) => updateField('requested_delivery_date', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-0.5">明細説明</label>
                  <Input value={parsed.description ?? ''} onChange={(e) => updateField('description', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">金額による受入</label>
                  <Input value={parsed.amount_based_receipt ?? ''} onChange={(e) => updateField('amount_based_receipt', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">購入申請明細番号</label>
                  <Input value={parsed.purchase_request_line ?? ''} onChange={(e) => updateField('purchase_request_line', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">申請者</label>
                  <Input value={parsed.requester ?? ''} onChange={(e) => updateField('requester', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">申請番号</label>
                  <Input value={parsed.request_number ?? ''} onChange={(e) => updateField('request_number', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Plant.ID</label>
                  <Input value={parsed.plant_id ?? ''} onChange={(e) => updateField('plant_id', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Plant.Name</label>
                  <Input value={parsed.plant_name ?? ''} onChange={(e) => updateField('plant_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">TR_PlantID</label>
                  <Input value={parsed.tr_plant_id ?? ''} onChange={(e) => updateField('tr_plant_id', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">Ship ToAddressName</label>
                  <Input value={parsed.ship_to_address_name ?? ''} onChange={(e) => updateField('ship_to_address_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">分類ドメイン</label>
                  <Input value={parsed.classification_domain ?? ''} onChange={(e) => updateField('classification_domain', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-0.5">分類コード</label>
                  <Input value={parsed.classification_code ?? ''} onChange={(e) => updateField('classification_code', e.target.value)} />
                </div>
              </div>

              {/* SES案件 + 年月 */}
              <div className="border-t border-gray-100 pt-3 mt-4 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">案件検索（任意）</label>
                    <Input
                      value={dealSearch}
                      onChange={(e) => setDealSearch(e.target.value)}
                      placeholder="例: JBIC / 技術者名（リフィニティブ案件内で絞り込み）"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">対象月 *</label>
                    <Input value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} placeholder="YYYY-MM" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">対象 SES案件 *</label>
                  <select
                    value={dealId ?? ''}
                    onChange={(e) => setDealId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
                    disabled={loadingDeals}
                  >
                    <option value="">{loadingDeals ? '読み込み中...' : `SES案件を選択 (${dealOptions.length}件)`}</option>
                    {dealOptions.map((d) => (
                      <option key={d.deal_id} value={d.deal_id}>
                        {d.customer_name} / {d.deal_title}{d.engineer_name ? ` (${d.engineer_name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">SES台帳から検索語にマッチする案件を表示（勤務表の有無は問わず）。</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 md:-mx-6 -mb-4 md:-mb-6 mt-6 px-4 md:px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              const sc = e.currentTarget.closest<HTMLElement>('[data-modal-scroll]');
              sc?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >▲ TOP</button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={parsing || issuing}>キャンセル</Button>
            <Button
              onClick={handleIssue}
              disabled={!parsed || !dealId || !parsed.po_number || issuing}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {issuing ? '発行中…' : '請求書ドラフトを作成'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
