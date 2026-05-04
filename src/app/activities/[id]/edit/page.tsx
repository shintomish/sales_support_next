'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { validateActivity, isValid, inputErrCls, FieldErrors } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

interface Customer { id: number; company_name: string; }
interface Contact  { id: number; name: string; position: string | null; customer_id: number; }
interface Deal     { id: number; title: string; customer_id: number; }

const TYPES = ['訪問', '電話', 'メール', 'その他'];
const TYPE_STYLE: Record<string, { icon: string; bg: string; color: string }> = {
  訪問:   { icon: '🚶', bg: '#EFF6FF', color: '#2563EB' },
  電話:   { icon: '📞', bg: '#ECFDF5', color: '#10B981' },
  メール: { icon: '✉️', bg: '#FFF3E0', color: '#FF8C00' },
  その他: { icon: '•••', bg: '#F1F5F9', color: '#64748B' },
};

const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400';
const textareaCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none';

export default function ActivityEditPage() {
  const [form, setForm]           = useState<Record<string, string>>({});
  const [content, setContent]     = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [filteredDeals, setFilteredDeals]       = useState<Deal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isDirty, setIsDirty]     = useState(false);
  const [errors, setErrors]       = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchData = useCallback(async () => {
    try {
      const [actRes, cRes, coRes, dRes] = await Promise.all([
        apiClient.get(`/api/v1/activities/${id}`),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/contacts',  { params: { page: 1 } }),
        apiClient.get('/api/v1/deals',     { params: { page: 1 } }),
      ]);
      const a = actRes.data.data ?? actRes.data;
      setForm({
        customer_id:   a.customer_id?.toString() ?? '',
        contact_id:    a.contact_id?.toString()  ?? '',
        deal_id:       a.deal_id?.toString()     ?? '',
        type:          a.type                    ?? '訪問',
        subject:       a.subject                 ?? '',
        activity_date: a.activity_date           ?? '',
      });
      setContent(a.content ?? '');
      setCustomers(cRes.data.data);
      setContacts(coRes.data.data);
      setDeals(dRes.data.data);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else router.push('/activities');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (form.customer_id) {
      const cid = Number(form.customer_id);
      setFilteredContacts(contacts.filter(c => c.customer_id === cid));
      setFilteredDeals(deals.filter(d => d.customer_id === cid));
    } else {
      setFilteredContacts([]); setFilteredDeals([]);
    }
  }, [form.customer_id, contacts, deals]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated); setIsDirty(true);
    const newErrors = validateActivity({ ...updated, content });
    setErrors(prev => ({ ...prev, [name]: newErrors[name] ?? '' }));
  };

  const handleSubmit = async () => {
    const allErrors = validateActivity({ ...form, content });
    setErrors(allErrors);
    if (!isValid(allErrors)) return;
    setSaving(true); setSubmitError(null);
    try {
      await apiClient.put(`/api/v1/activities/${id}`, { ...form, content });
      setIsDirty(false);
      router.push(`/activities/${id}`);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 422) {
        const serverErrors: FieldErrors = {};
        Object.entries((err as ApiError).response?.data?.errors ?? {}).forEach(([k, v]) => {
          serverErrors[k] = (v as string[])[0];
        });
        setErrors(serverErrors);
      } else {
        setSubmitError('更新に失敗しました');
      }
    } finally { setSaving(false); }
  };

  const handleBack = () => {
    if (isDirty && !confirm('変更が保存されていません。戻りますか？')) return;
    router.back();
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">読み込み中...</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" onClick={handleBack}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">活動履歴編集</h1>
        {isDirty && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">🕐 活動情報を編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span>⚠️</span><span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">活動日 <span className="text-red-500">*</span></Label>
              <Input name="activity_date" type="date"
                value={form.activity_date ?? ''} onChange={handleChange}
                className={`border-gray-200 ${inputErrCls(errors, 'activity_date')}`} />
              {errors.activity_date && <p className="text-xs text-red-500 mt-0.5">{errors.activity_date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">活動種別 <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {TYPES.map(t => {
                  const s = TYPE_STYLE[t];
                  const selected = form.type === t;
                  return (
                    <button key={t} type="button"
                      onClick={() => { setForm(prev => ({ ...prev, type: t })); setIsDirty(true); setErrors(prev => ({ ...prev, type: '' })); }}
                      className="px-3 py-1.5 rounded-md text-sm border transition-all"
                      style={selected
                        ? { backgroundColor: s.bg, color: s.color, borderColor: s.color, fontWeight: 600 }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                      {s.icon} {t}
                    </button>
                  );
                })}
              </div>
            </div>

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
              <Label className="text-sm font-medium text-gray-700">関連商談</Label>
              <select name="deal_id" value={form.deal_id ?? ''} onChange={handleChange}
                disabled={!form.customer_id} className={selectCls}>
                <option value="">商談を選択してください（任意）</option>
                {filteredDeals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">件名 <span className="text-red-500">*</span></Label>
              <Input name="subject" placeholder="例：新システム提案のヒアリング"
                value={form.subject ?? ''} onChange={handleChange}
                className={`border-gray-200 ${inputErrCls(errors, 'subject')}`} />
              {errors.subject && <p className="text-xs text-red-500 mt-0.5">{errors.subject}</p>}
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">内容</Label>
              <textarea rows={5} placeholder="活動内容の詳細を入力してください"
                value={content} onChange={e => { setContent(e.target.value); setIsDirty(true); }}
                className={textareaCls} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={handleBack} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-[120px]">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />更新中...</>
                : '💾 更新する'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
