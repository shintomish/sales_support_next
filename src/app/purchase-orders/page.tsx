'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';
import { useAuthStore } from '@/store/authStore';

type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

interface PurchaseOrderListItem {
  id: number;
  invoice_number: string;
  acknowledgement_no: string | null;
  year_month: string;
  issued_date: string;
  subject_name: string | null;
  status: 'draft' | 'issued';
  approved: boolean;
  approval_status: ApprovalStatus;
  approval_comment: string | null;
  total: string;
  customer_name_snapshot: string | null;
  pdf_path: string | null;
  acknowledgement_pdf_path: string | null;
  customer?: { id: number; company_name: string } | null;
  deal?: { id: number; title: string } | null;
}

interface CustomerLookup {
  id: number;
  company_name: string;
  invoice_code: string | null;
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
  data: PurchaseOrderListItem[];
  meta?: { current_page: number; last_page: number; total: number };
}

const yen = (n: string | number) => `¥${Number(n).toLocaleString()}`;

type SortField = 'invoice_number' | 'customer' | 'issued_date' | 'total' | 'status';

export default function PurchaseOrdersPage() {
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const searchParams = useSearchParams();
  const initialApproval = (searchParams.get('approval_status') as ApprovalStatus | null) ?? '';
  const initialCreate   = searchParams.get('create') === '1';

  const [items, setItems]               = useState<PurchaseOrderListItem[]>([]);
  const [status, setStatus]             = useState<'' | 'draft' | 'issued'>('');
  const [approvalStatus, setApprovalStatus] = useState<'' | ApprovalStatus>(initialApproval);
  const [q, setQ]                       = useState('');
  const [loading, setLoading]           = useState(false);
  const [busyId, setBusyId]             = useState<number | null>(null);
  const [sortBy, setSortBy]             = useState<SortField>('issued_date');
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('desc');

  // 新規注文書モーダル（?create=1 で自動オープン）
  const [createOpen, setCreateOpen]     = useState(initialCreate);
  const [creating, setCreating]         = useState(false);
  const [customers, setCustomers]       = useState<CustomerLookup[]>([]);
  const [custSearch, setCustSearch]     = useState('');
  const [custLoading, setCustLoading]   = useState(false);
  const [form, setForm] = useState({
    customer_id:  '' as string | number,
    subject_name: '',
    issued_date:  new Date().toISOString().slice(0, 10),
    notes:        '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('doc_type', 'purchase_order');
      if (status)         params.set('status', status);
      if (approvalStatus) params.set('approval_status', approvalStatus);
      if (q.trim())       params.set('q', q.trim());
      const res = await apiClient.get<PaginatedRes>(`/api/v1/invoices?${params.toString()}`);
      setItems(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, approvalStatus, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // モーダルを開いたら顧客リストをロード（検索変更時も）
  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setCustLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: CustomerLookup[] }>('/api/v1/customers', {
          params: { search: custSearch || undefined, page: 1 },
        });
        if (!cancelled) setCustomers(res.data.data ?? []);
      } finally {
        if (!cancelled) setCustLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [createOpen, custSearch]);

  const handleSubmit = async (id: number) => {
    if (!confirm('承認申請しますか？')) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/invoices/${id}/submit-approval`);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '申請に失敗しました';
      alert(msg);
    } finally { setBusyId(null); }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('承認すると電子印付き PDF を再生成します。よろしいですか？')) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/invoices/${id}/approve`);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '承認に失敗しました';
      alert(msg);
    } finally { setBusyId(null); }
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
    } finally { setBusyId(null); }
  };

  const handleCreate = async () => {
    if (!form.customer_id) { alert('顧客を選択してください'); return; }
    setCreating(true);
    try {
      const res = await apiClient.post('/api/v1/purchase-orders', {
        customer_id:  Number(form.customer_id),
        subject_name: form.subject_name || null,
        issued_date:  form.issued_date || null,
        notes:        form.notes || null,
      });
      setCreateOpen(false);
      setForm({ customer_id: '', subject_name: '', issued_date: new Date().toISOString().slice(0, 10), notes: '' });
      setCustSearch('');
      // 作成した注文書の編集ページへ遷移（請求書詳細を流用）
      window.location.href = `/invoices/${res.data.id}`;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = e?.response?.data?.message
        ?? Object.values(e?.response?.data?.errors ?? {})[0]?.[0]
        ?? '注文書の作成に失敗しました';
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleSort = (field: string) => {
    const f = field as SortField;
    if (sortBy === f) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortOrder('asc'); }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const key = (r: PurchaseOrderListItem): string | number => {
      switch (sortBy) {
        case 'invoice_number': return r.invoice_number;
        case 'customer':       return r.customer_name_snapshot ?? r.customer?.company_name ?? '';
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
          <h1 className="text-2xl font-bold text-gray-800">注文書一覧</h1>
          <p className="text-xs text-gray-400 mt-1">取引先向けの注文書を発行・編集・PDF 出力（注文請書も同時生成）</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 新規注文発行</Button>
      </div>

      <div className="flex-shrink-0 flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg border border-gray-200">
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
          <Input type="text" placeholder="注文番号・取引先名" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <SortableHeader label="注文番号"   field="invoice_number" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[200px]" />
                <th className="text-left px-2 py-3 font-semibold w-[200px]">請書番号</th>
                <SortableHeader label="取引先"     field="customer"       sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[180px]" />
                <th className="text-left px-2 py-3 font-semibold">件名</th>
                <SortableHeader label="発行日"     field="issued_date"    sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
                <SortableHeader label="税込合計"   field="total"          sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[110px]" />
                <th className="text-center px-2 py-3 font-semibold w-[80px]">状態</th>
                <th className="text-center px-2 py-3 font-semibold w-[100px]">承認</th>
                <th className="px-2 py-3 text-center font-semibold w-[100px]">PDF</th>
                <th className="px-2 py-3 text-center font-semibold w-[70px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">注文書がありません</td></tr>
              ) : sortedItems.map((r, idx) => (
                <tr key={r.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-2 py-3 font-mono text-xs truncate">{r.invoice_number}</td>
                  <td className="px-2 py-3 font-mono text-xs text-gray-600 truncate">{r.acknowledgement_no ?? '-'}</td>
                  <td className="px-2 py-3 text-gray-800 truncate" title={r.customer_name_snapshot ?? r.customer?.company_name ?? ''}>{r.customer_name_snapshot ?? r.customer?.company_name ?? '-'}</td>
                  <td className="px-2 py-3 truncate" title={r.subject_name ?? ''}>{r.subject_name ?? '-'}</td>
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
                    <div className="flex flex-col gap-1 items-center">
                      {r.pdf_path
                        ? <a href={r.pdf_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📄 注文書</a>
                        : <span className="text-gray-300 text-xs">注文書: -</span>}
                      {r.acknowledgement_pdf_path
                        ? <a href={r.acknowledgement_pdf_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📄 請書</a>
                        : <span className="text-gray-300 text-xs">請書: -</span>}
                    </div>
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

      {/* 新規注文書発行モーダル */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCreateOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">新規注文発行</h2>
            <p className="text-xs text-gray-500 mb-4">注文書発行時に注文請書(OCF番号)も同時に採番されます。PDFは注文書の発行ボタンを押すと両方生成されます。</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">取引先 <span className="text-rose-600">*</span></label>
                <Input
                  type="text"
                  placeholder="会社名で検索…"
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                  className="mb-2"
                />
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
                  size={6}
                >
                  {custLoading && <option disabled>読み込み中…</option>}
                  {!custLoading && customers.length === 0 && <option disabled>該当なし</option>}
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}{c.invoice_code ? ` [${c.invoice_code}]` : ' （※顧客コード未設定）'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">件名</label>
                <Input
                  type="text"
                  placeholder="例: 環境整備対応"
                  value={form.subject_name}
                  onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">発行日</label>
                <Input
                  type="date"
                  value={form.issued_date}
                  onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={creating || !form.customer_id}>
                {creating ? '作成中…' : '作成'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
