'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const SES_STATUSES = ['稼働中', '更新交渉中', '新規', '提案', '交渉', '成約', '失注', '期限切れ'];
const inputCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
const selectCls = inputCls;
const labelCls = 'text-xs text-gray-500 mb-1 block';

interface FormData {
  engineer_name: string;
  customer_name: string;
  project_name: string;
  end_client: string;
  affiliation: string;
  affiliation_contact: string;
  email: string;
  phone: string;
  change_type: string;
  nearest_station: string;
  status: string;
  invoice_number: string;
  income_amount: string;
  billing_plus_22: string;
  billing_plus_29: string;
  sales_support_payee: string;
  sales_support_fee: string;
  adjustment_amount: string;
  profit: string;
  profit_rate_29: string;
  client_deduction_unit_price: string;
  client_deduction_hours: string;
  client_overtime_unit_price: string;
  client_overtime_hours: string;
  settlement_unit_minutes: string;
  payment_site: string;
  vendor_deduction_unit_price: string;
  vendor_deduction_hours: string;
  vendor_overtime_unit_price: string;
  vendor_overtime_hours: string;
  vendor_payment_site: string;
  contract_start: string;
  contract_period_start: string;
  contract_period_end: string;
  affiliation_period_end: string;
}

const toStr = (v: number | string | null | undefined): string =>
  v == null ? '' : String(v);

const toDateStr = (v: string | null | undefined): string => {
  if (!v) return '';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

export default function SesContractEditPage() {
  const router = useRouter();
  const { id } = useParams();
  const [form, setForm]           = useState<FormData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'amount' | 'settlement' | 'work'>('basic');

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/v1/ses-contracts/${id}`);
      const d = res.data.data;
      setForm({
        engineer_name:               toStr(d.engineer_name),
        customer_name:               toStr(d.customer_name),
        project_name:                toStr(d.project_name),
        end_client:                  toStr(d.end_client),
        affiliation:                 toStr(d.affiliation),
        affiliation_contact:         toStr(d.affiliation_contact),
        email:                       toStr(d.email),
        phone:                       toStr(d.phone),
        change_type:                 toStr(d.change_type),
        nearest_station:             toStr(d.nearest_station),
        status:                      toStr(d.status) || '稼働中',
        invoice_number:              toStr(d.invoice_number),
        income_amount:               toStr(d.income_amount),
        billing_plus_22:             toStr(d.billing_plus_22),
        billing_plus_29:             toStr(d.billing_plus_29),
        sales_support_payee:         toStr(d.sales_support_payee),
        sales_support_fee:           toStr(d.sales_support_fee),
        adjustment_amount:           toStr(d.adjustment_amount),
        profit:                      toStr(d.profit),
        profit_rate_29:              toStr(d.profit_rate_29),
        client_deduction_unit_price: toStr(d.client_deduction_unit_price),
        client_deduction_hours:      toStr(d.client_deduction_hours),
        client_overtime_unit_price:  toStr(d.client_overtime_unit_price),
        client_overtime_hours:       toStr(d.client_overtime_hours),
        settlement_unit_minutes:     toStr(d.settlement_unit_minutes),
        payment_site:                toStr(d.payment_site),
        vendor_deduction_unit_price: toStr(d.vendor_deduction_unit_price),
        vendor_deduction_hours:      toStr(d.vendor_deduction_hours),
        vendor_overtime_unit_price:  toStr(d.vendor_overtime_unit_price),
        vendor_overtime_hours:       toStr(d.vendor_overtime_hours),
        vendor_payment_site:         toStr(d.vendor_payment_site),
        contract_start:              toDateStr(d.contract_start),
        contract_period_start:       toDateStr(d.contract_period_start),
        contract_period_end:         toDateStr(d.contract_period_end),
        affiliation_period_end:      toStr(d.affiliation_period_end),
      });
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else if (err.response?.status === 404) router.push('/ses-contracts');
      else alert('データの取得に失敗しました');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => f ? { ...f, [key]: e.target.value } : f);

  const handleSubmit = async () => {
    if (!form) return;
    if (!form.engineer_name.trim()) { setErrors({ engineer_name: '氏名は必須です' }); return; }
    if (!form.customer_name.trim()) { setErrors({ customer_name: '顧客名は必須です' }); return; }

    setSaving(true);
    setErrors({});
    try {
      const payload: Record<string, string | number | null> = {};
      Object.entries(form).forEach(([k, v]) => {
        payload[k] = v === '' ? null : v;
      });
      await apiClient.put(`/api/v1/ses-contracts/${id}`, payload);
      router.push('/ses-contracts');
    } catch (err: any) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
      else alert('保存に失敗しました');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );
  if (!form) return null;

  const tabs = [
    { key: 'basic' as const,      label: '📋 基本情報' },
    { key: 'amount' as const,     label: '💰 金額' },
    { key: 'settlement' as const, label: '⚖️ 精算条件' },
    { key: 'work' as const,       label: '📅 契約・SES' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SES台帳 編集</h1>
          {form.engineer_name && (
            <p className="text-sm text-gray-400 mt-0.5">{form.engineer_name} / {form.customer_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '保存中...' : '💾 保存'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/ses-contracts')}>← 戻る</Button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 基本情報 */}
      {activeTab === 'basic' && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base text-gray-700">基本情報</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>氏名 <span className="text-red-500">*</span></label>
              <Input value={form.engineer_name} onChange={set('engineer_name')}
                className={errors.engineer_name ? 'border-red-400' : ''} />
              {errors.engineer_name && <p className="text-xs text-red-500 mt-1">{errors.engineer_name}</p>}
            </div>
            <div>
              <label className={labelCls}>顧客（所属先） <span className="text-red-500">*</span></label>
              <Input value={form.customer_name} onChange={set('customer_name')}
                className={errors.customer_name ? 'border-red-400' : ''} />
              {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name}</p>}
            </div>
            <div>
              <label className={labelCls}>エンド（常駐先）</label>
              <Input value={form.end_client} onChange={set('end_client')} />
            </div>
            <div>
              <label className={labelCls}>案件名</label>
              <Input value={form.project_name} onChange={set('project_name')} />
            </div>
            <div>
              <label className={labelCls}>変更種別</label>
              <Input value={form.change_type} onChange={set('change_type')} placeholder="新規・変更無 等" />
            </div>
            <div>
              <label className={labelCls}>ステータス</label>
              <select value={form.status} onChange={set('status')} className={selectCls}>
                {SES_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>所属</label>
              <Input value={form.affiliation} onChange={set('affiliation')} placeholder="社員・フリー 等" />
            </div>
            <div>
              <label className={labelCls}>所属担当者</label>
              <Input value={form.affiliation_contact} onChange={set('affiliation_contact')} />
            </div>
            <div>
              <label className={labelCls}>メール</label>
              <Input type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className={labelCls}>TEL</label>
              <Input value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className={labelCls}>現場最寄駅</label>
              <Input value={form.nearest_station} onChange={set('nearest_station')} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>適格請求書番号 / 特記事項</label>
              <Input value={form.invoice_number} onChange={set('invoice_number')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 金額 */}
      {activeTab === 'amount' && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base text-gray-700">金額情報</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'income_amount' as const,     label: '入金額' },
              { key: 'billing_plus_22' as const,   label: '支払（給料+22%）' },
              { key: 'billing_plus_29' as const,   label: '支払（給料+29%）' },
              { key: 'sales_support_fee' as const, label: '営業支援費' },
              { key: 'adjustment_amount' as const, label: '調整金額' },
              { key: 'profit' as const,            label: '利益' },
              { key: 'profit_rate_29' as const,    label: '利益/29%' },
            ].map(f => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                <Input type="number" value={form[f.key]} onChange={set(f.key)} placeholder="0" />
              </div>
            ))}
            <div>
              <label className={labelCls}>営業支援費支払先</label>
              <Input value={form.sales_support_payee} onChange={set('sales_support_payee')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 精算条件 */}
      {activeTab === 'settlement' && (
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base text-gray-700">精算条件（顧客側）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>控除単価</label><Input type="number" value={form.client_deduction_unit_price} onChange={set('client_deduction_unit_price')} /></div>
              <div><label className={labelCls}>控除時間</label><Input type="number" value={form.client_deduction_hours} onChange={set('client_deduction_hours')} /></div>
              <div><label className={labelCls}>超過単価</label><Input type="number" value={form.client_overtime_unit_price} onChange={set('client_overtime_unit_price')} /></div>
              <div><label className={labelCls}>超過時間</label><Input type="number" value={form.client_overtime_hours} onChange={set('client_overtime_hours')} /></div>
              <div><label className={labelCls}>精算単位（分）</label><Input type="number" value={form.settlement_unit_minutes} onChange={set('settlement_unit_minutes')} /></div>
              <div><label className={labelCls}>入金サイト（日）</label><Input type="number" value={form.payment_site} onChange={set('payment_site')} /></div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base text-gray-700">精算条件（仕入側）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>控除単価</label><Input type="number" value={form.vendor_deduction_unit_price} onChange={set('vendor_deduction_unit_price')} /></div>
              <div><label className={labelCls}>控除時間</label><Input type="number" value={form.vendor_deduction_hours} onChange={set('vendor_deduction_hours')} /></div>
              <div><label className={labelCls}>超過単価</label><Input type="number" value={form.vendor_overtime_unit_price} onChange={set('vendor_overtime_unit_price')} /></div>
              <div><label className={labelCls}>超過時間</label><Input type="number" value={form.vendor_overtime_hours} onChange={set('vendor_overtime_hours')} /></div>
              <div><label className={labelCls}>支払サイト（日）</label><Input type="number" value={form.vendor_payment_site} onChange={set('vendor_payment_site')} /></div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 契約・SES */}
      {activeTab === 'work' && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base text-gray-700">契約期間・SES情報</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>契約開始</label><Input type="date" value={form.contract_start} onChange={set('contract_start')} /></div>
            <div><label className={labelCls}>契約期間 開始</label><Input type="date" value={form.contract_period_start} onChange={set('contract_period_start')} /></div>
            <div><label className={labelCls}>契約期間 終了</label><Input type="date" value={form.contract_period_end} onChange={set('contract_period_end')} /></div>
            <div><label className={labelCls}>期間末（所属）</label><Input value={form.affiliation_period_end} onChange={set('affiliation_period_end')} placeholder="2026/03末" /></div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? '保存中...' : '💾 保存する'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/ses-contracts')}>キャンセル</Button>
      </div>
    </div>
  );
}
