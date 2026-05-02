'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const months = recentMonths();
  const [yearMonth, setYearMonth] = useState<string>(months[0]);
  const [group,     setGroup]     = useState<GroupType>('deal');
  const [q,         setQ]         = useState<string>('');
  const [items,     setItems]     = useState<(DealRow | CustomerRow)[]>([]);
  const [totals,    setTotals]    = useState<Totals | null>(null);
  const [loading,   setLoading]   = useState(false);

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

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? '更新中...' : '更新'}
          </Button>
          <Button
            onClick={downloadCsv}
            disabled={loading || items.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            title={items.length === 0 ? '該当データがありません' : ''}
          >
            CSVダウンロード
          </Button>
        </div>
      </div>

      {/* テーブル */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                {group === 'deal' ? (
                  <>
                    <th className="text-left px-3 py-3 font-semibold">取引先</th>
                    <th className="text-left px-3 py-3 font-semibold">請求書コード</th>
                    <th className="text-left px-3 py-3 font-semibold">案件</th>
                    <th className="text-left px-3 py-3 font-semibold">技術者</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-3 py-3 font-semibold">取引先</th>
                    <th className="text-left px-3 py-3 font-semibold">請求書コード</th>
                    <th className="text-right px-3 py-3 font-semibold">案件数</th>
                  </>
                )}
                <th className="text-right px-3 py-3 font-semibold">実時間</th>
                <th className="text-right px-3 py-3 font-semibold">基本額</th>
                <th className="text-right px-3 py-3 font-semibold">控除</th>
                <th className="text-right px-3 py-3 font-semibold">超過</th>
                <th className="text-right px-3 py-3 font-semibold">交通費</th>
                <th className="text-right px-3 py-3 font-semibold">小計</th>
                <th className="text-right px-3 py-3 font-semibold">消費税</th>
                <th className="text-right px-3 py-3 font-semibold">請求合計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">該当データなし</td></tr>
              ) : group === 'deal' ? (
                (items as DealRow[]).map((r) => (
                  <tr key={r.deal_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{r.customer_name ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.invoice_code ?? '-'}</td>
                    <td className="px-3 py-2">{r.deal_title}</td>
                    <td className="px-3 py-2 text-gray-600">{r.engineer_name ?? '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.actual_hours ?? '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.basic)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.deduction ? `-${yen(r.deduction).slice(1)}` : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.overtime ? yen(r.overtime) : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.transportation ? yen(r.transportation) : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.subtotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.tax)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{yen(r.total)}</td>
                  </tr>
                ))
              ) : (
                (items as CustomerRow[]).map((r) => (
                  <tr key={r.customer_id ?? 0} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{r.customer_name ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.invoice_code ?? '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.deal_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.actual_hours}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.basic)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.deduction ? `-${yen(r.deduction).slice(1)}` : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.overtime ? yen(r.overtime) : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.transportation ? yen(r.transportation) : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.subtotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{yen(r.tax)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{yen(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {totals && items.length > 0 && (
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
