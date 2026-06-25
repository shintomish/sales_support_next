'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

type DocType = 'invoice' | 'estimate' | 'purchase_order';

interface ChannelState {
  id: number;
  status: 'sent' | 'failed';
  error_message: string | null;
  to_emails: string[] | null;
  to_names: string[] | null;
  subject: string | null;
  attachments_meta: (string | { name: string; url: string })[] | null;
  sent_at: string | null;
  sent_by_name: string | null;
}

interface Row {
  invoice_id: number;
  invoice_number: string | null;
  invoice_year_month: string | null;
  invoice_total: string | null;
  invoice_subject_name: string | null;
  customer_name: string | null;
  last_sent_at: string | null;
  mail: ChannelState | null;
  partner: ChannelState | null;
  post: ChannelState | null;
}

interface PaginatedRes {
  data: Row[];
  current_page: number;
  last_page: number;
  total: number;
}

const recentMonths = (): string[] => {
  const arr: string[] = [''];
  const now = new Date();
  for (let i = -1; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
};
const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const yen = (n: string | number | null | undefined) => n == null ? '-' : `¥${Number(n).toLocaleString()}`;
const fmtDate = (s: string | null) => (s ? s.replace('T', ' ').slice(0, 10) : '');

type SortField = 'invoice_number' | 'customer_name' | 'invoice_subject_name' | 'last_sent_at';

/** 送信履歴一覧（1見積1行・①メール送信 ②partner送信 ③郵送記録 の状態を集約表示） */
export default function SendHistoryList({ docType, title, basePath }: {
  docType: DocType;
  title: string;
  basePath: string; // 詳細リンクのパス。例: '/estimates'
}) {
  const [items, setItems]   = useState<Row[]>([]);
  const [total, setTotal]   = useState(0);
  const [yearMonth, setYearMonth] = useState<string>(currentMonth());
  const [q, setQ]           = useState('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy]   = useState<SortField>('last_sent_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    const f = field as SortField;
    if (sortBy === f) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortOrder('asc'); }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const key = (r: Row): string => {
      switch (sortBy) {
        case 'invoice_number':       return r.invoice_number ?? '';
        case 'customer_name':        return r.customer_name ?? '';
        case 'invoice_subject_name': return r.invoice_subject_name ?? '';
        case 'last_sent_at':         return r.last_sent_at ?? '';
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
      params.set('doc_type', docType);
      if (yearMonth) params.set('year_month', yearMonth);
      if (q.trim())  params.set('q', q.trim());
      const res = await apiClient.get<PaginatedRes>(`/api/v1/invoice-send-histories?${params}`);
      setItems(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } finally { setLoading(false); }
  }, [docType, yearMonth, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ①②③ 各チャネルの状態セル
  const channelLabel = (ch: ChannelState | null): { text: string; cls: string; title: string } => {
    if (!ch) return { text: '未', cls: 'text-gray-300', title: '未実施' };
    if (ch.status === 'failed') return { text: `⚠ ${fmtDate(ch.sent_at)}`, cls: 'text-red-600', title: ch.error_message ?? '失敗' };
    const to = (ch.to_names && ch.to_names.length ? ch.to_names : ch.to_emails ?? []).join(', ');
    return { text: `✓ ${fmtDate(ch.sent_at)}`, cls: 'text-emerald-700', title: to ? `宛先: ${to}` : '済' };
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="text-xs text-gray-400 mt-1">1件につき ①メール送信 ②partner送信 ③郵送記録 の状態をまとめて表示</p>
      </div>

      <div className="flex-shrink-0 flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">対象月</label>
          <select value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
            {recentMonths().map((m) => <option key={m || 'all'} value={m}>{m || '全期間'}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">検索</label>
          <Input type="text" placeholder="番号・取引先・件名" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-sm text-gray-500 self-center">全 {total} 件</span>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          {loading ? '更新中...' : '更新'}
        </Button>
      </div>

      {/* mobile: カード */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400">読み込み中...</div>
        ) : sortedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400">送信履歴はありません</div>
        ) : sortedItems.map((r) => (
          <div key={r.invoice_id} className="px-3 py-3 hover:bg-blue-50">
            <div className="flex items-center justify-between gap-2">
              <Link href={`${basePath}/${r.invoice_id}`} className="font-mono text-xs text-blue-700 hover:underline truncate">
                {r.invoice_number}
              </Link>
              <span className="font-semibold tabular-nums text-gray-900 text-sm">{yen(r.invoice_total)}</span>
            </div>
            <div className="mt-1 text-sm text-gray-800 truncate">{r.customer_name ?? '-'}</div>
            <div className="text-xs text-gray-500 truncate">{r.invoice_subject_name ?? '-'}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              {([['①メール', r.mail], ['②partner', r.partner], ['③郵送', r.post]] as const).map(([lbl, ch]) => {
                const s = channelLabel(ch);
                return <span key={lbl} className={s.cls} title={s.title}>{lbl}: {s.text}</span>;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* PC: テーブル */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="w-full min-w-[1000px] text-sm table-fixed">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <SortableHeader label="番号" field="invoice_number" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[150px]" />
                <th className="text-left px-2 py-3 font-semibold w-[70px]">対象月</th>
                <SortableHeader label="取引先" field="customer_name" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[150px]" />
                <SortableHeader label="案件名" field="invoice_subject_name" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3" />
                <th className="text-right px-2 py-3 font-semibold w-[100px]">金額</th>
                <th className="text-center px-2 py-3 font-semibold w-[110px]">①メール送信</th>
                <th className="text-center px-2 py-3 font-semibold w-[110px]">②partner送信</th>
                <th className="text-center px-2 py-3 font-semibold w-[110px]">③郵送記録</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">送信履歴はありません</td></tr>
              ) : sortedItems.map((r) => (
                <tr key={r.invoice_id} className="hover:bg-blue-50">
                  <td className="px-2 py-2 font-mono text-xs truncate" title={r.invoice_number ?? ''}>
                    <Link href={`${basePath}/${r.invoice_id}`} className="text-blue-600 hover:underline">{r.invoice_number}</Link>
                  </td>
                  <td className="px-2 py-2 text-gray-600 truncate">{r.invoice_year_month ?? '-'}</td>
                  <td className="px-2 py-2 text-gray-800 truncate" title={r.customer_name ?? ''}>{r.customer_name ?? '-'}</td>
                  <td className="px-2 py-2 truncate" title={r.invoice_subject_name ?? ''}>{r.invoice_subject_name ?? '-'}</td>
                  <td className="px-2 py-2 text-right tabular-nums truncate">{yen(r.invoice_total)}</td>
                  {([r.mail, r.partner, r.post] as const).map((ch, i) => {
                    const s = channelLabel(ch);
                    return <td key={i} className={`px-2 py-2 text-center text-xs ${s.cls}`} title={s.title}>{s.text}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
