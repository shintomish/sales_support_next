'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ApiError } from '@/lib/error-helpers';

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
  notes: string;
}

const initialForm: FormData = {
  engineer_name: '', customer_name: '', project_name: '', end_client: '',
  affiliation: '', affiliation_contact: '', email: '', phone: '',
  change_type: '', nearest_station: '', status: '稼働中', invoice_number: '',
  income_amount: '', billing_plus_22: '', billing_plus_29: '',
  sales_support_payee: '', sales_support_fee: '', adjustment_amount: '',
  profit: '', profit_rate_29: '',
  client_deduction_unit_price: '', client_deduction_hours: '',
  client_overtime_unit_price: '', client_overtime_hours: '',
  settlement_unit_minutes: '', payment_site: '',
  vendor_deduction_unit_price: '', vendor_deduction_hours: '',
  vendor_overtime_unit_price: '', vendor_overtime_hours: '', vendor_payment_site: '',
  contract_start: '', contract_period_start: '', contract_period_end: '',
  affiliation_period_end: '', notes: '',
};

export default function SesContractCreatePage() {
  const router  = useRouter();
  const [form, setForm]       = useState<FormData>(initialForm);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'basic' | 'amount' | 'settlement' | 'work'>('basic');

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.engineer_name.trim()) { setErrors({ engineer_name: '氏名は必須です' }); return; }
    if (!form.customer_name.trim()) { setErrors({ customer_name: '顧客名は必須です' }); return; }

    setSaving(true);
    setErrors({});
    try {
      const payload: Record<string, string | number | null> = {};
      Object.entries(form).forEach(([k, v]) => {
        payload[k] = v === '' ? null : v;
      });
      await apiClient.post('/api/v1/ses-contracts', payload);
      router.push('/ses-contracts');
    } catch (err: unknown) {
      if ((err as ApiError).response?.data?.errors) setErrors(((err as ApiError).response?.data?.errors ?? {}) as unknown as Record<string, string>);
      else alert('保存に失敗しました');
    } finally { setSaving(false); }
  };

  const tabs = [
    { key: 'basic' as const,      label: '📋 基本情報' },
    { key: 'amount' as const,     label: '💰 金額' },
    { key: 'settlement' as const, label: '⚖️ 精算条件' },
    { key: 'work' as const,       label: '📅 契約・SES' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">SES台帳 新規登録</h1>
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
              activeTab === t.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'
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
              <Input value={form.engineer_name} onChange={set('engineer_name')} placeholder="山田 太郎" className={errors.engineer_name ? 'border-red-400' : ''} />
              {errors.engineer_name && <p className="text-xs text-red-500 mt-1">{errors.engineer_name}</p>}
            </div>
            <div>
              <label className={labelCls}>顧客（所属先） <span className="text-red-500">*</span></label>
              <Input value={form.customer_name} onChange={set('customer_name')} placeholder="株式会社〇〇" className={errors.customer_name ? 'border-red-400' : ''} />
              {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name}</p>}
            </div>
            <div>
              <label className={labelCls}>エンド（常駐先）</label>
              <Input value={form.end_client} onChange={set('end_client')} placeholder="株式会社△△" />
            </div>
            <div>
              <label className={labelCls}>案件名</label>
              <Input value={form.project_name} onChange={set('project_name')} placeholder="〇〇システム開発" />
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
              <Input value={form.affiliation_contact} onChange={set('affiliation_contact')} placeholder="担当者名" />
            </div>
            <div>
              <label className={labelCls}>メール</label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="yamada@example.com" />
            </div>
            <div>
              <label className={labelCls}>TEL</label>
              <Input value={form.phone} onChange={set('phone')} placeholder="090-0000-0000" />
            </div>
            <div>
              <label className={labelCls}>現場最寄駅</label>
              <Input value={form.nearest_station} onChange={set('nearest_station')} placeholder="渋谷" />
            </div>
            <div>
              <label className={labelCls}>適格請求書番号</label>
              <Input value={form.invoice_number} onChange={set('invoice_number')} placeholder="T1234567890123" />
            </div>
            <div>
              <label className={labelCls}>特記事項</label>
              <Input value={form.notes} onChange={set('notes')} placeholder="備考・補足事項" />
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
              { key: 'income_amount' as const,      label: '入金額' },
              { key: 'billing_plus_22' as const,    label: '支払（給料+22%）' },
              { key: 'billing_plus_29' as const,    label: '支払（給料+29%）' },
              { key: 'sales_support_fee' as const,  label: '営業支援費' },
              { key: 'adjustment_amount' as const,  label: '調整金額' },
              { key: 'profit' as const,             label: '利益' },
              { key: 'profit_rate_29' as const,     label: '利益/29%' },
            ].map(f => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                <Input type="number" value={form[f.key]} onChange={set(f.key)} placeholder="0" />
              </div>
            ))}
            <div>
              <label className={labelCls}>営業支援費支払先</label>
              <Input value={form.sales_support_payee} onChange={set('sales_support_payee')} placeholder="株式会社〇〇" />
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
              <div><label className={labelCls}>控除単価</label><Input type="number" value={form.client_deduction_unit_price} onChange={set('client_deduction_unit_price')} placeholder="0" /></div>
              <div><label className={labelCls}>控除時間</label><Input type="number" value={form.client_deduction_hours} onChange={set('client_deduction_hours')} placeholder="140" /></div>
              <div><label className={labelCls}>超過単価</label><Input type="number" value={form.client_overtime_unit_price} onChange={set('client_overtime_unit_price')} placeholder="0" /></div>
              <div><label className={labelCls}>超過時間</label><Input type="number" value={form.client_overtime_hours} onChange={set('client_overtime_hours')} placeholder="180" /></div>
              <div><label className={labelCls}>精算単位（分）</label><Input type="number" value={form.settlement_unit_minutes} onChange={set('settlement_unit_minutes')} placeholder="30" /></div>
              <div><label className={labelCls}>入金サイト（日）</label><Input type="number" value={form.payment_site} onChange={set('payment_site')} placeholder="50" /></div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base text-gray-700">精算条件（仕入側）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>控除単価</label><Input type="number" value={form.vendor_deduction_unit_price} onChange={set('vendor_deduction_unit_price')} placeholder="0" /></div>
              <div><label className={labelCls}>控除時間</label><Input type="number" value={form.vendor_deduction_hours} onChange={set('vendor_deduction_hours')} placeholder="140" /></div>
              <div><label className={labelCls}>超過単価</label><Input type="number" value={form.vendor_overtime_unit_price} onChange={set('vendor_overtime_unit_price')} placeholder="0" /></div>
              <div><label className={labelCls}>超過時間</label><Input type="number" value={form.vendor_overtime_hours} onChange={set('vendor_overtime_hours')} placeholder="180" /></div>
              <div><label className={labelCls}>支払サイト（日）</label><Input type="number" value={form.vendor_payment_site} onChange={set('vendor_payment_site')} placeholder="45" /></div>
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
