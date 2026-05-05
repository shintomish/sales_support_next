'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Toast from '@/components/Toast';

interface InvoiceLine {
  id?: number;
  description: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  tax_rate: string;
  amount?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  order_number: string | null;
  quote_number: string | null;
  subject_name: string | null;
  work_period_text: string | null;
  work_location: string | null;
  delivery_date_text: string | null;
  delivery_place_text: string | null;
  payment_terms_text: string | null;
  year_month: string;
  issued_date: string;
  due_date: string | null;
  status: 'draft' | 'issued';
  notes: string | null;
  subtotal: string;
  tax: string;
  total: string;
  pdf_path: string | null;
  customer_name_snapshot: string | null;
  engineer_name_snapshot: string | null;
  customer?: { id: number; company_name: string };
  deal?: { id: number; title: string };
  lines: InvoiceLine[];
}

const TAX_OPTIONS = [
  { value: '0.10', label: '10%' },
  { value: '0.08', label: '8%' },
  { value: '0',    label: '非課税' },
];

const yen = (n: string | number | null | undefined) =>
  n == null ? '-' : `¥${Number(n).toLocaleString()}`;

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [toast,   setToast]   = useState<string | null>(null);

  const [issuedDate, setIssuedDate] = useState('');
  const [dueDate,    setDueDate]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [orderNumber,       setOrderNumber]       = useState('');
  const [quoteNumber,       setQuoteNumber]       = useState('');
  const [subjectName,       setSubjectName]       = useState('');
  const [workPeriodText,    setWorkPeriodText]    = useState('');
  const [workLocation,      setWorkLocation]      = useState('');
  const [deliveryDateText,  setDeliveryDateText]  = useState('');
  const [deliveryPlaceText, setDeliveryPlaceText] = useState('');
  const [paymentTermsText,  setPaymentTermsText]  = useState('');
  const [lines,      setLines]      = useState<InvoiceLine[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Invoice>(`/api/v1/invoices/${id}`);
      setInvoice(res.data);
      setIssuedDate(res.data.issued_date ?? '');
      setDueDate(res.data.due_date ?? '');
      setNotes(res.data.notes ?? '');
      setOrderNumber(res.data.order_number ?? '');
      setQuoteNumber(res.data.quote_number ?? '');
      setSubjectName(res.data.subject_name ?? '');
      setWorkPeriodText(res.data.work_period_text ?? '');
      setWorkLocation(res.data.work_location ?? '');
      setDeliveryDateText(res.data.delivery_date_text ?? '');
      setDeliveryPlaceText(res.data.delivery_place_text ?? '');
      setPaymentTermsText(res.data.payment_terms_text ?? '');
      setLines(res.data.lines.map((l) => ({
        description: l.description,
        quantity:    String(l.quantity),
        unit:        l.unit,
        unit_price:  String(l.unit_price),
        tax_rate:    String(Number(l.tax_rate)),
      })));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateLine = (i: number, field: keyof InvoiceLine, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };
  const addLine = () => setLines((prev) => [...prev, {
    description: '', quantity: '1', unit: '式', unit_price: '0', tax_rate: '0.10',
  }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const calcPreview = () => {
    const byRate: Record<string, number> = {};
    lines.forEach((l) => {
      const rate = String(Number(l.tax_rate));
      const sub  = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
      byRate[rate] = (byRate[rate] ?? 0) + sub;
    });
    let subtotal = 0, tax = 0;
    Object.entries(byRate).forEach(([rate, sub]) => {
      subtotal += sub;
      tax      += Math.round(sub * Number(rate));
    });
    return { subtotal, tax, total: subtotal + tax };
  };
  const preview = calcPreview();

  // (O) 支払条件 = (G) 支払期限文言から「現金」を除いたもの
  const paymentCondition = paymentTermsText.replace('現金', '');

  const save = async (newStatus?: 'draft' | 'issued') => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        issued_date:         issuedDate || null,
        due_date:            dueDate || null,
        notes:               notes || null,
        order_number:        orderNumber || null,
        quote_number:        quoteNumber || null,
        subject_name:        subjectName || null,
        work_period_text:    workPeriodText || null,
        work_location:       workLocation || null,
        delivery_date_text:  deliveryDateText || null,
        delivery_place_text: deliveryPlaceText || null,
        payment_terms_text:  paymentTermsText || null,
        lines: lines.map((l) => ({
          description: l.description,
          quantity:    Number(l.quantity) || 0,
          unit:        l.unit || null,
          unit_price:  Number(l.unit_price) || 0,
          tax_rate:    Number(l.tax_rate),
        })),
      };
      if (newStatus) payload.status = newStatus;
      const res = await apiClient.put<Invoice>(`/api/v1/invoices/${id}`, payload);
      setInvoice(res.data);
      setToast(`${res.data.invoice_number}を保存しました`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const generatePdf = async () => {
    if (!confirm('PDFを生成し、ステータスを「発行済」に変更します。よろしいですか？')) return;
    setBusy(true);
    try {
      const res = await apiClient.post<{ pdf_url: string; invoice: Invoice }>(`/api/v1/invoices/${id}/pdf`);
      setInvoice(res.data.invoice);
      window.open(res.data.pdf_url, '_blank');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'PDF生成に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const label = invoice?.status === 'issued' ? '発行済' : '下書き';
    if (!confirm(`この請求書（${label}）を削除します。\n誤発行のリカバリ用です。よろしいですか？`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/api/v1/invoices/${id}`);
      router.push('/invoices');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '削除に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !invoice) {
    return <div className="p-6 text-gray-400">読み込み中...</div>;
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="flex-shrink-0 mb-4">
        <Link href="/invoices" className="text-sm text-blue-600 hover:underline">← 請求書一覧に戻る</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-gray-800 font-mono">{invoice.invoice_number}</h1>
          <div className="flex items-center gap-2">
            {invoice.status === 'issued'
              ? <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">発行済</span>
              : <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">下書き</span>}
            {invoice.pdf_path && (
              <a href={invoice.pdf_path} target="_blank" rel="noreferrer"
                 className="text-blue-600 hover:underline text-sm">📄 PDF を開く</a>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          🏢 {invoice.customer_name_snapshot} / {invoice.deal?.title} / 対象 {invoice.year_month}
          {invoice.engineer_name_snapshot && ` / 👤 ${invoice.engineer_name_snapshot}`}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* メタ情報 */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="発行日">
            <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
          </Field>
          <Field label="支払期限">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>

        {/* 番号類 */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="注文No.">
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="PO-..." />
          </Field>
          <Field label="見積No.">
            <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
          </Field>
        </div>

        {/* 左側ヘッダー (E)(F)(G) */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="納期">
            <Input value={deliveryDateText} onChange={(e) => setDeliveryDateText(e.target.value)} placeholder="御社ご指定日" />
          </Field>
          <Field label="納入場所">
            <Input value={deliveryPlaceText} onChange={(e) => setDeliveryPlaceText(e.target.value)} placeholder="御社ご指定場所" />
          </Field>
          <Field label="支払期限文言">
            <Input value={paymentTermsText} onChange={(e) => setPaymentTermsText(e.target.value)}
              placeholder="月末締め翌々月20日現金お支払" />
          </Field>
        </div>

        {/* 明細部メタ (K)(L)(N)(O) */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="件名">
            <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
          </Field>
          <Field label="作業期間">
            <Input value={workPeriodText} onChange={(e) => setWorkPeriodText(e.target.value)}
              placeholder="2026年4月1日～2026年4月30日" />
          </Field>
          <Field label="作業場所">
            <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
          </Field>
          <Field label="支払条件 (PDF表示用・自動派生)">
            <Input value={paymentCondition} disabled className="bg-gray-50 text-gray-500" />
          </Field>
        </div>

        {/* 明細 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">明細（金額計上行）</h2>
            <Button variant="outline" onClick={addLine} disabled={busy}>+ 行追加</Button>
          </div>
          <p className="text-xs text-gray-400 mb-2">基本月額の摘要は「{`{金額}`}円 【基本月額】」形式で生成されます。</p>
          <div className="overflow-auto">
            <table className="w-full text-sm border border-gray-200">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-2 py-2 font-semibold w-2/5">摘要</th>
                  <th className="text-right px-2 py-2 font-semibold w-20">数量</th>
                  <th className="text-left px-2 py-2 font-semibold w-16">単位</th>
                  <th className="text-right px-2 py-2 font-semibold w-32">単価</th>
                  <th className="text-center px-2 py-2 font-semibold w-24">税率</th>
                  <th className="text-right px-2 py-2 font-semibold w-32">金額</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => {
                  const amount = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                  return (
                    <tr key={i}>
                      <td className="px-2 py-1">
                        <Input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" step="0.01" className="text-right" value={l.quantity}
                          onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={l.unit ?? ''} onChange={(e) => updateLine(i, 'unit', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" className="text-right" value={l.unit_price}
                          onChange={(e) => updateLine(i, 'unit_price', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <select value={l.tax_rate} onChange={(e) => updateLine(i, 'tax_rate', e.target.value)}
                          className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm bg-white">
                          {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{yen(amount)}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => removeLine(i)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs">×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-right text-gray-600">小計</td>
                  <td className="px-2 py-2 text-right tabular-nums">{yen(preview.subtotal)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-right text-gray-600">消費税</td>
                  <td className="px-2 py-2 text-right tabular-nums">{yen(preview.tax)}</td>
                  <td></td>
                </tr>
                <tr className="font-semibold">
                  <td colSpan={5} className="px-2 py-2 text-right">合計</td>
                  <td className="px-2 py-2 text-right tabular-nums text-blue-700">{yen(preview.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 備考 */}
        <Field label="備考（PDF下段に追記表示）">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white" />
        </Field>

        {/* アクション */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => save()} disabled={busy}>
            {busy ? '保存中...' : '保存'}
          </Button>
          <Button onClick={generatePdf} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
            📄 PDF 生成
          </Button>
          <Button variant="outline" onClick={remove} disabled={busy}
            className="text-red-600 border-red-200 hover:bg-red-50 ml-auto">
            削除
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
