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
  // デフォルトは前月（当月 -1）。請求対象の中心が前月になるため
  const [yearMonth, setYearMonth] = useState<string>(months[1] ?? months[0]);
  const [group,     setGroup]     = useState<GroupType>('deal');
  const [q,         setQ]         = useState<string>('');
  const [items,     setItems]     = useState<(DealRow | CustomerRow)[]>([]);
  const [totals,    setTotals]    = useState<Totals | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [issuingId,  setIssuingId]  = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
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
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      {/* ヘッダ */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">請求集計</h1>
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
            onClick={downloadCsv}
            disabled={loading || sortedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            title={sortedItems.length === 0 ? '該当データがありません' : ''}
          >
            CSVダウンロード
          </Button>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="table-fixed w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                {group === 'deal' ? (
                  <>
                    <SortableHeader label="取引先"       field="customer"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[120px]" />
                    <SortableHeader label="請求書コード" field="invoice_code" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[90px]" />
                    <SortableHeader label="案件"         field="deal"         sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
                    <SortableHeader label="技術者"       field="engineer"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[80px]" />
                  </>
                ) : (
                  <>
                    <SortableHeader label="取引先"       field="customer"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[180px]" />
                    <SortableHeader label="請求書コード" field="invoice_code" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
                    <th className="text-right px-2 py-3 font-semibold w-[70px]">案件数</th>
                  </>
                )}
                <th className="text-right px-2 py-3 font-semibold w-[60px]">実時間</th>
                <th className="text-right px-2 py-3 font-semibold w-[80px]">基本額</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px]">控除</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px]">超過</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px]">交通費</th>
                <th className="text-right px-2 py-3 font-semibold w-[80px]">小計</th>
                <th className="text-right px-2 py-3 font-semibold w-[70px]">消費税</th>
                <SortableHeader label="請求合計" field="total" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[100px]" />
                {group === 'deal' && <th className="text-center px-2 py-3 font-semibold w-[230px]">操作</th>}
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
                            title={!r.invoice_code ? '取引先に請求書コードが未設定です' : '請求書の下書きを作成'}
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
