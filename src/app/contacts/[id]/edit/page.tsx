'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { validateContact, isValid, inputErrCls, FieldErrors } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

interface Customer { id: number; company_name: string; }

const FIELDS = [
  { name: 'name', label: '氏名', type: 'text', required: true, placeholder: '例：山田 太郎', span: 1 },
  { name: 'department', label: '部署', type: 'text', required: false, placeholder: '例：営業部', span: 1 },
  { name: 'position', label: '役職', type: 'text', required: false, placeholder: '例：部長', span: 1 },
  { name: 'email', label: 'メール', type: 'email', required: false, placeholder: '例：yamada@example.com', span: 1 },
  { name: 'phone', label: '電話番号', type: 'tel', required: false, placeholder: '例：03-1234-5678', span: 1 },
];

const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const textareaCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none';

export default function ContactEditPage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchData = useCallback(async () => {
    try {
      const [contactRes, customersRes] = await Promise.all([
        apiClient.get(`/api/v1/contacts/${id}`),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
      ]);
      const c = contactRes.data.data ?? contactRes.data;
      setForm({
        customer_id: c.customer_id?.toString() ?? '',
        name: c.name ?? '',
        department: c.department ?? '',
        position: c.position ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
      });
      setNotes(c.notes ?? '');
      setCustomers(customersRes.data.data);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else router.push('/contacts');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated); setIsDirty(true);
    const newErrors = validateContact({ ...updated, notes });
    setErrors(prev => ({ ...prev, [name]: newErrors[name] ?? '' }));
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updated = { ...form, customer_id: e.target.value };
    setForm(updated); setIsDirty(true);
    const newErrors = validateContact({ ...updated, notes });
    setErrors(prev => ({ ...prev, customer_id: newErrors.customer_id ?? '' }));
  };

  const handleSubmit = async () => {
    const allErrors = validateContact({ ...form, notes });
    setErrors(allErrors);
    if (!isValid(allErrors)) return;
    setSaving(true); setSubmitError(null);
    try {
      await apiClient.put(`/api/v1/contacts/${id}`, { ...form, notes });
      setIsDirty(false);
      router.push(`/contacts/${id}`);
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
        <h1 className="text-2xl font-bold text-gray-800">担当者編集</h1>
        {isDirty && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">👤 担当者情報を編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span>⚠️</span><span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">顧客 <span className="text-red-500">*</span></Label>
              <select value={form.customer_id ?? ''} onChange={handleCustomerChange}
                className={`${selectCls} ${errors.customer_id ? 'border-red-400' : ''}`}>
                <option value="">顧客を選択してください</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              {errors.customer_id && <p className="text-xs text-red-500 mt-0.5">{errors.customer_id}</p>}
            </div>

            {FIELDS.map(({ name, label, type, required, placeholder }) => ( 
              <div key={name} className="space-y-1.5">
                <Label htmlFor={name} className="text-sm font-medium text-gray-700">
                  {label}{required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input id={name} name={name} type={type} placeholder={placeholder}
                  value={form[name] ?? ''} onChange={handleChange}
                  className={`border-gray-200 ${inputErrCls(errors, name)}`} />
                {errors[name] && <p className="text-xs text-red-500 mt-0.5">{errors[name]}</p>}
              </div>
            ))}

            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">備考</Label>
              <textarea rows={3} placeholder="備考を入力してください"
                value={notes} onChange={e => { setNotes(e.target.value); setIsDirty(true); }}
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
