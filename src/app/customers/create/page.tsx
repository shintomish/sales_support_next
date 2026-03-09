'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FIELDS = [
  { name: 'company_name',   label: '会社名',       type: 'text',   required: true,  placeholder: '例：株式会社サンプル',          span: 1 },
  { name: 'industry',       label: '業種',         type: 'text',   required: false, placeholder: '例：製造業、IT・通信',          span: 1 },
  { name: 'employee_count', label: '従業員数',     type: 'number', required: false, placeholder: '例：100',                      span: 1 },
  { name: 'phone',          label: '電話番号',     type: 'tel',    required: false, placeholder: '例：03-1234-5678',             span: 1 },
  { name: 'address',        label: '住所',         type: 'text',   required: false, placeholder: '例：東京都千代田区丸の内1-1-1', span: 2 },
  { name: 'website',        label: 'ウェブサイト', type: 'url',    required: false, placeholder: '例：https://example.com',      span: 2 },
] as const;

const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const textareaCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none';

export default function CustomerCreatePage() {
  const [form, setForm]   = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.company_name?.trim()) { setError('会社名は必須です'); return; }
    setSaving(true); setError(null);
    try {
      await apiClient.post('/api/v1/customers', { ...form, notes });
      router.push('/customers');
    } catch (err: any) {
      if (err.response?.status === 422) {
        const messages = Object.values(err.response.data.errors ?? {}).flat();
        setError(messages.join(' / ') as string);
      } else {
        setError('登録に失敗しました');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← 戻る</Button>
        <h1 className="text-2xl font-bold text-gray-800">顧客登録</h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">🏢 顧客情報を入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span className="text-base">⚠️</span><span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map(({ name, label, type, required, placeholder, span }) => (
              <div key={name} className={`space-y-1.5 ${span === 2 ? 'col-span-2' : ''}`}>
                <Label htmlFor={name} className="text-sm font-medium text-gray-700">
                  {label}{required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  id={name} name={name} type={type}
                  placeholder={placeholder}
                  value={form[name] ?? ''}
                  onChange={handleChange}
                  className="border-gray-200 focus:ring-blue-500"
                />
              </div>
            ))}

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700">備考</Label>
              <textarea
                id="notes" rows={4}
                placeholder="備考を入力してください"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className={textareaCls}
              />
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
