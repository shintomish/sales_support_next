'use client';

import { useEffect, useRef, useState } from 'react';
import apiClient from '@/lib/axios';
import { downloadSignedScanPdf } from '@/lib/signedScan';

type CandidateInvoice = {
  id: number;
  invoice_number: string | null;
  acknowledgement_no: string | null;
  doc_type: 'invoice' | 'purchase_order' | string;
  customer_name_snapshot: string | null;
  subject_name: string | null;
  total: string | number | null;
  issued_date: string | null;
  has_existing_signed_scan: boolean;
};

type ScanResult = {
  tmp_token: string;
  filename: string;
  detected_invoice_number: string | null;
  candidate_invoice: CandidateInvoice | null;
  non_approved_hint: { id: number; approval_status: 'draft' | 'pending' | 'rejected' } | null;
};

const APPROVAL_LABEL_JA: Record<string, string> = {
  draft: '未申請',
  pending: '承認待ち',
  rejected: '却下',
};

type ConfirmResult =
  | { status: 'ok'; invoice_id: number; signed_scan_pdf_path: string; filename: string }
  | { status: 'error'; tmp_token: string; invoice_id: number; message: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  /** 単発置換モード時の固定 Invoice。指定時は候補編集 UI を出さず invoice_id を強制 */
  fixedInvoiceId?: number;
};

const yen = (n: string | number | null) => n == null ? '-' : `¥${Number(n).toLocaleString()}`;

export default function SignedScanUploadModal({ open, onClose, onComplete, fixedInvoiceId }: Props) {
  const [step, setStep] = useState<'select' | 'scanning' | 'confirm' | 'submitting' | 'done'>('select');
  const [files, setFiles] = useState<File[]>([]);
  const [dropOver, setDropOver] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  /** tmp_token → 選択 invoice_id (null = 紐付け無効・送信対象外) */
  const [selections, setSelections] = useState<Record<string, number | null>>({});
  /** OCR 失敗時の手動選択用 invoice 検索ドロップダウン候補 */
  const [searchCache, setSearchCache] = useState<Record<string, CandidateInvoice[]>>({});
  /** 自動候補ありのときに手動選択欄を開いているか (折りたたみ管理) */
  const [searchOpen, setSearchOpen] = useState<Record<string, boolean>>({});
  const [submitResults, setSubmitResults] = useState<ConfirmResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // モーダル開閉時に状態リセット
  useEffect(() => {
    if (open) {
      setStep('select');
      setFiles([]);
      setScanResults([]);
      setSelections({});
      setSubmitResults([]);
      setError(null);
      setSearchOpen({});
      setSearchCache({});
    }
  }, [open]);

  if (!open) return null;

  const maxFiles = fixedInvoiceId ? 1 : 5;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (incoming.length === 0) {
      setError('PDF ファイルのみ選択できます');
      return;
    }
    setError(null);
    setFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, maxFiles);
      if (prev.length + incoming.length > maxFiles) {
        setError(`一度にアップロードできるのは ${maxFiles} ファイルまでです`);
      }
      return merged;
    });
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const startScan = async () => {
    if (files.length === 0) return;
    setError(null);
    setStep('scanning');
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files[]', f));
      const res = await apiClient.post('/api/v1/invoices/signed-scan/scan', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const items: ScanResult[] = res.data?.items ?? [];
      setScanResults(items);

      // デフォルト選択: 候補ありなら採用、無しなら null
      // 固定 mode は強制的に fixedInvoiceId を使う
      const init: Record<string, number | null> = {};
      items.forEach((r) => {
        init[r.tmp_token] = fixedInvoiceId ?? r.candidate_invoice?.id ?? null;
      });
      setSelections(init);
      setStep('confirm');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message
        ?? (e as { message?: string }).message
        ?? 'スキャンに失敗しました';
      setError(msg);
      setStep('select');
    }
  };

  const searchInvoices = async (tmpToken: string, q: string) => {
    if (q.length < 2) return;
    try {
      const res = await apiClient.get('/api/v1/invoices', {
        params: { approval_status: 'approved', q },
      });
      const list: CandidateInvoice[] = (res.data?.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as number,
        invoice_number: (r.invoice_number as string) ?? null,
        acknowledgement_no: (r.acknowledgement_no as string) ?? null,
        doc_type: (r.doc_type as string) ?? '',
        customer_name_snapshot: (r.customer_name_snapshot as string) ?? null,
        subject_name: (r.subject_name as string) ?? null,
        total: (r.total as string) ?? null,
        issued_date: (r.issued_date as string) ?? null,
        has_existing_signed_scan: !!r.signed_scan_pdf_path,
      }));
      setSearchCache((prev) => ({ ...prev, [tmpToken]: list }));
    } catch {
      /* noop */
    }
  };

  const submit = async () => {
    setError(null);
    setStep('submitting');
    const items = scanResults
      .filter((r) => selections[r.tmp_token] != null)
      .map((r) => ({ tmp_token: r.tmp_token, invoice_id: selections[r.tmp_token] as number }));

    if (items.length === 0) {
      setError('紐付け先 Invoice が選択されていません');
      setStep('confirm');
      return;
    }
    try {
      const res = await apiClient.post('/api/v1/invoices/signed-scan/confirm', { items });
      setSubmitResults(res.data?.items ?? []);
      setStep('done');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message
        ?? (e as { message?: string }).message
        ?? '登録に失敗しました';
      setError(msg);
      setStep('confirm');
    }
  };

  const finish = () => {
    onComplete?.();
    onClose();
  };

  // ───────────────────── render
  const successCount = submitResults.filter((r) => r.status === 'ok').length;
  const failCount    = submitResults.length - successCount;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={() => step !== 'submitting' && step !== 'scanning' && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-bold text-gray-800">
            捺印スキャンPDF {fixedInvoiceId ? '再アップロード' : 'アップロード'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'submitting' || step === 'scanning'}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xl leading-none"
          >×</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
              {error}
            </div>
          )}

          {step === 'select' && (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); if (!dropOver) setDropOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); setDropOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDropOver(false); }}
                onDrop={(e) => {
                  e.preventDefault(); setDropOver(false);
                  addFiles(e.dataTransfer?.files ?? null);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded border-2 border-dashed p-8 text-center transition-colors ${
                  dropOver ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <p className="text-sm text-gray-600">
                  PDFファイルをドロップ または クリックして選択
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  最大 {maxFiles} ファイル / 各 20MB まで / 200dpi 以上推奨
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={maxFiles > 1}
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); if (e.target) e.target.value = ''; }}
                />
              </div>

              {files.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded px-3 py-1.5">
                      <span className="truncate">{f.name} <span className="text-xs text-gray-400">({(f.size / 1024 / 1024).toFixed(1)}MB)</span></span>
                      <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700 ml-2">×</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">キャンセル</button>
                <button
                  onClick={startScan}
                  disabled={files.length === 0}
                  className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  OCR で帳票番号を読み取る ({files.length}件)
                </button>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="py-10 text-center text-gray-500">
              <div className="inline-block animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mb-3"></div>
              <p className="text-sm">OCR でスキャン中 ({files.length}件)...</p>
              <p className="text-xs text-gray-400 mt-1">通常 5〜10 秒</p>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                スキャン結果を確認して、紐付け先を確定してください。
                {!fixedInvoiceId && '推定失敗のファイルは下のドロップダウンから手動選択できます。'}
              </p>
              {scanResults.map((r) => {
                const selectedId = selections[r.tmp_token];
                const selectedFromCache = (searchCache[r.tmp_token] ?? []).find((c) => c.id === selectedId);
                const display = r.candidate_invoice && selectedId === r.candidate_invoice.id
                  ? r.candidate_invoice
                  : selectedFromCache ?? null;

                return (
                  <div key={r.tmp_token} className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-mono text-gray-600 truncate">{r.filename}</div>
                      <div className="text-xs text-gray-500">
                        OCR 検出: {r.detected_invoice_number ? (
                          <span className="font-mono text-emerald-700">{r.detected_invoice_number}</span>
                        ) : <span className="text-rose-600">なし</span>}
                      </div>
                    </div>

                    {display ? (
                      <div className="bg-white border border-gray-200 rounded px-3 py-2 mb-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-blue-700">{display.invoice_number ?? display.acknowledgement_no}</span>
                          <span className="text-xs text-gray-500">/ {display.doc_type === 'invoice' ? '請求書' : '注文書'}</span>
                          {display.has_existing_signed_scan && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">既存スキャンを上書き</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-700 mt-0.5 truncate">
                          {display.customer_name_snapshot ?? '-'} / {display.subject_name ?? '-'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          発行日 {display.issued_date ?? '-'} / 金額 {yen(display.total)}
                        </div>
                      </div>
                    ) : r.non_approved_hint ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                        ⚠ OCRで検出した「{r.detected_invoice_number}」は <strong>{APPROVAL_LABEL_JA[r.non_approved_hint.approval_status] ?? r.non_approved_hint.approval_status}</strong> のため候補から除外されています。
                        <a href={`/invoices/${r.non_approved_hint.id}`} target="_blank" rel="noreferrer" className="ml-1 underline">該当帳票を開く</a> → 承認後に再アップロードしてください。
                      </div>
                    ) : (
                      <div className="text-xs text-rose-600 mb-2">
                        {r.detected_invoice_number
                          ? `OCRで検出した「${r.detected_invoice_number}」に該当する承認済み帳票が見つかりません。下の手動選択から指定してください。`
                          : '帳票番号を OCR で検出できませんでした。下の手動選択から指定してください。'}
                      </div>
                    )}

                    {!fixedInvoiceId && (() => {
                      // 自動候補が選択されている (=候補と現在の selection が一致) なら折りたたみ。
                      const autoMatched = !!r.candidate_invoice && selectedId === r.candidate_invoice.id;
                      const isOpen = !autoMatched || searchOpen[r.tmp_token];
                      if (!isOpen) {
                        return (
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setSearchOpen((s) => ({ ...s, [r.tmp_token]: true }))}
                              className="text-xs text-blue-600 hover:underline"
                            >他の帳票に訂正</button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 whitespace-nowrap">手動選択:</label>
                          <input
                            type="text"
                            placeholder="帳票番号 / 顧客名で検索"
                            onChange={(e) => searchInvoices(r.tmp_token, e.target.value.trim())}
                            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                          />
                          {(searchCache[r.tmp_token]?.length ?? 0) > 0 && (
                            <select
                              value={selectedId ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSelections((s) => ({ ...s, [r.tmp_token]: v === '' ? null : Number(v) }));
                              }}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="">- 選択 -</option>
                              {(searchCache[r.tmp_token] ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.invoice_number} {c.customer_name_snapshot}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => setSelections((s) => ({ ...s, [r.tmp_token]: null }))}
                            className="text-xs text-gray-500 hover:text-gray-700"
                            title="紐付け解除"
                          >解除</button>
                          {r.candidate_invoice && (
                            <button
                              onClick={() => {
                                setSelections((s) => ({ ...s, [r.tmp_token]: r.candidate_invoice!.id }));
                                setSearchOpen((s) => ({ ...s, [r.tmp_token]: false }));
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700"
                              title="自動候補に戻す"
                            >戻す</button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStep('select')} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">戻る</button>
                <button
                  onClick={submit}
                  className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700"
                >
                  確定アップロード
                </button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <div className="py-10 text-center text-gray-500">
              <div className="inline-block animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mb-3"></div>
              <p className="text-sm">アップロード中...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <div className="text-sm">
                成功 <span className="font-semibold text-emerald-700">{successCount}</span> 件
                {failCount > 0 && <> / 失敗 <span className="font-semibold text-rose-700">{failCount}</span> 件</>}
              </div>
              <ul className="space-y-1">
                {submitResults.map((r, i) => (
                  <li key={i} className={`text-xs px-3 py-2 rounded border ${
                    r.status === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {r.status === 'ok' ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">✓ Invoice #{r.invoice_id} → {r.filename}</span>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => downloadSignedScanPdf(r.invoice_id)}
                            className="text-emerald-700 hover:underline"
                          >📑 ダウンロード</button>
                          <a
                            href={`/invoices/${r.invoice_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >詳細</a>
                        </div>
                      </div>
                    ) : (
                      <>✗ Invoice #{r.invoice_id} : {r.message}</>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end pt-2">
                <button onClick={finish} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700">閉じる</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
