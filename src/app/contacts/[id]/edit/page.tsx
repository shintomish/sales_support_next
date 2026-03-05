'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer { id: number; company_name: string; }

const FIELDS = [
  { name: 'name',       label: '氏名',     type: 'text',  required: true,  placeholder: '例：山田 太郎',        span: 1 },
  { name: 'department', label: '部署',     type: 'text',  required: false, placeholder: '例：営業部',            span: 1 },
  { name: 'position',   label: '役職',     type: 'text',  required: false, placeholder: '例：部長',              span: 1 },
  { name: 'email',      label: 'メール',   type: 'email', required: false, placeholder: '例：yamada@example.com', span: 1 },
  { name: 'phone',      label: '電話番号', type: 'tel',   required: false, placeholder: '例：03-1234-5678',      span: 1 },
] as const;

export default function ContactEditPage() {
  const [form, setForm]           = useState<Record<string, string>>({});
  const [notes, setNotes]         = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isDirty, setIsDirty]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
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
        name:        c.name        ?? '',
        department:  c.department  ?? '',
        position:    c.position    ?? '',
        email:       c.email       ?? '',
        phone:       c.phone       ?? '',
      });
      setNotes(c.notes ?? '');
      setCustomers(customersRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else router.push('/contacts');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setIsDirty(true);
  };

  const handleSubmit = async () => {
    if (!form.customer_id) { setError('顧客を選択してください'); return; }
    if (!form.name?.trim()) { setError('氏名は必須です'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/api/v1/contacts/${id}`, { ...form, notes });
      setIsDirty(false);
      router.push(`/contacts/${id}`);
    } catch (err: any) {
      if (err.response?.status === 422) {
        const messages = Object.values(err.response.data.errors ?? {}).flat();
        setError(messages.join(' / ') as string);
      } else {
        setError('更新に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty && !confirm('変更が保存されていません。戻りますか？')) return;
    router.back();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">読み込み中...</p>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={handleBack}>← 戻る</Button>
        <h1 className="text-2xl font-bold">担当者編集</h1>
        {isDirty && (
          <span className="text-xs text-amber-500 border border-amber-300 rounded px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">担当者情報を編集</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 顧客選択 */}
            <div className="space-y-1">
              <Label htmlFor="customer_id">顧客 <span className="text-red-500">*</span></Label>
              <select
                id="customer_id"
                value={form.customer_id ?? ''}
                onChange={e => { setForm(prev => ({ ...prev, customer_id: e.target.value })); setIsDirty(true); }}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">顧客を選択してください</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            {FIELDS.map(({ name, label, type, required, placeholder, span }) => (
              <div key={name} className={`space-y-1 ${span === 2 ? 'col-span-2' : ''}`}>
                <Label htmlFor={name}>
                  {label}{required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  id={name} name={name} type={type}
                  placeholder={placeholder}
                  value={form[name] ?? ''}
                  onChange={handleChange}
                />
              </div>
            ))}

            <div className="space-y-1 col-span-2">
              <Label htmlFor="notes">備考</Label>
              <textarea
                id="notes" rows={3}
                placeholder="備考を入力してください"
                value={notes}
                onChange={e => { setNotes(e.target.value); setIsDirty(true); }}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleBack} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? '更新中...' : '💾 更新する'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
