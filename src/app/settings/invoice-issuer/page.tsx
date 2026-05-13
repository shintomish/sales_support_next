'use client';

import { useEffect, useState, useRef } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Toast from '@/components/Toast';

interface IssuerSettings {
  invoice_issuer_name: string | null;
  invoice_issuer_postal_code: string | null;
  invoice_issuer_address: string | null;
  invoice_issuer_tel: string | null;
  invoice_issuer_fax: string | null;
  invoice_issuer_logo_path: string | null;
  invoice_issuer_round_seal_path: string | null;
  invoice_issuer_square_seal_path: string | null;
  invoice_issuer_url: string | null;
  invoice_issuer_invoice_number: string | null;
  invoice_email_subject_template: string | null;
  invoice_email_body_template: string | null;
  estimate_email_subject_template: string | null;
  estimate_email_body_template: string | null;
  purchase_order_email_subject_template: string | null;
  purchase_order_email_body_template: string | null;
  invoice_issuer_bank_name: string | null;
  invoice_issuer_bank_branch: string | null;
  invoice_issuer_bank_account_type: string | null;
  invoice_issuer_bank_account_number: string | null;
  invoice_issuer_bank_account_holder: string | null;
}

const EMPTY: IssuerSettings = {
  invoice_issuer_name: '', invoice_issuer_postal_code: '', invoice_issuer_address: '',
  invoice_issuer_tel: '', invoice_issuer_fax: '', invoice_issuer_logo_path: '',
  invoice_issuer_round_seal_path: '',
  invoice_issuer_square_seal_path: '',
  invoice_issuer_url: '',
  invoice_issuer_invoice_number: '',
  invoice_email_subject_template: '', invoice_email_body_template: '',
  estimate_email_subject_template: '', estimate_email_body_template: '',
  purchase_order_email_subject_template: '', purchase_order_email_body_template: '',
  invoice_issuer_bank_name: '', invoice_issuer_bank_branch: '',
  invoice_issuer_bank_account_type: '', invoice_issuer_bank_account_number: '',
  invoice_issuer_bank_account_holder: '',
};

type DocType = 'invoice' | 'estimate' | 'purchase_order';
const DOC_LABEL: Record<DocType, string> = {
  invoice: '請求書',
  estimate: '見積書',
  purchase_order: '注文書',
};
const SUBJECT_FIELD: Record<DocType, keyof IssuerSettings> = {
  invoice:        'invoice_email_subject_template',
  estimate:       'estimate_email_subject_template',
  purchase_order: 'purchase_order_email_subject_template',
};
const BODY_FIELD: Record<DocType, keyof IssuerSettings> = {
  invoice:        'invoice_email_body_template',
  estimate:       'estimate_email_body_template',
  purchase_order: 'purchase_order_email_body_template',
};

type SealType = 'round' | 'square';
const SEAL_FIELD: Record<SealType, keyof IssuerSettings> = {
  round:  'invoice_issuer_round_seal_path',
  square: 'invoice_issuer_square_seal_path',
};
const SEAL_LABEL: Record<SealType, string> = {
  round:  '丸印（請求書・注文書）',
  square: '角印（見積書）',
};

// テキスト系（保存対象）— ロゴパスは別エンドポイントで管理
const TEXT_KEYS: (keyof IssuerSettings)[] = [
  'invoice_issuer_name', 'invoice_issuer_postal_code', 'invoice_issuer_address',
  'invoice_issuer_tel', 'invoice_issuer_fax', 'invoice_issuer_url',
  'invoice_issuer_invoice_number',
  'invoice_email_subject_template', 'invoice_email_body_template',
  'estimate_email_subject_template', 'estimate_email_body_template',
  'purchase_order_email_subject_template', 'purchase_order_email_body_template',
  'invoice_issuer_bank_name', 'invoice_issuer_bank_branch',
  'invoice_issuer_bank_account_type', 'invoice_issuer_bank_account_number',
  'invoice_issuer_bank_account_holder',
];

export default function InvoiceIssuerSettingsPage() {
  const [form, setForm]       = useState<IssuerSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [toast, setToast]     = useState<string | null>(null);
  const [mailTab, setMailTab] = useState<DocType>('invoice');
  const fileInputRef          = useRef<HTMLInputElement>(null);
  const roundSealInputRef     = useRef<HTMLInputElement>(null);
  const squareSealInputRef    = useRef<HTMLInputElement>(null);

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
      const payload: Partial<IssuerSettings> = {};
      TEXT_KEYS.forEach((k) => { payload[k] = form[k]; });
      await apiClient.put('/api/v1/settings/invoice-issuer', payload);
      setToast('保存しました');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await apiClient.post<{ invoice_issuer_logo_path: string }>(
        '/api/v1/settings/invoice-issuer/logo',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setForm((p) => ({ ...p, invoice_issuer_logo_path: res.data.invoice_issuer_logo_path }));
      setToast('ロゴをアップロードしました');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'アップロードに失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    if (!confirm('ロゴを削除しますか？')) return;
    setBusy(true);
    try {
      await apiClient.delete('/api/v1/settings/invoice-issuer/logo');
      setForm((p) => ({ ...p, invoice_issuer_logo_path: '' }));
      setToast('ロゴを削除しました');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '削除に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const uploadSeal = async (type: SealType, file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('seal', file);
      const field = SEAL_FIELD[type];
      const res = await apiClient.post<Record<string, string>>(
        `/api/v1/settings/invoice-issuer/seal/${type}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setForm((p) => ({ ...p, [field]: res.data[field] }));
      setToast(`${SEAL_LABEL[type]} をアップロードしました`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'アップロードに失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
      const ref = type === 'round' ? roundSealInputRef : squareSealInputRef;
      if (ref.current) ref.current.value = '';
    }
  };

  const removeSeal = async (type: SealType) => {
    if (!confirm(`${SEAL_LABEL[type]} を削除しますか？`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/api/v1/settings/invoice-issuer/seal/${type}`);
      setForm((p) => ({ ...p, [SEAL_FIELD[type]]: '' }));
      setToast(`${SEAL_LABEL[type]} を削除しました`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '削除に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">請求書発行元設定</h1>
      <p className="text-xs text-gray-400 mb-6">請求書 PDF に印字される自社情報。発行時にスナップショットされ、後から編集してもPDF反映済みのものは変わりません。</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <Field label="会社名">
          <Input value={form.invoice_issuer_name ?? ''} onChange={(e) => set('invoice_issuer_name')(e.target.value)} />
        </Field>
        <Field label="郵便番号">
          <Input value={form.invoice_issuer_postal_code ?? ''} onChange={(e) => set('invoice_issuer_postal_code')(e.target.value)} />
        </Field>
        <Field label="住所">
          <Input value={form.invoice_issuer_address ?? ''} onChange={(e) => set('invoice_issuer_address')(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="電話番号">
            <Input value={form.invoice_issuer_tel ?? ''} onChange={(e) => set('invoice_issuer_tel')(e.target.value)} />
          </Field>
          <Field label="FAX番号">
            <Input value={form.invoice_issuer_fax ?? ''} onChange={(e) => set('invoice_issuer_fax')(e.target.value)} />
          </Field>
        </div>
        <Field label="ホームページURL">
          <Input value={form.invoice_issuer_url ?? ''} onChange={(e) => set('invoice_issuer_url')(e.target.value)}
            placeholder="https://www.aizen-sol.co.jp" />
        </Field>
        <Field label="適格請求書発行事業者登録番号 (T+13桁)">
          <Input value={form.invoice_issuer_invoice_number ?? ''} onChange={(e) => set('invoice_issuer_invoice_number')(e.target.value)}
            placeholder="T1234567890123" />
        </Field>

        {/* ロゴ */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">ロゴ画像</h2>
          <p className="text-xs text-gray-400 mb-3">PNG / JPG / GIF / WebP（2MB まで）。請求書PDF右上に表示されます。</p>
          <div className="flex items-center gap-4">
            {form.invoice_issuer_logo_path
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={form.invoice_issuer_logo_path} alt="logo"
                  className="h-16 w-auto max-w-[160px] border border-gray-200 rounded object-contain bg-white p-1" />
              : <div className="h-16 w-40 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">未設定</div>
            }
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
                className="text-xs"
                disabled={busy}
              />
              {form.invoice_issuer_logo_path && (
                <Button variant="outline" onClick={removeLogo} disabled={busy}
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs">
                  ロゴを削除
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 電子印 — 丸印 / 角印 2 種 */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">電子印</h2>
          <p className="text-xs text-gray-400 mb-3">PNG / JPG / GIF / WebP（2MB まで）。透過 PNG 推奨。承認済の帳票 PDF に押印されます。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SealBlock
              type="round"
              imageUrl={form.invoice_issuer_round_seal_path}
              inputRef={roundSealInputRef}
              busy={busy}
              onPick={(f) => uploadSeal('round', f)}
              onRemove={() => removeSeal('round')}
              note="請求書・注文書 PDF に押印"
            />
            <SealBlock
              type="square"
              imageUrl={form.invoice_issuer_square_seal_path}
              inputRef={squareSealInputRef}
              busy={busy}
              onPick={(f) => uploadSeal('square', f)}
              onRemove={() => removeSeal('square')}
              note="見積書 PDF に押印"
            />
          </div>
        </div>

        {/* メール送信テンプレート — doc_type 別 3 セット */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">メール送信テンプレート</h2>
          <p className="text-xs text-gray-400 mb-3">
            帳票をメール送信する時の既定の件名・本文。プレースホルダ: <code className="text-[11px]">{'{invoice_number}'} {'{customer_name}'} {'{year_month_text}'} {'{total}'} {'{due_date}'} {'{issuer_name}'} {'{user_name}'}</code>
          </p>
          <div className="flex gap-1 mb-3 border-b border-gray-100">
            {(['invoice', 'estimate', 'purchase_order'] as DocType[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setMailTab(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t border-b-2 -mb-px ${
                  mailTab === d
                    ? 'border-blue-500 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {DOC_LABEL[d]}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <Field label="件名">
              <Input
                value={form[SUBJECT_FIELD[mailTab]] ?? ''}
                onChange={(e) => set(SUBJECT_FIELD[mailTab])(e.target.value)}
                placeholder="未入力の場合は既定の件名が使われます"
              />
            </Field>
            <Field label="本文">
              <textarea
                value={form[BODY_FIELD[mailTab]] ?? ''}
                onChange={(e) => set(BODY_FIELD[mailTab])(e.target.value)}
                rows={10}
                placeholder="未入力の場合は既定の本文が使われます"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white font-mono"
              />
            </Field>
          </div>
        </div>

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

function SealBlock({
  type, imageUrl, inputRef, busy, onPick, onRemove, note,
}: {
  type: SealType;
  imageUrl: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
  note: string;
}) {
  return (
    <div className="border border-gray-200 rounded-md p-3">
      <div className="text-xs font-semibold text-gray-700 mb-1">{SEAL_LABEL[type]}</div>
      <div className="text-[11px] text-gray-400 mb-2">{note}</div>
      <div className="flex items-center gap-3">
        {imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imageUrl} alt={`${type} seal`}
              className="h-20 w-20 border border-gray-200 rounded object-contain bg-white p-1" />
          : <div className="h-20 w-20 border border-dashed border-gray-300 rounded flex items-center justify-center text-[11px] text-gray-400">未設定</div>
        }
        <div className="flex flex-col gap-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
            className="text-xs max-w-full"
            disabled={busy}
          />
          {imageUrl && (
            <Button variant="outline" onClick={onRemove} disabled={busy}
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs">
              削除
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
