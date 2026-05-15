'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SortableHeader from '@/components/SortableHeader';

interface EstimateListItem {
  id: number;
  invoice_number: string;
  year_month: string;
  issued_date: string;
  valid_until_text: string | null;
  subject_name: string | null;
  status: 'draft' | 'issued';
  total: string;
  customer_name_snapshot: string | null;
  pdf_path: string | null;
  customer?: { id: number; company_name: string } | null;
  deal?: { id: number; title: string } | null;
}

interface CustomerLookup {
  id: number;
  company_name: string;
  invoice_code: string | null;
}

interface PaginatedRes {
  data: EstimateListItem[];
  meta?: { current_page: number; last_page: number; total: number };
}

const yen = (n: string | number) => `¥${Number(n).toLocaleString()}`;

const recentMonths = (): string[] => {
  const arr: string[] = [''];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
};

const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

type SortField = 'invoice_number' | 'customer' | 'subject' | 'year_month' | 'issued_date' | 'total' | 'status';

export default function EstimatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCreate   = searchParams.get('create') === '1';

  const [items, setItems]               = useState<EstimateListItem[]>([]);
  const [busyId, setBusyId]             = useState<number | null>(null);
  const [yearMonth, setYearMonth]       = useState<string>(currentMonth());
  const [status, setStatus]             = useState<'' | 'draft' | 'issued'>('');
  const [q, setQ]                       = useState('');
  const [loading, setLoading]           = useState(false);
  const [sortBy, setSortBy]             = useState<SortField>('issued_date');
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>('desc');

  // 新規見積モーダル（?create=1 で自動オープン）
  // モード: 通常 = SES台帳の契約終了≥当月から案件選択 / 例外 = 売上先のみ指定
  type EstimateMode = 'normal' | 'exception';
  type SesDealOption = {
    id: number; customer_name: string | null; engineer_name: string | null;
    project_name: string | null; contract_period_end: string | null;
  };
  const [createOpen, setCreateOpen]     = useState(initialCreate);
  const [createMode, setCreateMode]     = useState<EstimateMode>('normal');
  const [isEnglish, setIsEnglish]       = useState(false);     // 英文見積モード（normal時のみ意味あり）
  const [titleTranslating, setTitleTranslating] = useState(false);
  const [creating, setCreating]         = useState(false);
  const [customers, setCustomers]       = useState<CustomerLookup[]>([]);
  const [custSearch, setCustSearch]     = useState('');
  const [custLoading, setCustLoading]   = useState(false);
  const [sesDeals, setSesDeals]         = useState<SesDealOption[]>([]);
  const [sesLoading, setSesLoading]     = useState(false);
  const [sesSearch, setSesSearch]       = useState('');
  const [form, setForm] = useState({
    deal_id:          '' as string | number,
    customer_id:      '' as string | number,
    subject_name:     '',
    valid_until_text: '30日間',
    issued_date:      new Date().toISOString().slice(0, 10),
    notes:            '',
  });

  // 月初 YYYY-MM-DD（SES台帳 contract_period_end フィルタ用）
  const currentMonthStart = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('doc_type', 'estimate');
      if (yearMonth)      params.set('year_month', yearMonth);
      if (status)         params.set('status', status);
      if (q.trim())       params.set('q', q.trim());
      const res = await apiClient.get<PaginatedRes>(`/api/v1/invoices?${params.toString()}`);
      setItems(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [yearMonth, status, q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 例外モード: 顧客リストをロード
  useEffect(() => {
    if (!createOpen || createMode !== 'exception') return;
    let cancelled = false;
    setCustLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: CustomerLookup[] }>('/api/v1/customers', {
          params: { search: custSearch || undefined, page: 1, per_page: 500, type: 'customer' },
        });
        if (!cancelled) {
          const list = res.data.data ?? [];
          const sortKey = (n: string) => n
            .replace(/^(株式会社|有限会社|合同会社|一般社団法人|公益財団法人)\s*/u, '')
            .replace(/\s*(株式会社|有限会社|合同会社|一般社団法人|公益財団法人)\s*$/u, '');
          list.sort((a, b) => sortKey(a.company_name).localeCompare(sortKey(b.company_name), 'ja'));
          setCustomers(list);
        }
      } finally {
        if (!cancelled) setCustLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [createOpen, createMode, custSearch]);

  // 通常モード: SES台帳 案件リストをロード（契約終了≥当月）
  useEffect(() => {
    if (!createOpen || createMode !== 'normal') return;
    let cancelled = false;
    setSesLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: SesDealOption[] }>('/api/v1/ses-contracts', {
          params: {
            search: sesSearch || undefined,
            // 英文モードは契約終了済みも対象に含める（過去案件の英文見積発行があるため）
            ...(isEnglish ? {} : { contract_period_end_from: currentMonthStart() }),
            per_page: 200,
            sort_by: 'customer_name',
            sort_order: 'asc',
            user_id: 'all', // 発行モーダルは事務全員のデータを対象
            ...(isEnglish ? { quotation_language: 1 } : {}),
          },
        });
        if (!cancelled) {
          const list = (res.data.data ?? []) as SesDealOption[];
          // 第1ソート: 契約終了 昇順 (null は末尾)
          // 第2ソート: 取引先名 五十音 (株式会社等の法人格は除いた読み)
          const sortKey = (n: string | null) => (n ?? '')
            .replace(/^(株式会社|有限会社|合同会社|一般社団法人|公益財団法人)\s*/u, '')
            .replace(/\s*(株式会社|有限会社|合同会社|一般社団法人|公益財団法人)\s*$/u, '');
          list.sort((a, b) => {
            const ea = a.contract_period_end ?? '9999-99-99';
            const eb = b.contract_period_end ?? '9999-99-99';
            if (ea !== eb) return ea < eb ? -1 : 1;
            return sortKey(a.customer_name).localeCompare(sortKey(b.customer_name), 'ja');
          });
          setSesDeals(list);
        }
      } finally {
        if (!cancelled) setSesLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [createOpen, createMode, sesSearch, isEnglish]);


  const handleCreate = async () => {
    if (createMode === 'normal' && !form.deal_id) { alert('SES台帳から案件を選択してください'); return; }
    if (createMode === 'exception' && !form.customer_id) { alert('取引先を選択してください'); return; }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        subject_name:     form.subject_name || null,
        valid_until_text: form.valid_until_text || null,
        issued_date:      form.issued_date || null,
        notes:            form.notes || null,
        language:         (isEnglish && createMode === 'normal') ? 'en' : 'ja',
      };
      if (createMode === 'normal') payload.deal_id = Number(form.deal_id);
      else payload.customer_id = Number(form.customer_id);

      const res = await apiClient.post('/api/v1/estimates', payload);
      setCreateOpen(false);
      setForm({ deal_id: '', customer_id: '', subject_name: '', valid_until_text: '30日間', issued_date: new Date().toISOString().slice(0, 10), notes: '' });
      setCustSearch(''); setSesSearch('');
      window.location.href = `/estimates/${res.data.id}`;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = e?.response?.data?.message
        ?? Object.values(e?.response?.data?.errors ?? {})[0]?.[0]
        ?? '見積書の作成に失敗しました';
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

  const handleDuplicate = async (id: number) => {
    if (!confirm('この見積書を当月扱いで複写して下書きを作成します。よろしいですか？')) return;
    setBusyId(id);
    try {
      const res = await apiClient.post<{ id: number }>(`/api/v1/invoices/${id}/duplicate`);
      router.push(`/estimates/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '複写に失敗しました';
      alert(msg);
      setBusyId(null);
    }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const key = (r: EstimateListItem): string | number => {
      switch (sortBy) {
        case 'invoice_number': return r.invoice_number;
        case 'customer':       return r.customer_name_snapshot ?? r.customer?.company_name ?? '';
        case 'subject':        return r.subject_name ?? '';
        case 'year_month':     return r.year_month;
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
    <div className="h-full flex flex-col p-6 w-full">
      <div className="flex-shrink-0 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">見積書一覧</h1>
          <p className="text-xs text-gray-400 mt-1">顧客向けの見積書を発行・編集・PDF 出力</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 新規見積発行</Button>
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
          <Input type="text" placeholder="見積番号・取引先名" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-sm text-gray-500 self-center">全 {sortedItems.length} 件</span>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          {loading ? '更新中...' : '更新'}
        </Button>
      </div>

      {/* mobile: カード一覧 (< md) */}
      <div className="md:hidden bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400">読み込み中...</div>
        ) : sortedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400">見積書がありません</div>
        ) : sortedItems.map((r) => (
          <div key={r.id} className="px-3 py-3 hover:bg-blue-50">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/estimates/${r.id}`} className="font-mono text-xs text-blue-700 hover:underline truncate">
                {r.invoice_number}
              </Link>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                r.status === 'issued' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {r.status === 'issued' ? '発行済' : '下書き'}
              </span>
            </div>
            <div className="mt-1 text-sm text-gray-800 truncate" title={r.customer_name_snapshot ?? r.customer?.company_name ?? ''}>
              {r.customer_name_snapshot ?? r.customer?.company_name ?? '-'}
            </div>
            <div className="text-xs text-gray-500 truncate" title={r.subject_name ?? ''}>
              {r.subject_name ?? '-'}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-500">{r.year_month} / 見積日 {r.issued_date}</span>
              <span className="font-semibold tabular-nums text-gray-900">{yen(r.total)}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              {r.pdf_path && (
                <a href={r.pdf_path} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">📄 PDF</a>
              )}
              <Link href={`/estimates/${r.id}`} className="text-xs text-gray-700 hover:underline">詳細</Link>
              <button
                onClick={() => handleDuplicate(r.id)}
                disabled={busyId === r.id}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >複写</button>
            </div>
          </div>
        ))}
      </div>

      {/* PC: テーブル (md+) */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="table-fixed w-full min-w-[1000px] text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <SortableHeader label="見積番号"   field="invoice_number" sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[200px]" />
                <th className="text-left px-2 py-3 font-semibold w-[80px]">対象月</th>
                <SortableHeader label="取引先"     field="customer"       sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[180px]" />
                <SortableHeader label="件名"       field="subject"        sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3" />
                <SortableHeader label="見積日"     field="issued_date"    sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 w-[100px]" />
                <SortableHeader label="税込合計"   field="total"          sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-right w-[110px]" />
                <SortableHeader label="状態"       field="status"         sortField={sortBy} sortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-center w-[80px]" />
                <th className="px-2 py-3 text-center font-semibold w-[70px]">PDF</th>
                <th className="px-2 py-3 text-center font-semibold w-[110px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : sortedItems.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">見積書がありません</td></tr>
              ) : sortedItems.map((r, idx) => (
                <tr key={r.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-2 py-3 font-mono text-xs truncate">{r.invoice_number}</td>
                  <td className="px-2 py-3 text-gray-600 truncate">{r.year_month}</td>
                  <td className="px-2 py-3 text-gray-800 truncate" title={r.customer_name_snapshot ?? r.customer?.company_name ?? ''}>{r.customer_name_snapshot ?? r.customer?.company_name ?? '-'}</td>
                  <td className="px-2 py-3 truncate" title={r.subject_name ?? ''}>{r.subject_name ?? '-'}</td>
                  <td className="px-2 py-3 text-gray-600">{r.issued_date}</td>
                  <td className="px-2 py-3 text-right tabular-nums font-semibold">{yen(r.total)}</td>
                  <td className="px-2 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.status === 'issued' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
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
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/estimates/${r.id}`} className="text-xs text-gray-700 hover:underline">詳細</Link>
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

      {/* 新規見積発行モーダル */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCreateOpen(false)}>
          <div data-modal-scroll className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">新規見積発行</h2>

            {/* モード切替 */}
            <div className="flex flex-wrap gap-2 md:gap-4 text-sm mb-3 border-b border-gray-200 pb-2 items-center">
              <label className="flex items-center gap-2">
                <input type="radio" name="estimate-mode" checked={createMode === 'normal'}
                  onChange={() => { setCreateMode('normal'); }} />
                <span><strong>通常</strong>（SES台帳の案件から発行）</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="estimate-mode" checked={createMode === 'exception'}
                  onChange={() => { setCreateMode('exception'); setIsEnglish(false); }} />
                <span><strong>例外</strong>（売上先のみ指定・新規見積）</span>
              </label>
              {createMode === 'normal' && (
                <label className="flex items-center gap-2 md:ml-auto">
                  <input type="checkbox" checked={isEnglish}
                    onChange={(e) => {
                      setIsEnglish(e.target.checked);
                      // 切替時、案件選択を一旦クリアして候補を絞り直す
                      setForm(p => ({ ...p, deal_id: '', subject_name: '' }));
                    }} />
                  <span><strong>英文</strong></span>
                </label>
              )}
            </div>

            <div className="space-y-3">
              {createMode === 'normal' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">SES台帳の案件 <span className="text-rose-600">*</span></label>
                  <p className="text-[10px] text-gray-500 mb-1">契約終了が当月以降の案件を表示・取引先名（株式会社除く）で五十音ソート</p>
                  <Input type="text" placeholder="顧客名・技術者名・案件名で検索…"
                    value={sesSearch} onChange={(e) => setSesSearch(e.target.value)} className="mb-2" />
                  <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto overflow-x-hidden bg-white">
                    <table className="w-full text-xs table-fixed">
                      <thead className="bg-gray-50 sticky top-0 text-gray-600">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-semibold w-[30%]">取引先</th>
                          <th className="text-left px-2 py-1.5 font-semibold w-[18%]">技術者</th>
                          <th className="text-left px-2 py-1.5 font-semibold w-[34%]">案件名</th>
                          <th className="text-left px-2 py-1.5 font-semibold w-[18%]">契約終了</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sesLoading && (
                          <tr><td colSpan={4} className="text-center py-4 text-gray-400">読み込み中…</td></tr>
                        )}
                        {!sesLoading && sesDeals.length === 0 && (
                          <tr><td colSpan={4} className="text-center py-4 text-gray-400">該当する案件がありません（契約終了≥当月）</td></tr>
                        )}
                        {sesDeals.map((d) => (
                          <tr key={d.id}
                              onClick={async () => {
                                const newSubject = d.project_name ?? form.subject_name;
                                // 一旦は和文タイトルをセット（英文ON時は直後に英訳で上書き）
                                setForm(p => ({
                                  ...p,
                                  deal_id: String(d.id),
                                  subject_name: newSubject,
                                }));
                                if (isEnglish && newSubject) {
                                  setTitleTranslating(true);
                                  try {
                                    const r = await apiClient.post<{ en_title: string }>(
                                      '/api/v1/estimates/translate-title',
                                      { ja_title: newSubject }
                                    );
                                    const en = r.data.en_title ?? '';
                                    if (en) setForm(p => ({ ...p, subject_name: en }));
                                  } catch { /* 翻訳失敗時は和文のまま */ } finally {
                                    setTitleTranslating(false);
                                  }
                                }
                              }}
                              className={`cursor-pointer hover:bg-blue-50 border-t border-gray-100 ${
                                String(form.deal_id) === String(d.id) ? 'bg-blue-100' : ''
                              }`}>
                            <td className="px-2 py-1 truncate" title={d.customer_name ?? ''}>{d.customer_name ?? '—'}</td>
                            <td className="px-2 py-1 truncate" title={d.engineer_name ?? ''}>{d.engineer_name ?? '—'}</td>
                            <td className="px-2 py-1 truncate" title={d.project_name ?? ''}>{d.project_name ?? '—'}</td>
                            <td className="px-2 py-1 text-gray-500 truncate">{d.contract_period_end?.slice(0, 10) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {createMode === 'exception' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">取引先（売上先）<span className="text-rose-600">*</span></label>
                  <Input type="text" placeholder="会社名で検索…"
                    value={custSearch} onChange={(e) => setCustSearch(e.target.value)} className="mb-2" />
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
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  件名{isEnglish && <span className="text-emerald-600 font-normal ml-2">（英文）</span>}
                  {titleTranslating && <span className="text-gray-400 font-normal ml-2">翻訳中…</span>}
                </label>
                <Input type="text"
                  placeholder={
                    isEnglish ? '案件選択で自動英訳されます（手修正可）'
                    : createMode === 'normal' ? '空欄なら案件タイトルが入ります'
                    : '例: システム開発業務委託'
                  }
                  value={form.subject_name}
                  onChange={(e) => setForm({ ...form, subject_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">発行日</label>
                  <Input type="date" value={form.issued_date}
                    onChange={(e) => setForm({ ...form, issued_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">有効期間</label>
                  <Input type="text" placeholder="30日間" value={form.valid_until_text}
                    onChange={(e) => setForm({ ...form, valid_until_text: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">備考</label>
                <textarea value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
              </div>
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
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>キャンセル</Button>
                <Button onClick={handleCreate}
                  disabled={creating || (createMode === 'normal' ? !form.deal_id : !form.customer_id)}>
                  {creating ? '作成中…' : '作成'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
