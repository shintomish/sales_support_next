'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { validateDeal, isValid, inputErrCls, FieldErrors } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer { id: number; company_name: string; }
interface Contact  { id: number; name: string; position: string | null; customer_id: number; }

const STATUSES = ['新規', '提案', '交渉', '成約', '失注'];
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  新規: { bg: '#F1F5F9', color: '#475569' }, 提案: { bg: '#EFF6FF', color: '#1D4ED8' },
  交渉: { bg: '#FFF3E0', color: '#E67E00' }, 成約: { bg: '#ECFDF5', color: '#065F46' },
  失注: { bg: '#FEF2F2', color: '#991B1B' },
};

const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400';
const textareaCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none';

export default function DealCreatePage() {
  const [form, setForm]           = useState<Record<string, string>>({ status: '新規', probability: '0' });
  const [notes, setNotes]         = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const fetchMasters = useCallback(async () => {
    try {
      const [cRes, coRes] = await Promise.all([
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/contacts',  { params: { page: 1 } }),
      ]);
      setCustomers(cRes.data.data);
      setContacts(coRes.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  useEffect(() => {
    if (form.customer_id) {
      setFilteredContacts(contacts.filter(c => c.customer_id === Number(form.customer_id)));
      setForm(prev => ({ ...prev, contact_id: '' }));
    } else {
      setFilteredContacts([]);
    }
  }, [form.customer_id, contacts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    const newErrors = validateDeal({ ...updated, notes });
    setErrors(prev => ({ ...prev, [name]: newErrors[name] ?? '' }));
  };

  const handleSubmit = async () => {
    const allErrors = validateDeal({ ...form, notes });
    setErrors(allErrors);
    if (!isValid(allErrors)) return;
    setSaving(true); setSubmitError(null);
    try {
      await apiClient.post('/api/v1/deals', { ...form, notes });
      router.push('/deals');
    } catch (err: any) {
      if (err.response?.status === 422) {
        const serverErrors: FieldErrors = {};
        Object.entries(err.response.data.errors ?? {}).forEach(([k, v]) => {
          serverErrors[k] = (v as string[])[0];
        });
        setErrors(serverErrors);
      } else {
        setSubmitError('登録に失敗しました');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">商談登録</h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">💼 商談情報を入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span>⚠️</span><span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">顧客 <span className="text-red-500">*</span></Label>
              <select name="customer_id" value={form.customer_id ?? ''} onChange={handleChange}
                className={`${selectCls} ${errors.customer_id ? 'border-red-400' : ''}`}>
                <option value="">顧客を選択してください</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              {errors.customer_id && <p className="text-xs text-red-500 mt-0.5">{errors.customer_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">担当者</Label>
              <select name="contact_id" value={form.contact_id ?? ''} onChange={handleChange}
                disabled={!form.customer_id} className={selectCls}>
                <option value="">担当者を選択してください</option>
                {filteredContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.position ? `（${c.position}）` : ''}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">商談名 <span className="text-red-500">*</span></Label>
              <Input name="title" placeholder="例：新システム導入案件"
                value={form.title ?? ''} onChange={handleChange}
                className={`border-gray-200 ${inputErrCls(errors, 'title')}`} />
              {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">予定金額</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                <Input name="amount" type="number" min="0" placeholder="例：5000000"
                  className={`pl-6 border-gray-200 ${inputErrCls(errors, 'amount')}`}
                  value={form.amount ?? ''} onChange={handleChange} />
              </div>
              {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">ステータス <span className="text-red-500">*</span></Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {STATUSES.map(s => {
                  const style = STATUS_STYLE[s];
                  const selected = form.status === s;
                  return (
                    <button key={s} type="button"
                      onClick={() => { setForm(prev => ({ ...prev, status: s })); setErrors(prev => ({ ...prev, status: '' })); }}
                      className="px-3 py-1 rounded-md text-xs border transition-all"
                      style={selected
                        ? { backgroundColor: style.bg, color: style.color, borderColor: style.color, fontWeight: 600 }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">
                成約確度: <span className="font-bold text-blue-500">{form.probability ?? 0}%</span>
              </Label>
              <input type="range" name="probability" min="0" max="100" step="10"
                value={form.probability ?? 0} onChange={handleChange}
                className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">予定成約日</Label>
              <Input name="expected_close_date" type="date"
                value={form.expected_close_date ?? ''} onChange={handleChange} className="border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">実際の成約日</Label>
              <Input name="actual_close_date" type="date"
                value={form.actual_close_date ?? ''} onChange={handleChange}
                className={`border-gray-200 ${inputErrCls(errors, 'actual_close_date')}`} />
              {errors.actual_close_date && <p className="text-xs text-red-500 mt-0.5">{errors.actual_close_date}</p>}
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">備考</Label>
              <textarea rows={4} placeholder="備考を入力してください"
                value={notes} onChange={e => setNotes(e.target.value)}
                className={textareaCls} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => router.back()} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-[120px]">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />登録中...</>
                : '💾 登録する'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
