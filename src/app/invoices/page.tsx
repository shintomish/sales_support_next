'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';
import { useAuthStore } from '@/store/authStore';

type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

interface InvoiceListItem {
  id: number;
  invoice_number: string;
  order_number: string | null;
  year_month: string;
  issued_date: string;
  due_date: string | null;
  status: 'draft' | 'issued';
  approved: boolean;
  approval_status: ApprovalStatus;
  approval_comment: string | null;
  total: string;
  customer_name_snapshot: string | null;
  pdf_path: string | null;
  customer?: { id: number; company_name: string } | null;
  deal?: { id: number; title: string } | null;
}

const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  draft:    '下書き',
  pending:  '承認待ち',
  approved: '承認済',
  rejected: '却下',
};
const APPROVAL_BADGE_CLASS: Record<ApprovalStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-rose-100 text-rose-700',
};

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

/** 当月-1 の YYYY-MM を返す（請求集計画面と同じ既定値） */
const previousMonth = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const yen = (n: string | number) => `¥${Number(n).toLocaleString()}`;

type SortField = 'invoice_number' | 'order_number' | 'year_month' | 'customer' | 'deal' | 'issued_date' | 'total' | 'status' | 'approval';

export default function InvoicesPage() {
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialApproval = (searchParams.get('approval_status') as ApprovalStatus | null) ?? '';

  const [items, setItems]         = useState<InvoiceListItem[]>([]);
  const [yearMonth, setYearMonth] = useState<string>(previousMonth());
  const [status, setStatus]       = useState<'' | 'draft' | 'issued'>('');
  const [approvalStatus, setApprovalStatus] = useState<'' | ApprovalStatus>(initialApproval);
  const [q, setQ]                 = useState('');
  const [loading, setLoading]     = useState(false);
  const [busyId, setBusyId]       = useState<number | null>(null);
  const [sortBy, setSortBy]       = useState<SortField>('issued_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleApprove = async (id: number) => {
    if (!confirm('承認すると PDF を再生成します。よろしいですか？')) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/invoices/${id}/approve`);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '承認に失敗しました';
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async (id: number) => {
    if (!confirm('承認申請しますか？')) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/invoices/${id}/submit-approval`);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '申請に失敗しました';
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: number) => {
    if (!confirm('この請求書を当月扱いで複写して下書きを作成します。よろしいですか？')) return;
    setBusyId(id);
    try {
      const res = await apiClient.post<{ id: number }>(`/api/v1/invoices/${id}/duplicate`);
      router.push(`/invoices/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '複写に失敗しました';
      alert(msg);
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    const comment = prompt('却下理由を入力してください');
    if (!comment) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/invoices/${id}/reject`, { comment });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '却下に失敗しました';
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearMonth)       params.set('year_month', yearMonth);
      if (status)          params.set('status', status);
      if (approvalStatus)  params.set('approval_status', approvalStatus);
      if (q.trim())        params.set('q', q.trim());
      const res = await apiClient.get<PaginatedRes>(`/api/v1/invoices?${params.toString()}`);
      setItems(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [yearMonth, status, approvalStatus, q]);

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
        case 'order_number':   return r.order_number ?? '';
        case 'year_month':     return r.year_month;
        case 'customer':       return r.customer_name_snapshot ?? r.customer?.company_name ?? '';
        case 'deal':           return r.deal?.title ?? '';
        case 'issued_date':    return r.issued_date ?? '';
        case 'total':          return Number(r.total);
        case 'status':         return r.status;
        case 'approval':       return r.approval_status;
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
    <div className="h-full flex flex-col p-6 w-full">
      <div className="flex-shrink-0 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">請求書一覧</h1>
          <p className="text-xs text-gray-400 mt-1">案件×月の請求書を発行・編集・PDF 出力</p>
        </div>
        <Link href="/billing-summaries">
          <Button variant="outline">← 請求書作成から発行</Button>
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
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">承認</label>
          <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value as '' | ApprovalStatus)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">すべて</option>
            <option value="draft">下書き</option>
            <option value="pending">承認待ち</option>
            <option value="approved">承認済</option>
            <option value="rejected">却下</option>
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
        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="table-fixed w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <SortableHeader label="請求番号" field="invoice_number" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[170px]" />
                <SortableHeader label="注文番号" field="order_number"   sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[130px]" />
                <th className="text-left px-2 py-3 font-semibold w-[70px]">対象月</th>
                <SortableHeader label="取引先"   field="customer"       sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[150px]" />
                <SortableHeader label="件名"     field="deal"           sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[170px]" />
                <SortableHeader label="請求日"   field="issued_date"    sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[90px]" />
                <SortableHeader label="税込合計" field="total"          sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[110px]" />
                <SortableHeader label="状態"     field="status"         sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-center w-[80px]" />
                <SortableHeader label="承認"     field="approval"       sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-center w-[100px]" />
                <th className="px-2 py-3 text-center font-semibold w-[70px]">PDF</th>
                <th className="px-2 py-3 text-center font-semibold w-[110px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">請求書がありません</td></tr>
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
                      r.approved ? 'bg-blue-100 text-blue-700'
                        : r.status === 'issued' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {r.approved ? '承認済' : r.status === 'issued' ? '発行済' : '下書き'}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${APPROVAL_BADGE_CLASS[r.approval_status]}`}
                        title={r.approval_status === 'rejected' && r.approval_comment ? `理由: ${r.approval_comment}` : ''}
                      >
                        {APPROVAL_LABEL[r.approval_status]}
                      </span>
                      {/* アクションボタン: 状態に応じて表示 */}
                      {r.approval_status === 'draft' || r.approval_status === 'rejected' ? (
                        <button
                          onClick={() => handleSubmit(r.id)}
                          disabled={busyId === r.id}
                          className="text-[10px] text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {busyId === r.id ? '処理中…' : '申請'}
                        </button>
                      ) : r.approval_status === 'pending' && canApprove ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={busyId === r.id}
                            className="text-[10px] text-blue-600 hover:underline disabled:opacity-50"
                          >承認</button>
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={busyId === r.id}
                            className="text-[10px] text-rose-600 hover:underline disabled:opacity-50"
                          >却下</button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {r.pdf_path
                      ? <a href={r.pdf_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📄 開く</a>
                      : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/invoices/${r.id}`} className="text-xs text-gray-700 hover:underline">詳細</Link>
                      <button
                        onClick={() => handleDuplicate(r.id)}
                        disabled={busyId === r.id}
                        className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                        title="当月扱いで複写して下書き作成"
                      >複写</button>
                    </div>
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
