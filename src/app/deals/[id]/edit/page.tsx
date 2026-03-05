'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer { id: number; company_name: string; }
interface Contact  { id: number; name: string; position: string | null; customer_id: number; }

const STATUSES = ['新規', '提案', '交渉', '成約', '失注'];

export default function DealEditPage() {
  const [form, setForm]           = useState<Record<string, string>>({});
  const [notes, setNotes]         = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isDirty, setIsDirty]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchData = useCallback(async () => {
    try {
      const [dealRes, cRes, coRes] = await Promise.all([
        apiClient.get(`/api/v1/deals/${id}`),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/contacts',  { params: { page: 1 } }),
      ]);
      const d = dealRes.data.data ?? dealRes.data;
      setForm({
        customer_id:          d.customer_id?.toString()  ?? '',
        contact_id:           d.contact_id?.toString()   ?? '',
        title:                d.title                    ?? '',
        amount:               d.amount?.toString()       ?? '',
        status:               d.status                   ?? '新規',
        probability:          d.probability?.toString()  ?? '0',
        expected_close_date:  d.expected_close_date      ?? '',
        actual_close_date:    d.actual_close_date        ?? '',
      });
      setNotes(d.notes ?? '');
      setCustomers(cRes.data.data);
      setContacts(coRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else router.push('/deals');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 顧客変更時に担当者を絞り込む
  useEffect(() => {
    if (form.customer_id) {
      setFilteredContacts(contacts.filter(c => c.customer_id === Number(form.customer_id)));
    } else {
      setFilteredContacts([]);
    }
  }, [form.customer_id, contacts]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setIsDirty(true);
  };

  const handleSubmit = async () => {
    if (!form.customer_id) { setError('顧客を選択してください'); return; }
    if (!form.title?.trim()) { setError('商談名は必須です'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/api/v1/deals/${id}`, { ...form, notes });
      setIsDirty(false);
      router.push(`/deals/${id}`);
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
        <h1 className="text-2xl font-bold">商談編集</h1>
        {isDirty && (
          <span className="text-xs text-amber-500 border border-amber-300 rounded px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">商談情報を編集</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 顧客選択 */}
            <div className="space-y-1">
              <Label>顧客 <span className="text-red-500">*</span></Label>
              <select name="customer_id" value={form.customer_id ?? ''} onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">顧客を選択してください</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>

            {/* 担当者選択 */}
            <div className="space-y-1">
              <Label>担当者</Label>
              <select name="contact_id" value={form.contact_id ?? ''} onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!form.customer_id}>
                <option value="">担当者を選択してください</option>
                {filteredContacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.position ? `（${c.position}）` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 商談名 */}
            <div className="space-y-1 col-span-2">
              <Label>商談名 <span className="text-red-500">*</span></Label>
              <Input name="title" placeholder="例：新システム導入案件"
                value={form.title ?? ''} onChange={handleChange} />
            </div>

            {/* 予定金額 */}
            <div className="space-y-1">
              <Label>予定金額</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                <Input name="amount" type="number" min="0" className="pl-6"
                  value={form.amount ?? ''} onChange={handleChange} />
              </div>
            </div>

            {/* ステータス */}
            <div className="space-y-1">
              <Label>ステータス <span className="text-red-500">*</span></Label>
              <select name="status" value={form.status ?? '新規'} onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* 成約確度 */}
            <div className="space-y-1 col-span-2">
              <Label>成約確度: <span className="font-bold text-blue-500">{form.probability ?? 0}%</span></Label>
              <input type="range" name="probability" min="0" max="100" step="10"
                value={form.probability ?? 0}
                onChange={handleChange}
                className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* 予定成約日 */}
            <div className="space-y-1">
              <Label>予定成約日</Label>
              <Input name="expected_close_date" type="date"
                value={form.expected_close_date ?? ''} onChange={handleChange} />
            </div>

            {/* 実際の成約日 */}
            <div className="space-y-1">
              <Label>実際の成約日</Label>
              <Input name="actual_close_date" type="date"
                value={form.actual_close_date ?? ''} onChange={handleChange} />
            </div>

            {/* 備考 */}
            <div className="space-y-1 col-span-2">
              <Label>備考</Label>
              <textarea rows={4} placeholder="備考を入力してください"
                value={notes} onChange={e => { setNotes(e.target.value); setIsDirty(true); }}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
