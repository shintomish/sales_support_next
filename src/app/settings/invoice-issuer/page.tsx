'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface IssuerSettings {
  invoice_issuer_name: string | null;
  invoice_issuer_postal_code: string | null;
  invoice_issuer_address: string | null;
  invoice_issuer_tel: string | null;
  invoice_issuer_invoice_number: string | null;
  invoice_issuer_bank_name: string | null;
  invoice_issuer_bank_branch: string | null;
  invoice_issuer_bank_account_type: string | null;
  invoice_issuer_bank_account_number: string | null;
  invoice_issuer_bank_account_holder: string | null;
}

const EMPTY: IssuerSettings = {
  invoice_issuer_name: '', invoice_issuer_postal_code: '', invoice_issuer_address: '',
  invoice_issuer_tel: '', invoice_issuer_invoice_number: '',
  invoice_issuer_bank_name: '', invoice_issuer_bank_branch: '',
  invoice_issuer_bank_account_type: '', invoice_issuer_bank_account_number: '',
  invoice_issuer_bank_account_holder: '',
};

export default function InvoiceIssuerSettingsPage() {
  const [form, setForm]       = useState<IssuerSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    apiClient.get<IssuerSettings>('/api/v1/settings/invoice-issuer')
      .then((res) => {
        const merged: IssuerSettings = { ...EMPTY };
        (Object.keys(EMPTY) as (keyof IssuerSettings)[]).forEach((k) => {
          merged[k] = res.data[k] ?? '';
        });
        setForm(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof IssuerSettings) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      await apiClient.put('/api/v1/settings/invoice-issuer', form);
      alert('保存しました');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">請求書発行元設定</h1>
      <p className="text-xs text-gray-400 mb-6">請求書 PDF に印字される自社情報。発行時にスナップショットされ、後から編集してもPDF反映済みのものは変わりません。</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <Field label="会社名">
          <Input value={form.invoice_issuer_name ?? ''} onChange={(e) => set('invoice_issuer_name')(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="郵便番号">
            <Input value={form.invoice_issuer_postal_code ?? ''} onChange={(e) => set('invoice_issuer_postal_code')(e.target.value)} />
          </Field>
          <Field label="電話番号" className="col-span-2">
            <Input value={form.invoice_issuer_tel ?? ''} onChange={(e) => set('invoice_issuer_tel')(e.target.value)} />
          </Field>
        </div>
        <Field label="住所">
          <Input value={form.invoice_issuer_address ?? ''} onChange={(e) => set('invoice_issuer_address')(e.target.value)} />
        </Field>
        <Field label="適格請求書発行事業者登録番号 (T+13桁)">
          <Input value={form.invoice_issuer_invoice_number ?? ''} onChange={(e) => set('invoice_issuer_invoice_number')(e.target.value)}
            placeholder="T1234567890123" />
        </Field>

        <div className="border-t border-gray-100 pt-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">振込先</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="銀行名">
              <Input value={form.invoice_issuer_bank_name ?? ''} onChange={(e) => set('invoice_issuer_bank_name')(e.target.value)} />
            </Field>
            <Field label="支店名">
              <Input value={form.invoice_issuer_bank_branch ?? ''} onChange={(e) => set('invoice_issuer_bank_branch')(e.target.value)} />
            </Field>
            <Field label="口座種別">
              <select value={form.invoice_issuer_bank_account_type ?? ''} onChange={(e) => set('invoice_issuer_bank_account_type')(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">選択</option>
                <option value="普通">普通</option>
                <option value="当座">当座</option>
              </select>
            </Field>
            <Field label="口座番号">
              <Input value={form.invoice_issuer_bank_account_number ?? ''} onChange={(e) => set('invoice_issuer_bank_account_number')(e.target.value)} />
            </Field>
            <Field label="口座名義" className="col-span-2">
              <Input value={form.invoice_issuer_bank_account_holder ?? ''} onChange={(e) => set('invoice_issuer_bank_account_holder')(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <Button onClick={submit} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
