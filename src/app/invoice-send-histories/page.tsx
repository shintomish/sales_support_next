'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

interface HistoryRow {
  id: number;
  method: 'mail' | 'post';
  to_emails: string[] | null;
  to_names: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  attachments_meta: string[] | null;
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
  sent_by_name: string | null;
  invoice_id: number;
  invoice_number: string | null;
  invoice_year_month: string | null;
  invoice_total: string | null;
  invoice_subject_name: string | null;
  customer_name: string | null;
}

interface PaginatedRes {
  data: HistoryRow[];
  current_page: number;
  last_page: number;
  total: number;
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

/** 当月-1 の YYYY-MM を返す */
const previousMonth = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

type SortField = 'invoice_number' | 'customer_name' | 'invoice_subject_name' | 'to' | 'sent_at' | 'sent_by';

const yen = (n: string | number | null | undefined) => n == null ? '-' : `¥${Number(n).toLocaleString()}`;
/** yyyy-mm-dd hh:mm */
const fmtDateTime = (s: string | null) => {
  if (!s) return '-';
  return s.replace('T', ' ').slice(0, 16);
};

export default function InvoiceSendHistoriesPage() {
  const [items,   setItems]   = useState<HistoryRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [yearMonth, setYearMonth] = useState<string>(previousMonth());
  const [status,  setStatus]  = useState<'' | 'sent' | 'failed'>('');
  const [method,  setMethod]  = useState<'' | 'mail' | 'post'>('');
  const [q,       setQ]       = useState('');
  const [loading, setLoading] = useState(false);
  const [sortBy,  setSortBy]  = useState<SortField>('sent_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    const f = field as SortField;
    if (sortBy === f) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortOrder('asc'); }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const key = (r: HistoryRow): string => {
      switch (sortBy) {
        case 'invoice_number': return r.invoice_number ?? '';
        case 'customer_name':  return r.customer_name ?? '';
        case 'invoice_subject_name': return r.invoice_subject_name ?? '';
        case 'to':             return (r.to_names ?? r.to_emails ?? []).join(', ');
        case 'sent_at':        return r.sent_at ?? '';
        case 'sent_by':        return r.sent_by_name ?? '';
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearMonth) params.set('year_month', yearMonth);
      if (status)    params.set('status', status);
      if (method)    params.set('method', method);
      if (q.trim())  params.set('q', q.trim());
      const res = await apiClient.get<PaginatedRes>(`/api/v1/invoice-send-histories?${params}`);
      setItems(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } finally { setLoading(false); }
  }, [yearMonth, status, method, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">請求書送信履歴</h1>
        <p className="text-xs text-gray-400 mt-1">メール / 郵送 の送信ログ</p>
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
          <label className="block text-xs font-semibold text-gray-700 mb-1">手段</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as '' | 'mail' | 'post')}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">すべて</option>
            <option value="mail">メール</option>
            <option value="post">郵送</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">状態</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | 'sent' | 'failed')}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">すべて</option>
            <option value="sent">送信済</option>
            <option value="failed">失敗</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">検索</label>
          <Input type="text" placeholder="請求書番号・取引先・件名" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-sm text-gray-500 self-center">全 {total} 件</span>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          {loading ? '更新中...' : '更新'}
        </Button>
      </div>

      {/* mobile: カード一覧 (< md) */}
      <div className="md:hidden bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400">読み込み中...</div>
        ) : sortedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400">送信履歴はありません</div>
        ) : sortedItems.map((r) => (
          <div key={r.id} className="px-3 py-3 hover:bg-blue-50">
            <div className="flex items-center justify-between gap-2">
              {r.invoice_id ? (
                <Link href={`/invoices/${r.invoice_id}`} className="font-mono text-xs text-blue-700 hover:underline truncate">
                  {r.invoice_number}
                </Link>
              ) : (
                <span className="font-mono text-xs text-gray-400">-</span>
              )}
              <div className="flex gap-1 flex-shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.method === 'mail' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.method === 'mail' ? '📧' : '📮'}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.status === 'sent' ? (r.method === 'post' ? '発送済' : '送信済') : '失敗'}
                </span>
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-800 truncate" title={r.customer_name ?? ''}>
              {r.customer_name ?? '-'}
            </div>
            <div className="text-xs text-gray-500 truncate" title={r.invoice_subject_name ?? ''}>
              {r.invoice_subject_name ?? '-'}
            </div>
            <div className="text-xs text-gray-500 truncate" title={r.to_emails?.join(', ')}>
              TO: {r.to_names && r.to_names.length > 0 ? r.to_names.join(', ') : (r.to_emails?.join(', ') ?? '-')}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {r.invoice_year_month ?? '-'} / {fmtDateTime(r.method === 'post' ? r.created_at : r.sent_at)}
              </span>
              <span className="font-semibold tabular-nums text-gray-900">{yen(r.invoice_total)}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500 flex gap-3">
              <span>送信者: {r.sent_by_name ?? '-'}</span>
              {r.attachments_meta && r.attachments_meta.length > 0 && (
                <span>📎 {r.attachments_meta.length}件</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* PC: テーブル (md+) */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="w-full min-w-[1000px] text-sm table-fixed">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <SortableHeader label="請求書番号" field="invoice_number" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[150px]" />
                <th className="text-left   px-2 py-3 font-semibold w-[70px]">対象月</th>
                <SortableHeader label="取引先" field="customer_name" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[150px]" />
                <SortableHeader label="案件名" field="invoice_subject_name" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3" />
                <SortableHeader label="TO"     field="to"            sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[120px]" />
                <th className="text-right  px-2 py-3 font-semibold w-[100px]">金額</th>
                <th className="text-center px-2 py-3 font-semibold w-[80px]">手段</th>
                <th className="text-center px-2 py-3 font-semibold w-[70px]">状態</th>
                <th className="text-left   px-2 py-3 font-semibold w-[80px]">添付</th>
                <SortableHeader label="送信/発送日" field="sent_at" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[140px]" />
                <SortableHeader label="送信者"   field="sent_by" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">送信履歴はありません</td></tr>
              ) : sortedItems.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50">
                  <td className="px-2 py-2 font-mono text-xs truncate" title={r.invoice_number ?? ''}>
                    {r.invoice_id ? (
                      <Link href={`/invoices/${r.invoice_id}`} className="text-blue-600 hover:underline">
                        {r.invoice_number}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-600 truncate">{r.invoice_year_month ?? '-'}</td>
                  <td className="px-2 py-2 text-gray-800 truncate" title={r.customer_name ?? ''}>
                    {r.customer_name ?? '-'}
                  </td>
                  <td className="px-2 py-2 truncate" title={r.invoice_subject_name ?? ''}>
                    {r.invoice_subject_name ?? '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-xs truncate" title={r.to_emails?.join(', ')}>
                    {r.to_names && r.to_names.length > 0 ? r.to_names.join(', ') : (r.to_emails?.join(', ') ?? '-')}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums truncate">{yen(r.invoice_total)}</td>
                  <td className="px-2 py-2 text-center">
                    <span title={r.method === 'mail' ? 'メール' : '郵送'}
                      className={`px-1.5 py-0.5 rounded text-xs cursor-help ${
                      r.method === 'mail' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.method === 'mail' ? '📧 メール' : '📮 郵送'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      r.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {r.status === 'sent' ? (r.method === 'post' ? '発送済' : '送信済') : '失敗'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500 truncate" title={r.attachments_meta?.join(' / ')}>
                    {r.attachments_meta && r.attachments_meta.length > 0
                      ? `📎 ${r.attachments_meta.length}件`
                      : '-'}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-xs truncate">
                    {fmtDateTime(r.method === 'post' ? r.created_at : r.sent_at)}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-xs truncate">{r.sent_by_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
