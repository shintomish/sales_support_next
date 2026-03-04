'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BusinessCard {
  id: number;
  company_name: string | null;
  person_name: string | null;
  department: string | null;
  position: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  status: string;
}

export default function BusinessCardEditPage() {
  const [form, setForm] = useState<Partial<BusinessCard>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    fetchCard();
  }, []);

  const fetchCard = async () => {
    try {
      const res = await apiClient.get(`/api/v1/cards/${id}`);
      setForm(res.data.data ?? res.data);
    } catch {
      router.push('/business-cards');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/api/v1/cards/${id}`, form);
      router.push(`/business-cards/${id}`);
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const fields = [
    { name: 'company_name', label: '会社名' },
    { name: 'person_name',  label: '氏名' },
    { name: 'department',   label: '部署' },
    { name: 'position',     label: '役職' },
    { name: 'postal_code',  label: '郵便番号' },
    { name: 'address',      label: '住所' },
    { name: 'phone',        label: '電話' },
    { name: 'mobile',       label: '携帯' },
    { name: 'fax',          label: 'FAX' },
    { name: 'email',        label: 'メール' },
    { name: 'website',      label: 'Webサイト' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.push(`/business-cards/${id}`)}>
          ← 戻る
        </Button>
        <h1 className="text-2xl font-bold">名刺編集</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">情報を編集</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
          )}

          {fields.map(({ name, label }) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                value={(form as any)[name] ?? ''}
                onChange={handleChange}
              />
            </div>
          ))}

          <div className="space-y-1">
            <Label htmlFor="status">ステータス</Label>
            <select
              id="status"
              name="status"
              value={form.status ?? 'processed'}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="processed">処理済み</option>
              <option value="registered">登録済み</option>
              <option value="pending">保留中</option>
            </select>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? '保存中...' : '保存する'}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
