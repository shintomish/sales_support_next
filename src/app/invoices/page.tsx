'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

interface InvoiceListItem {
  id: number;
  invoice_number: string;
  order_number: string | null;
  year_month: string;
  issued_date: string;
  due_date: string | null;
  status: 'draft' | 'issued';
  total: string;
  customer_name_snapshot: string | null;
  pdf_path: string | null;
  customer?: { id: number; company_name: string } | null;
  deal?: { id: number; title: string } | null;
}

interface PaginatedRes {
  data: InvoiceListItem[];
  meta?: { current_page: number; last_page: number; total: number };
}

const recentMonths = (): string[] => {
  const arr: string[] = [''];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
};

const yen = (n: string | number) => `¥${Number(n).toLocaleString()}`;

type SortField = 'invoice_number' | 'year_month' | 'customer' | 'deal' | 'issued_date' | 'total' | 'status';

export default function InvoicesPage() {
  const [items, setItems]         = useState<InvoiceListItem[]>([]);
  const [yearMonth, setYearMonth] = useState('');
  const [status, setStatus]       = useState<'' | 'draft' | 'issued'>('');
  const [q, setQ]                 = useState('');
  const [loading, setLoading]     = useState(false);
  const [sortBy, setSortBy]       = useState<SortField>('issued_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearMonth) params.set('year_month', yearMonth);
      if (status)    params.set('status', status);
      if (q.trim())  params.set('q', q.trim());
      const res = await apiClient.get<PaginatedRes>(`/api/v1/invoices?${params.toString()}`);
      setItems(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [yearMonth, status, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (field: string) => {
    const f = field as SortField;
    if (sortBy === f) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortOrder('asc'); }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const key = (r: InvoiceListItem): string | number => {
      switch (sortBy) {
        case 'invoice_number': return r.invoice_number;
        case 'year_month':     return r.year_month;
        case 'customer':       return r.customer_name_snapshot ?? r.customer?.company_name ?? '';
        case 'deal':           return r.deal?.title ?? '';
        case 'issued_date':    return r.issued_date ?? '';
        case 'total':          return Number(r.total);
        case 'status':         return r.status;
      }
    };
    arr.sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (ka < kb) return sortOrder === 'asc' ? -1 : 1;
      if (ka > kb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [items, sortBy, sortOrder]);

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-shrink-0 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">請求書一覧</h1>
          <p className="text-xs text-gray-400 mt-1">案件×月の請求書を発行・編集・PDF 出力</p>
        </div>
        <Link href="/billing-summaries">
          <Button variant="outline">← 請求集計から発行</Button>
        </Link>
      </div>

      <div className="flex-shrink-0 flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">対象月</label>
          <select value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
            {recentMonths().map((m) => <option key={m || 'all'} value={m}>{m || '全期間'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">ステータス</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | 'draft' | 'issued')}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">すべて</option>
            <option value="draft">下書き</option>
            <option value="issued">発行済</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">検索</label>
          <Input type="text" placeholder="請求書番号・取引先名" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-sm text-gray-500 self-center">全 {sortedItems.length} 件</span>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          {loading ? '更新中...' : '更新'}
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="table-fixed w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <th className="text-left px-2 py-3 font-semibold w-[170px]">請求書番号</th>
                <th className="text-left px-2 py-3 font-semibold w-[130px]">注文No.</th>
                <th className="text-left px-2 py-3 font-semibold w-[70px]">対象月</th>
                <SortableHeader label="取引先"   field="customer" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[150px]" />
                <SortableHeader label="案件"     field="deal"     sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[170px]" />
                <th className="text-left px-2 py-3 font-semibold w-[90px]">発行日</th>
                <SortableHeader label="税込合計" field="total"    sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[110px]" />
                <th className="text-center px-2 py-3 font-semibold w-[80px]">状態</th>
                <th className="px-2 py-3 text-center font-semibold w-[70px]">PDF</th>
                <th className="px-2 py-3 text-center font-semibold w-[70px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">請求書がありません</td></tr>
              ) : sortedItems.map((r, idx) => (
                <tr key={r.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-2 py-3 font-mono text-xs truncate">{r.invoice_number}</td>
                  <td className="px-2 py-3 font-mono text-xs truncate text-gray-600" title={r.order_number ?? ''}>{r.order_number ?? '-'}</td>
                  <td className="px-2 py-3 truncate">{r.year_month}</td>
                  <td className="px-2 py-3 text-gray-800 truncate" title={r.customer_name_snapshot ?? r.customer?.company_name ?? ''}>{r.customer_name_snapshot ?? r.customer?.company_name ?? '-'}</td>
                  <td className="px-2 py-3 truncate" title={r.deal?.title ?? ''}>{r.deal?.title ?? '-'}</td>
                  <td className="px-2 py-3 text-gray-600">{r.issued_date}</td>
                  <td className="px-2 py-3 text-right tabular-nums font-semibold">{yen(r.total)}</td>
                  <td className="px-2 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.status === 'issued' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {r.status === 'issued' ? '発行済' : '下書き'}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {r.pdf_path
                      ? <a href={r.pdf_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📄 開く</a>
                      : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <Link href={`/invoices/${r.id}`} className="text-xs text-gray-700 hover:underline">詳細</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
