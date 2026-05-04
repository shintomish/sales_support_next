'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WorkRecord {
  id: number;
  deal_id: number;
  year_month: string;
  timesheet_received_date: string | null;
  transportation_fee: string | null;
  absence_days: string | null;
  paid_leave_days: string | null;
  actual_hours: string | null;
  invoice_exists: boolean | null;
  invoice_received_date: string | null;
  notes: string | null;
}

interface Deal {
  id: number;
  title: string;
  customer?: { id: number; company_name: string };
}

const formatDateInput = (v: string | null): string => v?.slice(0, 10) ?? '';

/** 直近12ヶ月の YYYY-MM 配列を新しい順で返す */
const recentMonths = (): string[] => {
  const arr: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    arr.push(ym);
  }
  return arr;
};

export default function TimesheetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dealId = Number(id);

  const [deal,    setDeal]    = useState<Deal | null>(null);
  const [records, setRecords] = useState<Record<string, WorkRecord>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dealRes, recRes] = await Promise.all([
        apiClient.get(`/api/v1/deals/${dealId}`),
        apiClient.get(`/api/v1/deals/${dealId}/work-records`),
      ]);
      setDeal(dealRes.data.data ?? dealRes.data);
      const map: Record<string, WorkRecord> = {};
      (recRes.data.records ?? []).forEach((r: WorkRecord) => { map[r.year_month] = r; });
      setRecords(map);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const months = recentMonths();

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-shrink-0 mb-4">
        <Link href={`/ses-contracts/${dealId}/edit`} className="text-sm text-blue-600 hover:underline">
          ← SES案件編集に戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">月別勤務表</h1>
        {deal && (
          <p className="text-sm text-gray-600 mt-1">
            {deal.customer?.company_name && <span className="text-gray-500">🏢 {deal.customer.company_name} / </span>}
            <span className="font-semibold">{deal.title}</span>
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">直近12ヶ月分を表示。行をクリックで編集</p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">年月</th>
                <th className="text-left px-4 py-3 font-semibold">勤務表受領</th>
                <th className="text-right px-4 py-3 font-semibold">実労働(h)</th>
                <th className="text-right px-4 py-3 font-semibold">欠勤(日)</th>
                <th className="text-right px-4 py-3 font-semibold">有給(日)</th>
                <th className="text-right px-4 py-3 font-semibold">交通費</th>
                <th className="text-center px-4 py-3 font-semibold">請求書</th>
                <th className="text-left px-4 py-3 font-semibold">備考</th>
                <th className="text-right px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
              ) : months.map((ym) => {
                const r = records[ym];
                return (
                  <tr key={ym} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{ym}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateInput(r?.timesheet_received_date ?? null) || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r?.actual_hours ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r?.absence_days ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r?.paid_leave_days ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r?.transportation_fee ? `¥${Number(r.transportation_fee).toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {r?.invoice_exists ? (r.invoice_received_date ? '✓ 受領' : '⏳ 待ち') : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{r?.notes ?? ''}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-xs px-2 py-1 rounded hover:bg-blue-100 text-blue-600"
                        onClick={() => setEditing(ym)}>編集</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditDialog
          dealId={dealId}
          yearMonth={editing}
          existing={records[editing]}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchData(); }}
        />
      )}
    </div>
  );
}

// ─── 編集ダイアログ ───
function EditDialog({ dealId, yearMonth, existing, onClose, onSaved }: {
  dealId: number; yearMonth: string; existing: WorkRecord | undefined;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    timesheet_received_date: formatDateInput(existing?.timesheet_received_date ?? null),
    actual_hours:            existing?.actual_hours ?? '',
    absence_days:            existing?.absence_days ?? '',
    paid_leave_days:         existing?.paid_leave_days ?? '',
    transportation_fee:      existing?.transportation_fee ?? '',
    invoice_exists:          existing?.invoice_exists ?? false,
    invoice_received_date:   formatDateInput(existing?.invoice_received_date ?? null),
    notes:                   existing?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      // 空文字フィールドは null として送信し、サーバ側で値をクリアできるようにする
      // （以前は空欄を送らない実装だったため、誤入力した日付を消せなかった）
      const NULLABLE = new Set([
        'timesheet_received_date', 'invoice_received_date',
        'actual_hours', 'absence_days', 'paid_leave_days',
        'transportation_fee', 'notes',
      ]);
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v === '' || v === null) {
          if (NULLABLE.has(k)) payload[k] = null;
          return;
        }
        payload[k] = v;
      });
      await apiClient.put(`/api/v1/deals/${dealId}/work-records/${yearMonth}`, payload);
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">勤務表編集 — {yearMonth}</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="勤務表受領日">
            <Input type="date" value={form.timesheet_received_date}
              onChange={(e) => setForm({...form, timesheet_received_date: e.target.value})} />
          </Field>
          <Field label="実労働(時間)">
            <Input type="number" step="0.25" min="0" value={String(form.actual_hours)}
              onChange={(e) => setForm({...form, actual_hours: e.target.value})} />
          </Field>
          <Field label="欠勤日数">
            <Input type="number" step="0.5" min="0" value={String(form.absence_days)}
              onChange={(e) => setForm({...form, absence_days: e.target.value})} />
          </Field>
          <Field label="有給日数">
            <Input type="number" step="0.5" min="0" value={String(form.paid_leave_days)}
              onChange={(e) => setForm({...form, paid_leave_days: e.target.value})} />
          </Field>
          <Field label="交通費(円)">
            <Input type="number" min="0" value={String(form.transportation_fee)}
              onChange={(e) => setForm({...form, transportation_fee: e.target.value})} />
          </Field>
          <Field label="請求書">
            <label className="inline-flex items-center gap-2 mt-2">
              <input type="checkbox" checked={!!form.invoice_exists}
                onChange={(e) => setForm({...form, invoice_exists: e.target.checked})} />
              <span className="text-sm">請求書あり</span>
            </label>
          </Field>
          {form.invoice_exists && (
            <Field label="請求書受領日">
              <Input type="date" value={form.invoice_received_date}
                onChange={(e) => setForm({...form, invoice_received_date: e.target.value})} />
            </Field>
          )}
        </div>

        <Field label="備考">
          <textarea className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
            rows={3} value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})} />
        </Field>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={busy}>キャンセル</Button>
          <Button onClick={submit} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
