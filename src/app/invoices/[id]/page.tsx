'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Toast from '@/components/Toast';
import SignedScanUploadModal from '@/components/SignedScanUploadModal';
import { buildSignedScanFilename, downloadSignedScanPdf } from '@/lib/signedScan';
import { useAuthStore } from '@/store/authStore';

interface InvoiceLine {
  id?: number;
  description: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  tax_rate: string;
  amount?: string;
  is_expense?: boolean;
}

interface MailCandidate { name: string; email: string }
interface MailTemplate {
  subject: string;
  body: string;
  candidates: MailCandidate[];
  delivery_method: 'mail' | 'post' | 'both' | null;
}
interface SendHistoryRow {
  id: number;
  method: 'mail' | 'post';
  to_emails: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  attachments_meta: string[] | null;
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  sent_by_name: string | null;
}

interface Invoice {
  id: number;
  doc_type: 'invoice' | 'estimate' | 'purchase_order';
  language: 'ja' | 'en' | null;
  invoice_number: string;
  acknowledgement_no: string | null;
  acknowledgement_pdf_path: string | null;
  order_number: string | null;
  quote_number: string | null;
  subject_name: string | null;
  work_period_text: string | null;
  work_location: string | null;
  delivery_items_text: string | null;
  transportation_note_text: string | null;
  delivery_date_text: string | null;
  delivery_place_text: string | null;
  payment_terms_text: string | null;
  year_month: string;
  issued_date: string;
  due_date: string | null;
  status: 'draft' | 'issued';
  approved: boolean;
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected';
  approval_comment: string | null;
  notes: string | null;
  subtotal: string;
  tax: string;
  total: string;
  pdf_path: string | null;
  signed_scan_pdf_path: string | null;
  signed_scan_uploaded_at: string | null;
  customer_name_snapshot: string | null;
  engineer_name_snapshot: string | null;
  customer?: { id: number; company_name: string };
  deal?: { id: number; title: string };
  // 見積の起点となった受信メール（見積依頼）。記録一元化の表示用。
  source_email?: {
    id: number; subject: string | null; from_address: string | null;
    from_name: string | null; received_at: string | null; category: string | null;
  } | null;
  lines: InvoiceLine[];
}

const TAX_OPTIONS = [
  { value: '0.10', label: '10%' },
  { value: '0.08', label: '8%' },
  { value: '0',    label: '非課税' },
];

const APPROVAL_LABEL: Record<Invoice['approval_status'], string> = {
  draft:    '未申請',
  pending:  '承認待ち',
  approved: '承認済',
  rejected: '差戻し',
};

const APPROVAL_BADGE_CLASS: Record<Invoice['approval_status'], string> = {
  draft:    'bg-gray-100 text-gray-600',
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const yen = (n: string | number | null | undefined) =>
  n == null ? '-' : `¥${Number(n).toLocaleString()}`;

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === 'tenant_admin' || user?.role === 'super_admin';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [toast,   setToast]   = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [signedScanOpen, setSignedScanOpen] = useState(false);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(message);
  };

  const [issuedDate, setIssuedDate] = useState('');
  const [dueDate,    setDueDate]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [orderNumber,            setOrderNumber]            = useState('');
  const [quoteNumber,            setQuoteNumber]            = useState('');
  const [subjectName,            setSubjectName]            = useState('');
  const [workPeriodText,         setWorkPeriodText]         = useState('');
  const [workLocation,           setWorkLocation]           = useState('');
  const [engineerNameSnapshot,   setEngineerNameSnapshot]   = useState('');
  const [deliveryItemsText,      setDeliveryItemsText]      = useState('');
  const [transportationNoteText, setTransportationNoteText] = useState('');
  const [deliveryDateText,       setDeliveryDateText]       = useState('');
  const [deliveryPlaceText,      setDeliveryPlaceText]      = useState('');
  const [paymentTermsText,       setPaymentTermsText]       = useState('');
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
      setEngineerNameSnapshot(res.data.engineer_name_snapshot ?? '');
      setDeliveryItemsText(res.data.delivery_items_text ?? '');
      setTransportationNoteText(res.data.transportation_note_text ?? '');
      setDeliveryDateText(res.data.delivery_date_text ?? '');
      setDeliveryPlaceText(res.data.delivery_place_text ?? '');
      setPaymentTermsText(res.data.payment_terms_text ?? '');
      setLines(res.data.lines.map((l) => ({
        description: l.description,
        quantity:    String(l.quantity),
        unit:        l.unit,
        unit_price:  String(l.unit_price),
        tax_rate:    String(Number(l.tax_rate)),
        is_expense:  !!l.is_expense,
      })));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateLine = (i: number, field: keyof InvoiceLine, value: string | boolean) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value } as InvoiceLine;
      return next;
    });
  };
  const addLine = () => setLines((prev) => [...prev, {
    description: '', quantity: '1', unit: '式', unit_price: '0', tax_rate: '0.10', is_expense: false,
  }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const calcPreview = () => {
    const byRate: Record<string, number> = {};
    let expense = 0;
    lines.forEach((l) => {
      const sub = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
      if (l.is_expense) { expense += sub; return; }
      const rate = String(Number(l.tax_rate));
      byRate[rate] = (byRate[rate] ?? 0) + sub;
    });
    let subtotal = 0, tax = 0;
    Object.entries(byRate).forEach(([rate, sub]) => {
      subtotal += sub;
      tax      += Math.round(sub * Number(rate));
    });
    return { subtotal, tax, expense, total: subtotal + tax + expense };
  };
  const preview = calcPreview();

  // (O) 支払条件 = (G) 支払期限文言から「現金」を除いたもの
  const paymentCondition = paymentTermsText.replace('現金', '');

  // 英文 (Refinitiv) PDF テンプレートは納期/納入場所/支払期限文言/作業期間/作業場所/作業担当者/
  // 納品物/業務交通費 説明/支払条件/備考 を出力しない (Out-INV-RFJ-202605-001.pdf で検証済)。
  // 編集画面ではこれらを「グレーアウト＋注記」で示し、ユーザーの編集自体は妨げない。
  const isEnglish = invoice?.language === 'en';
  const enNote = '英文 PDF には出力されません';

  const buildPayload = (newStatus?: 'draft' | 'issued'): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      issued_date:              issuedDate || null,
      due_date:                 dueDate || null,
      notes:                    notes || null,
      order_number:             orderNumber || null,
      quote_number:             quoteNumber || null,
      subject_name:             subjectName || null,
      work_period_text:         workPeriodText || null,
      work_location:            workLocation || null,
      engineer_name_snapshot:   engineerNameSnapshot || null,
      delivery_items_text:      deliveryItemsText || null,
      transportation_note_text: transportationNoteText || null,
      delivery_date_text:       deliveryDateText || null,
      delivery_place_text:      deliveryPlaceText || null,
      payment_terms_text:       paymentTermsText || null,
      lines: lines.map((l) => ({
        description: l.description,
        quantity:    Number(l.quantity) || 0,
        unit:        l.unit || null,
        unit_price:  Number(l.unit_price) || 0,
        tax_rate:    Number(l.tax_rate),
        is_expense:  !!l.is_expense,
      })),
    };
    if (newStatus) payload.status = newStatus;
    return payload;
  };

  const save = async (newStatus?: 'draft' | 'issued') => {
    setBusy(true);
    try {
      const res = await apiClient.put<Invoice>(`/api/v1/invoices/${id}`, buildPayload(newStatus));
      setInvoice(res.data);
      showToast(`${res.data.invoice_number}を保存しました`, 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  // PDF 生成中の段階メッセージ。null = 非表示、文字列 = オーバーレイ表示
  const [pdfBusyMsg, setPdfBusyMsg] = useState<string | null>(null);
  // PDF 生成完了後、ブラウザのポップアップブロックで自動オープンできなかった場合に
  // ユーザーが手動で開ける URL リスト
  const [pdfReadyUrls, setPdfReadyUrls] = useState<{ label: string; url: string }[]>([]);

  const tryOpenUrl = (url: string): boolean => {
    const w = window.open(url, '_blank');
    return !!w && !w.closed;
  };

  const generatePdf = async () => {
    if (!confirm('編集中の内容を保存してPDFを生成し、ステータスを「発行済」に変更します。よろしいですか？')) return;
    setBusy(true);
    setPdfReadyUrls([]);
    setPdfBusyMsg('編集内容を保存中…');
    try {
      await apiClient.put<Invoice>(`/api/v1/invoices/${id}`, buildPayload());
      setPdfBusyMsg('PDF を生成中… (最大10秒程度かかります)');
      const res = await apiClient.post<{ pdf_url: string; acknowledgement_pdf_url?: string; invoice: Invoice }>(`/api/v1/invoices/${id}/pdf`);
      setInvoice(res.data.invoice);
      setPdfBusyMsg(null);
      const labelMain = invoice?.doc_type === 'estimate' ? '見積書 PDF'
                      : invoice?.doc_type === 'purchase_order' ? '注文書 PDF'
                      : '請求書 PDF';
      const blocked: { label: string; url: string }[] = [];
      if (!tryOpenUrl(res.data.pdf_url)) blocked.push({ label: labelMain, url: res.data.pdf_url });
      if (res.data.acknowledgement_pdf_url) {
        if (!tryOpenUrl(res.data.acknowledgement_pdf_url)) blocked.push({ label: '注文請書 PDF', url: res.data.acknowledgement_pdf_url });
      }
      if (blocked.length > 0) setPdfReadyUrls(blocked);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'PDF生成に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
      setPdfBusyMsg(null);
    }
  };

  // 送付状モーダル: 同封物ごとに チェック / 数量 / 単位 を持つ
  type CoverItem = { name: string; checked: boolean; count: number; unit: string };
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [coverItems, setCoverItems] = useState<CoverItem[]>([]);
  const [coverCustomItem, setCoverCustomItem] = useState<CoverItem>({ name: '', checked: true, count: 1, unit: '通' });

  // モーダルを開いた時に doc_type の既定項目をセット
  useEffect(() => {
    if (!coverModalOpen || !invoice) return;
    const defaults: CoverItem[] = invoice.doc_type === 'estimate'
      ? [{ name: '御見積書', checked: true, count: 1, unit: '通' }]
      : invoice.doc_type === 'purchase_order'
      ? [
          { name: '御注文書',   checked: true, count: 1, unit: '通' },
          { name: '御注文請書', checked: true, count: 1, unit: '通' },
        ]
      : [
          { name: '御請求書',       checked: true,  count: 1, unit: '通' },
          { name: '勤務表',         checked: false, count: 1, unit: '通' },
          { name: '交通費明細書',   checked: false, count: 1, unit: '通' },
        ];
    setCoverItems(defaults);
    setCoverCustomItem({ name: '', checked: true, count: 1, unit: '通' });
  }, [coverModalOpen, invoice]);

  const updateCoverItem = (i: number, patch: Partial<CoverItem>) => {
    setCoverItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const openCoverLetter = async () => {
    const items: { name: string; count: number; unit: string }[] = [];
    coverItems.forEach((it) => {
      if (it.checked && it.name.trim()) {
        items.push({ name: it.name.trim(), count: Math.max(1, it.count || 1), unit: (it.unit || '通').trim() || '通' });
      }
    });
    if (coverCustomItem.name.trim()) {
      items.push({
        name: coverCustomItem.name.trim(),
        count: Math.max(1, coverCustomItem.count || 1),
        unit: (coverCustomItem.unit || '通').trim() || '通',
      });
    }
    if (items.length === 0) {
      alert('同封物を1つ以上選択してください'); return;
    }
    setBusy(true);
    setPdfReadyUrls([]);
    setPdfBusyMsg('送付状 PDF を生成中…');
    try {
      const res = await apiClient.post(`/api/v1/invoices/${id}/cover-letter`, { items }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPdfBusyMsg(null);
      setCoverModalOpen(false);
      if (!tryOpenUrl(url)) setPdfReadyUrls([{ label: '送付状 PDF', url }]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '送付状の生成に失敗しました';
      alert(msg);
    } finally { setBusy(false); setPdfBusyMsg(null); }
  };

  const [envelopeModalOpen, setEnvelopeModalOpen] = useState(false);
  // 朱印の文言の集合。doc_type ごとに既定セットアップ。両方オンも可（複数朱印を縦に並べる）
  const [envelopeZaichuLabels, setEnvelopeZaichuLabels] = useState<string[]>([]);

  // envelope モーダルを開いた時に doc_type のデフォルトをセット
  useEffect(() => {
    if (!envelopeModalOpen || !invoice) return;
    const defaults = invoice.doc_type === 'estimate' ? ['見積書在中']
                   : invoice.doc_type === 'purchase_order' ? ['注文書在中']
                   : ['請求書在中'];
    setEnvelopeZaichuLabels(defaults);
  }, [envelopeModalOpen, invoice]);

  const toggleEnvelopeZaichu = (label: string) => {
    setEnvelopeZaichuLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const openEnvelope = async () => {
    setBusy(true);
    setPdfReadyUrls([]);
    setPdfBusyMsg('封筒 PDF を生成中…');
    try {
      const params = new URLSearchParams();
      envelopeZaichuLabels.forEach((l) => params.append('zaichu_labels[]', l));
      const res = await apiClient.get(`/api/v1/invoices/${id}/envelope?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPdfBusyMsg(null);
      setEnvelopeModalOpen(false);
      if (!tryOpenUrl(url)) setPdfReadyUrls([{ label: '封筒 PDF', url }]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '封筒の生成に失敗しました';
      alert(msg);
    } finally { setBusy(false); setPdfBusyMsg(null); }
  };

  // 郵送記録モーダル
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postSentAt, setPostSentAt]       = useState<string>(new Date().toISOString().slice(0, 10));
  const [postNote, setPostNote]           = useState('');
  const [postItems, setPostItems]         = useState({ invoice: false, cover: false, timesheet: false, transport: false });
  const [postTo, setPostTo]               = useState<string[]>([]);
  const [postCandidates, setPostCandidates] = useState<MailCandidate[]>([]);

  const openPostModal = async () => {
    setBusy(true);
    try {
      const res = await apiClient.get<{
        latest: {
          sent_at: string | null;
          note: string | null;
          attachments_meta: string[] | null;
          to_recipients: string[] | null;
        } | null;
        candidates: MailCandidate[];
      }>(`/api/v1/invoices/${id}/latest-post`);
      setPostCandidates(res.data.candidates ?? []);
      const latest = res.data.latest;
      if (latest) {
        setPostSentAt(latest.sent_at ?? new Date().toISOString().slice(0, 10));
        setPostNote(latest.note ?? '');
        setPostTo(latest.to_recipients ?? []);
        const items = latest.attachments_meta ?? [];
        const docName = invoice?.doc_type === 'estimate' ? '見積書' : invoice?.doc_type === 'purchase_order' ? '注文書' : '請求書';
        setPostItems({
          invoice:   items.includes(docName),
          cover:     items.includes('送付状'),
          timesheet: items.includes('勤務表'),
          transport: items.includes('交通費明細書'),
        });
      } else {
        setPostSentAt(new Date().toISOString().slice(0, 10));
        setPostNote('');
        setPostTo([]);
        setPostItems({ invoice: true, cover: false, timesheet: false, transport: false });
      }
      setPostModalOpen(true);
    } catch {
      setPostSentAt(new Date().toISOString().slice(0, 10));
      setPostNote('');
      setPostTo([]);
      setPostItems({ invoice: false, cover: false, timesheet: false, transport: false });
      setPostModalOpen(true);
    } finally { setBusy(false); }
  };

  const recordPost = async () => {
    setBusy(true);
    try {
      const docName = invoice?.doc_type === 'estimate' ? '見積書' : invoice?.doc_type === 'purchase_order' ? '注文書' : '請求書';
      const items = [
        postItems.invoice   ? docName           : null,
        postItems.cover     ? '送付状'           : null,
        postItems.timesheet ? '勤務表'           : null,
        postItems.transport ? '交通費明細書'     : null,
      ].filter(Boolean);
      await apiClient.post(`/api/v1/invoices/${id}/record-post`, {
        sent_at:       postSentAt,
        note:          postNote || null,
        items,
        to_recipients: postTo,
      });
      setPostModalOpen(false);
      showToast('記録しました', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '記録に失敗しました';
      alert(msg);
    } finally { setBusy(false); }
  };

  // メール送信モーダル
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailTo, setMailTo]               = useState<string[]>([]);
  const [mailCc, setMailCc]               = useState<string[]>([]);
  const [mailSubject, setMailSubject]     = useState('');
  const [mailBody, setMailBody]           = useState('');
  const [mailCandidates, setMailCandidates] = useState<MailCandidate[]>([]);
  const [mailDeliveryMethod, setMailDeliveryMethod] = useState<'mail' | 'post' | 'both' | null>(null);
  const [attachInvoice, setAttachInvoice] = useState(true);
  const [attachFiles, setAttachFiles]     = useState<File[]>([]);
  const [dragOver, setDragOver]           = useState(false);
  const [sendHistories, setSendHistories] = useState<SendHistoryRow[]>([]);

  // 宛名行を TO の連絡先名で置換する
  // 既存の冒頭ブロック（最初の空行まで）= 宛名 を、新しい宛名で差し替え
  const buildSalutation = (custName: string, contactNames: string[]): string => {
    if (contactNames.length === 0) return `${custName} 様`;
    return `${custName}\n` + contactNames.map(n => `　${n} 様`).join('\n');
  };

  const replaceSalutation = (body: string, newSalutation: string): string => {
    const idx = body.indexOf('\n\n');
    if (idx < 0) return newSalutation + '\n\n' + body;
    return newSalutation + body.substring(idx);
  };

  // mailTo が変わるたびに body の宛名を更新（user の手動編集を尊重するため、宛名以外は触らない）
  useEffect(() => {
    if (!mailModalOpen) return;
    const custName = invoice?.customer_name_snapshot ?? invoice?.customer?.company_name ?? '';
    if (!custName) return;
    const namesByEmail = new Map(mailCandidates.map(c => [c.email, c.name]));
    const contactNames = mailTo
      .map(em => namesByEmail.get(em))
      .filter((n): n is string => !!n);
    const sal = buildSalutation(custName, contactNames);
    setMailBody(prev => replaceSalutation(prev, sal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailTo, mailModalOpen, mailCandidates]);

  const openMailModal = async () => {
    setBusy(true);
    try {
      const [tplRes, histRes] = await Promise.all([
        apiClient.get<MailTemplate>(`/api/v1/invoices/${id}/mail-template`),
        apiClient.get<{ data: SendHistoryRow[] }>(`/api/v1/invoices/${id}/send-histories`),
      ]);
      setMailSubject(tplRes.data.subject);
      setMailBody(tplRes.data.body);
      setMailCandidates(tplRes.data.candidates ?? []);
      setMailDeliveryMethod(tplRes.data.delivery_method);
      setSendHistories(histRes.data.data ?? []);
      setMailTo([]); setMailCc([]);
      setAttachInvoice(true); setAttachFiles([]);
      setMailModalOpen(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'テンプレート取得に失敗しました';
      alert(msg);
    } finally { setBusy(false); }
  };

  const sendMail = async () => {
    if (mailTo.length === 0) { alert('TO を1件以上指定してください'); return; }
    if (!mailSubject || !mailBody) { alert('件名・本文を入力してください'); return; }

    // 送信直前に宛名を再計算（useEffect の遅延や手動編集と競合した時の保険）
    const custName = invoice?.customer_name_snapshot ?? invoice?.customer?.company_name ?? '';
    let bodyToSend = mailBody;
    if (custName) {
      const namesByEmail = new Map(mailCandidates.map(c => [c.email, c.name]));
      const contactNames = mailTo.map(em => namesByEmail.get(em)).filter((n): n is string => !!n);
      const sal = buildSalutation(custName, contactNames);
      bodyToSend = replaceSalutation(mailBody, sal);
      setMailBody(bodyToSend);
    }

    setBusy(true);
    try {
      const fd = new FormData();
      mailTo.forEach((e) => fd.append('to_emails[]', e));
      mailCc.forEach((e) => fd.append('cc_emails[]', e));
      fd.append('subject', mailSubject);
      fd.append('body', bodyToSend);
      fd.append('attach_invoice', attachInvoice ? '1' : '0');
      attachFiles.forEach((f) => fd.append('attachments[]', f));
      await apiClient.post(`/api/v1/invoices/${id}/send-mail`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMailModalOpen(false);
      showToast('送信しました', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'メール送信に失敗しました';
      // 失敗してもモーダルは閉じる（失敗履歴に残るため）
      setMailModalOpen(false);
      showToast(msg, 'error');
    } finally { setBusy(false); }
  };

  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length > 0) setAttachFiles((prev) => [...prev, ...dropped]);
  };
  const removeAttachFile = (idx: number) => setAttachFiles((prev) => prev.filter((_, i) => i !== idx));

  const remove = async () => {
    const docLabel = invoice?.doc_type === 'estimate' ? '見積書'
                   : invoice?.doc_type === 'purchase_order' ? '注文書'
                   : '請求書';
    const statusLabel = invoice?.status === 'issued' ? '発行済' : '下書き';
    if (!confirm(`この${docLabel}（${statusLabel}）を削除します。\n誤発行のリカバリ用です。よろしいですか？`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/api/v1/invoices/${id}`);
      const back = invoice?.doc_type === 'estimate' ? '/estimates'
                 : invoice?.doc_type === 'purchase_order' ? '/purchase-orders'
                 : '/invoices';
      router.push(back);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '削除に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!confirm('この請求書を承認申請します。よろしいですか？')) return;
    setBusy(true);
    try {
      const res = await apiClient.post<Invoice>(`/api/v1/invoices/${id}/submit-approval`);
      setInvoice(res.data);
      showToast('承認申請しました', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '承認申請に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    const docLabel = invoice?.doc_type === 'estimate' ? '見積書'
                   : invoice?.doc_type === 'purchase_order' ? '注文書'
                   : '請求書';
    if (!confirm(`この${docLabel}を承認しますか？`)) return;
    setBusy(true);
    setPdfBusyMsg('承認処理中…');
    try {
      const res = await apiClient.post<Invoice>(`/api/v1/invoices/${id}/approve`);
      setInvoice(res.data);
      showToast('承認しました', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '承認に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
      setPdfBusyMsg(null);
    }
  };

  const handleReject = async () => {
    const comment = prompt('却下理由を入力してください（必須）');
    if (!comment) return;
    setBusy(true);
    try {
      const res = await apiClient.post<Invoice>(`/api/v1/invoices/${id}/reject`, { comment });
      setInvoice(res.data);
      showToast('却下しました', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '却下に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !invoice) {
    return <div className="p-6 text-gray-400">読み込み中...</div>;
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-6xl mx-auto w-full">
      <Toast message={toast} type={toastType} onClose={() => setToast(null)} />
      <SignedScanUploadModal
        open={signedScanOpen}
        onClose={() => setSignedScanOpen(false)}
        onComplete={fetchData}
        fixedInvoiceId={invoice.id}
      />
      <div className="flex-shrink-0 mb-4">
        <Link
          href={invoice.doc_type === 'estimate' ? '/estimates'
              : invoice.doc_type === 'purchase_order' ? '/purchase-orders'
              : '/invoices'}
          className="text-sm text-blue-600 hover:underline"
        >
          {invoice.doc_type === 'estimate' ? '← 見積書一覧に戻る'
            : invoice.doc_type === 'purchase_order' ? '← 注文書一覧に戻る'
            : '← 請求書一覧に戻る'}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 font-mono">{invoice.invoice_number}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === 'issued'
              ? <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">発行済</span>
              : <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">下書き</span>}
            {invoice.doc_type !== 'estimate' && (
              <span className={`text-xs px-2 py-1 rounded ${APPROVAL_BADGE_CLASS[invoice.approval_status]}`}>
                {APPROVAL_LABEL[invoice.approval_status]}
              </span>
            )}
            {invoice.pdf_path && (
              <a href={invoice.pdf_path} target="_blank" rel="noreferrer"
                 className="text-blue-600 hover:underline text-sm">
                {invoice.doc_type === 'purchase_order' ? '📄 注文書 PDF' : '📄 PDF を開く'}
              </a>
            )}
            {invoice.doc_type === 'purchase_order' && invoice.acknowledgement_pdf_path && (
              <a href={invoice.acknowledgement_pdf_path} target="_blank" rel="noreferrer"
                 className="text-blue-600 hover:underline text-sm">📄 注文請書 PDF</a>
            )}
            {invoice.signed_scan_pdf_path && (invoice.doc_type === 'invoice' || invoice.doc_type === 'purchase_order') && (
              <button
                type="button"
                onClick={() => downloadSignedScanPdf(Number(id), (m) => showToast(m, 'error'))}
                className="text-emerald-700 hover:underline text-sm"
                title={buildSignedScanFilename(invoice)}
              >
                📑 捺印スキャンPDF
              </button>
            )}
            {invoice.approval_status === 'approved' && (invoice.doc_type === 'invoice' || invoice.doc_type === 'purchase_order') && (
              <button
                type="button"
                onClick={() => setSignedScanOpen(true)}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                {invoice.signed_scan_pdf_path ? '📎 スキャン再アップロード' : '📎 捺印スキャンアップロード'}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          🏢 {invoice.customer_name_snapshot} / {invoice.deal?.title} / 対象 {invoice.year_month}
          {invoice.engineer_name_snapshot && ` / 👤 ${invoice.engineer_name_snapshot}`}
        </p>
        {invoice.approval_status === 'rejected' && invoice.approval_comment && (
          <div className="mt-3 px-4 py-2.5 rounded-md bg-red-50 border border-red-200 text-sm">
            <p className="font-semibold text-red-700">⚠ 却下されました</p>
            <p className="text-red-600 mt-1 whitespace-pre-wrap">{invoice.approval_comment}</p>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-lg border border-gray-200 p-4 md:p-6 space-y-4 md:space-y-6">
        {/* 見積依頼メール（記録一元化: 受信依頼→見積→送信/郵送 を1画面に） */}
        {invoice.source_email && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-blue-800">✉️ 見積依頼メール</p>
              <a href="/emails" target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-blue-600 hover:underline">メール画面で開く</a>
            </div>
            <p className="text-sm text-gray-800 mt-1 truncate" title={invoice.source_email.subject ?? ''}>
              {invoice.source_email.subject ?? '(件名なし)'}
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              差出人: {invoice.source_email.from_name || invoice.source_email.from_address || '-'}
              {invoice.source_email.received_at ? ` ／ 受信: ${new Date(invoice.source_email.received_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}` : ''}
            </p>
          </div>
        )}
        {/* メタ情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Field label={invoice.doc_type === 'estimate' ? '見積日'
                       : invoice.doc_type === 'purchase_order' ? '注文日'
                       : '請求日'}>
            <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
          </Field>
          {invoice.doc_type === 'invoice' && (
            <Field label="支払期限">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          )}
        </div>

        {/* 番号類 (estimate は自身の番号のみで表示省略) */}
        {invoice.doc_type !== 'estimate' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {invoice.doc_type === 'purchase_order' && (
              <>
                <Field label="注文番号">
                  <Input value={invoice.invoice_number} disabled className="bg-gray-50 text-gray-500" />
                </Field>
                <Field label="見積番号">
                  <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder="EST-..." />
                </Field>
              </>
            )}
            {invoice.doc_type === 'invoice' && (
              <>
                <Field label="注文番号">
                  <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="ORD-..." />
                </Field>
                <Field label="見積番号">
                  <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder="EST-..." />
                </Field>
              </>
            )}
          </div>
        )}

        {/* 左側ヘッダー (E)(F)(G) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Field label="納期" dimmed={isEnglish} note={enNote}>
            <Input value={deliveryDateText} onChange={(e) => setDeliveryDateText(e.target.value)} placeholder="御社ご指定日" />
          </Field>
          <Field label="納入場所" dimmed={isEnglish} note={enNote}>
            <Input value={deliveryPlaceText} onChange={(e) => setDeliveryPlaceText(e.target.value)} placeholder="御社ご指定場所" />
          </Field>
          <Field label="支払期限文言" dimmed={isEnglish} note={enNote}>
            <Input value={paymentTermsText} onChange={(e) => setPaymentTermsText(e.target.value)}
              placeholder="月末締め翌々月20日現金お支払" />
          </Field>
        </div>

        {/* 明細部メタ (K)(L)(N)(O) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Field label="件名">
            <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
          </Field>
          <Field label="作業期間" dimmed={isEnglish} note={enNote}>
            <Input value={workPeriodText} onChange={(e) => setWorkPeriodText(e.target.value)}
              placeholder="2026年4月1日～2026年4月30日" />
          </Field>
          <Field label="作業場所" dimmed={isEnglish} note={enNote}>
            <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
          </Field>
          <Field label="作業担当者" dimmed={isEnglish} note={enNote}>
            <Input value={engineerNameSnapshot} onChange={(e) => setEngineerNameSnapshot(e.target.value)}
              placeholder="未入力の場合はPDFに印字されません" />
          </Field>
          <Field label="納品物" dimmed={isEnglish} note={enNote}>
            <Input value={deliveryItemsText} onChange={(e) => setDeliveryItemsText(e.target.value)}
              placeholder="作業報告書" />
          </Field>
          <Field label="業務交通費 説明" dimmed={isEnglish} note={enNote}>
            <textarea value={transportationNoteText} onChange={(e) => setTransportationNoteText(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              placeholder="お客様指示の基、移動が発生した場合は別途実費にてご請求" />
          </Field>
          <Field label="支払条件 (PDF表示用・自動派生)" dimmed={isEnglish} note={enNote}>
            <Input value={paymentCondition} disabled className="bg-gray-50 text-gray-500" />
          </Field>
        </div>

        {/* 明細 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">明細（金額計上行）</h2>
            <Button variant="outline" onClick={addLine} disabled={busy}>+ 行追加</Button>
          </div>
          <p className="text-xs text-gray-400 mb-2">基本月額行（先頭行）の摘要は「{`{金額}`}円」形式で生成されます。PDF側で「基本月額：」ラベルが自動付与されます。</p>
          <div className="overflow-auto border border-gray-200 rounded">
            <table className="text-sm" style={{ width: '1000px', minWidth: '1000px', tableLayout: 'fixed' }}>
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-2 py-2 font-semibold w-2/5">摘要</th>
                  <th className="text-right px-2 py-2 font-semibold w-20">数量</th>
                  <th className="text-left px-2 py-2 font-semibold w-16">単位</th>
                  <th className="text-right px-2 py-2 font-semibold w-32">単価</th>
                  <th className="text-center px-2 py-2 font-semibold w-24">税率</th>
                  <th className="text-center px-2 py-2 font-semibold w-16" title="経費(非課税)。オン=「経費」行で合算">経費</th>
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
                          disabled={!!l.is_expense}
                          className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400">
                          {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={!!l.is_expense}
                          onChange={(e) => updateLine(i, 'is_expense', e.target.checked)} />
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
                  <td colSpan={6} className="px-2 py-2 text-right text-gray-600">小計</td>
                  <td className="px-2 py-2 text-right tabular-nums">{yen(preview.subtotal)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-right text-gray-600">消費税</td>
                  <td className="px-2 py-2 text-right tabular-nums">{yen(preview.tax)}</td>
                  <td></td>
                </tr>
                {preview.expense > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-right text-gray-600">経費</td>
                    <td className="px-2 py-2 text-right tabular-nums">{yen(preview.expense)}</td>
                    <td></td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <td colSpan={6} className="px-2 py-2 text-right">合計</td>
                  <td className="px-2 py-2 text-right tabular-nums text-blue-700">{yen(preview.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 備考 */}
        <Field label="備考（PDF下段に追記表示）" dimmed={isEnglish} note={enNote}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white" />
        </Field>

        {/* アクション */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-200 flex-wrap">
          <Button variant="outline" onClick={() => save()} disabled={busy}>
            {busy ? '保存中...' : '保存'}
          </Button>
          <span title={invoice.approved ? '承認済の請求書は再生成できません' : '保存して PDF を生成'} className="inline-block">
            <Button onClick={generatePdf}
              disabled={busy || invoice.approved}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none">
              📄 PDF 生成
            </Button>
          </span>
          <Button variant="outline" onClick={() => setCoverModalOpen(true)} disabled={busy}>
            📋 送付状 PDF
          </Button>
          <Button variant="outline" onClick={() => setEnvelopeModalOpen(true)} disabled={busy}>
            ✉️ 長3封筒 PDF
          </Button>
          <Button variant="outline" onClick={openMailModal}
            disabled={busy || (invoice.doc_type !== 'estimate' && !invoice.approved)}
            title={invoice.doc_type === 'estimate'
              ? '見積書をメール送信'
              : (invoice.approved ? '帳票をメール送信' : '承認済みのみメール送信できます')}>
            📧 メール送信
          </Button>
          <Button variant="outline" onClick={openPostModal}
            disabled={busy || (invoice.doc_type !== 'estimate' && !invoice.approved)}
            title={invoice.doc_type === 'estimate'
              ? '見積書の郵送記録を残す'
              : (invoice.approved ? '郵送記録を残す' : '承認済みのみ郵送記録できます')}>
            📮 郵送記録
          </Button>

          {/* 承認ワークフロー（estimate は担当者ベースのため非表示） */}
          {invoice.doc_type !== 'estimate' && (invoice.approval_status === 'draft' || invoice.approval_status === 'rejected') && (
            <Button onClick={handleSubmitApproval} disabled={busy}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              📝 承認申請
            </Button>
          )}
          {invoice.doc_type !== 'estimate' && invoice.approval_status === 'pending' && canApprove && (
            <>
              <Button onClick={handleApprove} disabled={busy}
                className="bg-green-600 hover:bg-green-700 text-white">
                ✓ 承認
              </Button>
              <Button onClick={handleReject} disabled={busy}
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50">
                ✗ 却下
              </Button>
            </>
          )}

          <Button variant="outline" onClick={remove}
            disabled={busy || invoice.approved}
            title={invoice.approved ? '承認済の書類は削除できません' : undefined}
            className="text-red-600 border-red-200 hover:bg-red-50 ml-auto disabled:opacity-50">
            削除
          </Button>
        </div>
      </div>

      {/* 郵送記録モーダル */}
      {postModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPostModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">📮 郵送記録</h2>

            <div className="space-y-3">
              {/* TO 候補（クリックで TO に追加） */}
              {postCandidates.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">候補（クリックで TO に追加）:</p>
                  <div className="flex flex-wrap gap-1">
                    {postCandidates.map((c) => (
                      <button key={c.email || c.name}
                        type="button"
                        onClick={() => { if (!postTo.includes(c.name)) setPostTo([...postTo, c.name]); }}
                        className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-blue-100 text-gray-700">
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">TO（カンマ区切り）</label>
                <Input value={postTo.join(', ')}
                  onChange={(e) => setPostTo(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="氏名" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">郵送日</label>
                <Input type="date" value={postSentAt} onChange={(e) => setPostSentAt(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">同封物</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'invoice'   as const, label: invoice.doc_type === 'estimate' ? '見積書' : invoice.doc_type === 'purchase_order' ? '注文書' : '請求書' },
                    { key: 'cover'     as const, label: '送付状' },
                    { key: 'timesheet' as const, label: '勤務表' },
                    { key: 'transport' as const, label: '交通費明細書' },
                  ]).map((it) => {
                    const checked = postItems[it.key];
                    return (
                      <button key={it.key} type="button"
                        onClick={() => setPostItems(p => ({ ...p, [it.key]: !p[it.key] }))}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 999,
                          background: checked ? '#2563eb' : '#f3f4f6',
                          color: checked ? '#fff' : '#374151',
                          border: checked ? '2px solid #2563eb' : '2px solid #d1d5db',
                          fontSize: 13, fontWeight: 500,
                          cursor: 'pointer',
                        }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{checked ? '✓' : '＋'}</span>
                        {it.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">タップで選択／解除</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">備考（任意）</label>
                <textarea value={postNote} onChange={(e) => setPostNote(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setPostModalOpen(false)} disabled={busy}>キャンセル</Button>
              <Button onClick={recordPost} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">
                {busy ? '保存中…' : '記録する'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* メール送信モーダル */}
      {mailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setMailModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold">📧 {invoice.doc_type === 'estimate' ? '見積書' : invoice.doc_type === 'purchase_order' ? '注文書' : '請求書'}をメールで送信</h2>
              {mailDeliveryMethod && (
                <span className={`text-xs px-2 py-1 rounded ${
                  mailDeliveryMethod === 'mail' ? 'bg-blue-100 text-blue-700'
                  : mailDeliveryMethod === 'both' ? 'bg-purple-100 text-purple-700'
                  : 'bg-amber-100 text-amber-700'
                }`}>
                  顧客送付方法: {mailDeliveryMethod === 'mail' ? 'メール' : mailDeliveryMethod === 'both' ? 'メール+郵送' : '郵送のみ'}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* 送信先候補（クリックで TO に追加） */}
              {mailCandidates.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">候補（クリックで TO に追加）:</p>
                  <div className="flex flex-wrap gap-1">
                    {mailCandidates.map((c) => (
                      <button key={c.email}
                        type="button"
                        onClick={() => { if (!mailTo.includes(c.email)) setMailTo([...mailTo, c.email]); }}
                        className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-blue-100 text-gray-700">
                        {c.name} &lt;{c.email}&gt;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">TO（カンマ区切り）</label>
                <Input value={mailTo.join(', ')}
                  onChange={(e) => setMailTo(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="example@company.co.jp, ..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">CC（カンマ区切り・任意）</label>
                <Input value={mailCc.join(', ')}
                  onChange={(e) => setMailCc(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">件名</label>
                <Input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">本文</label>
                <textarea value={mailBody} onChange={(e) => setMailBody(e.target.value)} rows={12}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono" />
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">添付</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={attachInvoice} onChange={(e) => setAttachInvoice(e.target.checked)} />
                  {invoice.doc_type === 'estimate' ? '見積書' : invoice.doc_type === 'purchase_order' ? '注文書' : '請求書'} PDF（{invoice.invoice_number}.pdf）
                </label>

                {/* 追加ファイル D&D */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDropFiles}
                  className={`mt-3 border-2 border-dashed rounded-md px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
                    dragOver ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                  onClick={() => document.getElementById('mail-attach-input')?.click()}
                >
                  📎 ファイルをドラッグ&ドロップ または クリックして選択（勤務表・交通費明細書 など、10MB まで）
                  <input
                    id="mail-attach-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) setAttachFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </div>
                {attachFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="bg-gray-100 px-2 py-0.5 rounded truncate max-w-md">📄 {f.name}</span>
                        <span className="text-gray-400">{Math.ceil(f.size / 1024)}KB</span>
                        <button onClick={() => removeAttachFile(i)} className="text-red-500 hover:underline">削除</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* メール送信履歴のみ表示 */}
              {sendHistories.filter(h => h.method === 'mail').length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">メール送信履歴</p>
                  <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {sendHistories.filter(h => h.method === 'mail').map((h) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded ${h.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {h.status === 'sent' ? '送信済' : '失敗'}
                        </span>
                        <span className="text-gray-500">{h.sent_at?.replace('T', ' ').slice(0, 16)}</span>
                        <span className="text-gray-700 truncate">{h.subject}</span>
                        <span className="text-gray-400 text-[10px]">→ {h.to_emails?.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setMailModalOpen(false)} disabled={busy}>キャンセル</Button>
              <Button onClick={sendMail} disabled={busy || mailTo.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? '送信中…' : '送信する'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 封筒モーダル */}
      {envelopeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEnvelopeModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">長3封筒 - 朱印選択</h2>
            <p className="text-xs text-gray-500 mb-3">複数選択可。すべて未選択の場合は朱印なし。</p>
            <div className="space-y-2 mb-5">
              {(invoice.doc_type === 'estimate' ? ['見積書在中']
                : invoice.doc_type === 'purchase_order' ? ['注文書在中']
                : ['請求書在中']
              ).map((label) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input type="checkbox"
                    checked={envelopeZaichuLabels.includes(label)}
                    onChange={() => toggleEnvelopeZaichu(label)} />
                  「{label}」朱印
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnvelopeModalOpen(false)} disabled={busy}>キャンセル</Button>
              <Button onClick={openEnvelope} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? '生成中...' : 'PDF を開く'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 送付状モーダル */}
      {coverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCoverModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">送付状 - 同封物の選択</h2>
            <p className="text-xs text-gray-500 mb-3">チェックを外すと PDF から除外されます。「他」に名称を入力すれば追加可能（数量・単位はそれぞれ既定 1 / 通）。</p>
            <div className="grid grid-cols-[1fr_72px_72px] gap-2 text-xs font-semibold text-gray-600 mb-1 px-1">
              <div>品 名</div><div className="text-center">数量</div><div className="text-center">単位</div>
            </div>
            <div className="space-y-2 mb-3">
              {coverItems.map((it, i) => (
                <div key={`${it.name}-${i}`} className="grid grid-cols-[1fr_72px_72px] gap-2 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={it.checked}
                      onChange={(e) => updateCoverItem(i, { checked: e.target.checked })} />
                    {it.name}
                  </label>
                  <Input type="number" min={1} value={it.count}
                    onChange={(e) => updateCoverItem(i, { count: Number(e.target.value) })}
                    className="text-right" disabled={!it.checked} />
                  <Input type="text" value={it.unit}
                    onChange={(e) => updateCoverItem(i, { unit: e.target.value })}
                    className="text-center" disabled={!it.checked} />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_72px_72px] gap-2 items-center pt-2 border-t border-gray-100">
                <Input type="text" value={coverCustomItem.name}
                  onChange={(e) => setCoverCustomItem(p => ({ ...p, name: e.target.value }))}
                  placeholder="他（例: 会社案内）" />
                <Input type="number" min={1} value={coverCustomItem.count}
                  onChange={(e) => setCoverCustomItem(p => ({ ...p, count: Number(e.target.value) }))}
                  className="text-right" disabled={!coverCustomItem.name.trim()} />
                <Input type="text" value={coverCustomItem.unit}
                  onChange={(e) => setCoverCustomItem(p => ({ ...p, unit: e.target.value }))}
                  className="text-center" disabled={!coverCustomItem.name.trim()} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCoverModalOpen(false)} disabled={busy}>キャンセル</Button>
              <Button onClick={openCoverLetter} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
                {busy ? '生成中...' : 'PDF を開く'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF 生成中オーバーレイ - 進捗メッセージを表示してユーザーの不安を解消 */}
      {pdfBusyMsg && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl px-6 py-5 flex flex-col items-center gap-3 max-w-sm">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="text-sm font-medium text-gray-800">{pdfBusyMsg}</p>
            <p className="text-[11px] text-gray-500">PDF生成サーバーが Chromium を起動するため時間がかかります</p>
          </div>
        </div>
      )}

      {/* ポップアップブロックされた PDF を手動で開く UI */}
      {pdfReadyUrls.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setPdfReadyUrls([])}>
          <div className="bg-white rounded-lg shadow-xl px-6 py-5 flex flex-col items-stretch gap-3 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800">PDF 生成完了</h3>
            <p className="text-xs text-gray-500">ブラウザのポップアップブロックで自動表示できませんでした。以下のリンクから開いてください。</p>
            <div className="flex flex-col gap-2">
              {pdfReadyUrls.map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noreferrer"
                   className="px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 text-sm text-center">
                  📄 {p.label} を開く
                </a>
              ))}
            </div>
            <Button variant="outline" onClick={() => setPdfReadyUrls([])}>閉じる</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, dimmed, note }: {
  label: string;
  children: React.ReactNode;
  /** 英文 PDF など、ラベルだけ薄く＋注記を出すモード。入力欄自体は編集可のまま */
  dimmed?: boolean;
  note?: string;
}) {
  return (
    <div>
      <label className={`block text-xs font-semibold mb-1 ${dimmed ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
        {dimmed && note && (
          <span className="ml-2 font-normal text-[10px] text-amber-600">⚠ {note}</span>
        )}
      </label>
      {children}
    </div>
  );
}
