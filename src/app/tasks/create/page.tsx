'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { validateTask, isValid, inputErrCls, FieldErrors } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer { id: number; company_name: string; }
interface Deal     { id: number; title: string; customer_id: number; }

const PRIORITIES = ['高', '中', '低'] as const;
const STATUSES   = ['未着手', '進行中', '完了'] as const;

const PRIORITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  高: { bg: '#FEF2F2', color: '#991B1B', border: '#EF4444' },
  中: { bg: '#FFF3E0', color: '#E67E00', border: '#FF8C00' },
  低: { bg: '#F1F5F9', color: '#475569', border: '#94A3B8' },
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  完了:   { bg: '#ECFDF5', color: '#065F46' },
  進行中: { bg: '#EFF6FF', color: '#1D4ED8' },
  未着手: { bg: '#F1F5F9', color: '#475569' },
};

const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400';
const textareaCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none';

export default function TaskCreatePage() {
  const [form, setForm] = useState<Record<string, string>>({ priority: '中', status: '未着手' });
  const [description, setDescription] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const fetchMasters = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/deals',     { params: { page: 1 } }),
      ]);
      setCustomers(cRes.data.data);
      setDeals(dRes.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  useEffect(() => {
    if (form.customer_id) {
      setFilteredDeals(deals.filter(d => d.customer_id === Number(form.customer_id)));
      setForm(prev => ({ ...prev, deal_id: '' }));
    } else {
      setFilteredDeals([]);
    }
  }, [form.customer_id, deals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    const newErrors = validateTask({ ...updated, description });
    setErrors(prev => ({ ...prev, [name]: newErrors[name] ?? '' }));
  };

  const handleSubmit = async () => {
    const allErrors = validateTask({ ...form, description });
    setErrors(allErrors);
    if (!isValid(allErrors)) return;
    setSaving(true); setSubmitError(null);
    try {
      await apiClient.post('/api/v1/tasks', { ...form, description });
      router.push('/tasks');
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
        <h1 className="text-2xl font-bold text-gray-800">タスク登録</h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">✅ タスク情報を入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span>⚠️</span><span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">タイトル <span className="text-red-500">*</span></Label>
              <Input name="title" placeholder="例：提案書の作成"
                value={form.title ?? ''} onChange={handleChange}
                className={`border-gray-200 ${inputErrCls(errors, 'title')}`} />
              {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">優先度 <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mt-1">
                {PRIORITIES.map(p => {
                  const s = PRIORITY_STYLE[p];
                  const selected = form.priority === p;
                  return (
                    <button key={p} type="button"
                      onClick={() => { setForm(prev => ({ ...prev, priority: p })); setErrors(prev => ({ ...prev, priority: '' })); }}
                      className="px-4 py-1.5 rounded-md text-sm border transition-all font-medium"
                      style={selected
                        ? { backgroundColor: s.bg, color: s.color, borderColor: s.border }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">ステータス <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mt-1">
                {STATUSES.map(s => {
                  const style = STATUS_STYLE[s];
                  const selected = form.status === s;
                  return (
                    <button key={s} type="button"
                      onClick={() => { setForm(prev => ({ ...prev, status: s })); setErrors(prev => ({ ...prev, status: '' })); }}
                      className="px-3 py-1.5 rounded-md text-sm border transition-all font-medium"
                      style={selected
                        ? { backgroundColor: style.bg, color: style.color, borderColor: style.color }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">期限日</Label>
              <Input name="due_date" type="date"
                value={form.due_date ?? ''} onChange={handleChange} className="border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">顧客（任意）</Label>
              <select name="customer_id" value={form.customer_id ?? ''} onChange={handleChange} className={selectCls}>
                <option value="">顧客を選択（任意）</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">関連商談（任意）</Label>
              <select name="deal_id" value={form.deal_id ?? ''} onChange={handleChange}
                disabled={!form.customer_id} className={selectCls}>
                <option value="">商談を選択（任意）</option>
                {filteredDeals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">詳細</Label>
              <textarea rows={4} placeholder="タスクの詳細を入力してください"
                value={description} onChange={e => setDescription(e.target.value)}
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
