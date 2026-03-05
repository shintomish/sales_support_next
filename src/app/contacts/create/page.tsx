'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer { id: number; company_name: string; }

const FIELDS = [
  { name: 'name',       label: '氏名',       type: 'text',  required: true,  placeholder: '例：山田 太郎',       span: 1 },
  { name: 'department', label: '部署',       type: 'text',  required: false, placeholder: '例：営業部',           span: 1 },
  { name: 'position',   label: '役職',       type: 'text',  required: false, placeholder: '例：部長',             span: 1 },
  { name: 'email',      label: 'メール',     type: 'email', required: false, placeholder: '例：yamada@example.com', span: 1 },
  { name: 'phone',      label: '電話番号',   type: 'tel',   required: false, placeholder: '例：03-1234-5678',     span: 1 },
] as const;

export default function ContactCreatePage() {
  const [form, setForm]         = useState<Record<string, string>>({});
  const [notes, setNotes]       = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const router = useRouter();

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/customers', { params: { page: 1 } });
      setCustomers(res.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!form.customer_id) { setError('顧客を選択してください'); return; }
    if (!form.name?.trim()) { setError('氏名は必須です'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/contacts', { ...form, notes });
      router.push('/contacts');
    } catch (err: any) {
      if (err.response?.status === 422) {
        const messages = Object.values(err.response.data.errors ?? {}).flat();
        setError(messages.join(' / ') as string);
      } else {
        setError('登録に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.back()}>← 戻る</Button>
        <h1 className="text-2xl font-bold">担当者登録</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">担当者情報を入力</CardTitle></CardHeader>
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
                onChange={e => setForm(prev => ({ ...prev, customer_id: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">顧客を選択してください</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            {/* その他フィールド */}
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

            {/* 備考 */}
            <div className="space-y-1 col-span-2">
              <Label htmlFor="notes">備考</Label>
              <textarea
                id="notes" rows={3}
                placeholder="備考を入力してください"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => router.back()} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? '登録中...' : '💾 登録する'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
