'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

interface TimesheetRow {
  deal_id: number;
  deal_title: string;
  customer_id: number | null;
  customer_name: string | null;
  engineer_name: string | null;
  category: 'engineer' | 'project';
  timesheet_received_date: string | null;
  actual_hours: string | null;
  absence_days: string | null;
  paid_leave_days: string | null;
  transportation_fee: string | null;
  invoice_exists: boolean | null;
  invoice_received_date: string | null;
  notes: string | null;
}

const yen = (n: string | number | null | undefined) =>
  n == null || n === '' ? '-' : `¥${Number(n).toLocaleString()}`;

const fmtDate = (v: string | null): string => v?.slice(0, 10) ?? '-';

const categoryLabel = (c: 'engineer' | 'project'): '案件' | '技術者' =>
  c === 'engineer' ? '技術者' : '案件';

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

export default function TimesheetsPage() {
  const months = recentMonths();
  const [yearMonth, setYearMonth] = useState<string>(months[0]);
  const [q,         setQ]         = useState<string>('');
  const [items,     setItems]     = useState<TimesheetRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [sortBy,    setSortBy]    = useState<string>('customer');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [includeProjects, setIncludeProjects] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year_month: yearMonth });
      if (q.trim()) params.set('q', q.trim());
      const res = await apiClient.get(`/api/v1/work-records?${params.toString()}`);
      setItems(res.data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [yearMonth, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const filteredItems = useMemo(
    () => includeProjects ? items : items.filter((r) => r.category === 'engineer'),
    [items, includeProjects]
  );

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    const get = (r: TimesheetRow): string | number => {
      switch (sortBy) {
        case 'customer':         return r.customer_name ?? '';
        case 'category':         return r.category;
        case 'deal':             return r.deal_title ?? '';
        case 'engineer':         return r.engineer_name ?? '';
        case 'received':         return r.timesheet_received_date ?? '';
        case 'actual_hours':     return Number(r.actual_hours ?? 0);
        case 'absence_days':     return Number(r.absence_days ?? 0);
        case 'paid_leave_days':  return Number(r.paid_leave_days ?? 0);
        case 'transportation':   return Number(r.transportation_fee ?? 0);
        default:                 return r.customer_name ?? '';
      }
    };
    arr.sort((a, b) => {
      const ka = get(a), kb = get(b);
      if (ka < kb) return sortOrder === 'asc' ? -1 : 1;
      if (ka > kb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredItems, sortBy, sortOrder]);

  const receivedCount   = filteredItems.filter((r) => r.timesheet_received_date).length;
  const unreceivedCount = filteredItems.length - receivedCount;

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      {/* ヘッダ */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">勤務表</h1>
        <p className="text-xs text-gray-400 mt-1">
          月別・案件別の勤務表受領ステータスを一覧表示。各行から勤務表編集ページへ遷移できます
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

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">検索</label>
          <Input
            type="text"
            placeholder="取引先名・案件名・技術者名"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="text-sm text-gray-500 self-center flex gap-3">
          <span>{includeProjects ? '全' : '技術者'} {filteredItems.length} 件</span>
          <span className="text-green-600">受領 {receivedCount}</span>
          <span className="text-orange-600">未受領 {unreceivedCount}</span>
        </div>

        <label className="self-center inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeProjects}
            onChange={(e) => setIncludeProjects(e.target.checked)}
          />
          案件も表示
        </label>

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? '更新中...' : '更新'}
          </Button>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="table-fixed w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <SortableHeader label="取引先"   field="customer" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[140px]" />
                <SortableHeader label="分類"     field="category" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[70px]" />
                <SortableHeader label="案件"     field="deal"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[140px]" />
                <SortableHeader label="技術者"   field="engineer" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
                <SortableHeader label="受領日"   field="received" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
                <SortableHeader label="実労働(h)"   field="actual_hours"    sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[80px]" />
                <SortableHeader label="欠勤(日)"   field="absence_days"    sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[70px]" />
                <SortableHeader label="有給(日)"   field="paid_leave_days" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[70px]" />
                <SortableHeader label="交通費"     field="transportation"  sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[90px]" />
                <th className="text-center px-2 py-3 font-semibold w-[80px]">請求書</th>
                <th className="text-center px-2 py-3 font-semibold w-[80px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">該当データなし</td></tr>
              ) : (
                sortedItems.map((r, idx) => {
                  const cat = categoryLabel(r.category);
                  return (
                  <tr key={r.deal_id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-2 py-3 text-gray-800 truncate" title={r.customer_name ?? ''}>{r.customer_name ?? '-'}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        cat === '技術者' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>{cat}</span>
                    </td>
                    <td className="px-2 py-3 truncate" title={r.deal_title ?? ''}>{r.deal_title}</td>
                    <td className="px-2 py-3 text-gray-600 truncate" title={r.engineer_name ?? ''}>{r.engineer_name ?? '-'}</td>
                    <td className={`px-2 py-3 ${r.timesheet_received_date ? 'text-green-700' : 'text-orange-600'}`}>
                      {r.timesheet_received_date ? fmtDate(r.timesheet_received_date) : '未受領'}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.actual_hours ?? '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.absence_days ?? '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.paid_leave_days ?? '-'}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{r.transportation_fee ? yen(r.transportation_fee) : '-'}</td>
                    <td className="px-2 py-3 text-center">
                      {r.invoice_exists ? (r.invoice_received_date ? '✓ 受領' : '⏳ 待ち') : '-'}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <Link
                        href={`/ses-contracts/${r.deal_id}/timesheets`}
                        title="勤務表を編集"
                        className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-100"
                      >✏️ 編集</Link>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
