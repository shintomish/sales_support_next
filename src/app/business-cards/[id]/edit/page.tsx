'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiError } from '@/lib/error-helpers';

interface BusinessCard {
  id: number;
  company_name: string | null; person_name: string | null;
  department: string | null;  position: string | null;
  postal_code: string | null; address: string | null;
  phone: string | null;       mobile: string | null;
  fax: string | null;         email: string | null;
  website: string | null;     status: string;
}

const FIELDS = [
  { name: 'company_name', label: '会社名',     type: 'text',  placeholder: '例：株式会社サンプル' },
  { name: 'person_name',  label: '氏名',       type: 'text',  placeholder: '例：山田 太郎' },
  { name: 'department',   label: '部署',       type: 'text',  placeholder: '例：営業部' },
  { name: 'position',     label: '役職',       type: 'text',  placeholder: '例：部長' },
  { name: 'postal_code',  label: '郵便番号',   type: 'text',  placeholder: '例：100-0001' },
  { name: 'address',      label: '住所',       type: 'text',  placeholder: '例：東京都千代田区...' },
  { name: 'phone',        label: '電話',       type: 'tel',   placeholder: '例：03-1234-5678' },
  { name: 'mobile',       label: '携帯',       type: 'tel',   placeholder: '例：090-1234-5678' },
  { name: 'fax',          label: 'FAX',        type: 'tel',   placeholder: '例：03-1234-5679' },
  { name: 'email',        label: 'メール',     type: 'email', placeholder: '例：yamada@example.com' },
  { name: 'website',      label: 'Webサイト',  type: 'url',   placeholder: '例：https://example.com' },
] as const;

const STATUS_OPTIONS = [
  { value: 'processed',  label: '処理済み', bg: '#EFF6FF', color: '#1D4ED8' },
  { value: 'registered', label: '登録済み', bg: '#ECFDF5', color: '#065F46' },
  { value: 'pending',    label: '保留中',   bg: '#F1F5F9', color: '#475569' },
];

// フィールドをグループに分けて表示
const FIELD_GROUPS = [
  { title: '会社情報', fields: ['company_name', 'department', 'position'] },
  { title: '担当者情報', fields: ['person_name', 'email', 'phone', 'mobile', 'fax'] },
  { title: '住所', fields: ['postal_code', 'address', 'website'] },
];

export default function BusinessCardEditPage() {
  const [form, setForm]       = useState<Partial<BusinessCard>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();
  const { id } = useParams();

  const fetchCard = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/v1/cards/${id}`);
      setForm(res.data.data ?? res.data);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 401) router.push('/login');
      else router.push('/business-cards');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

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
    setSaving(true); setError('');
    try {
      await apiClient.put(`/api/v1/cards/${id}`, form);
      setIsDirty(false);
      router.push(`/business-cards/${id}`);
    } catch (err: unknown) {
      if ((err as ApiError).response?.status === 422) {
        const messages = Object.values((err as ApiError).response?.data?.errors ?? {}).flat();
        setError(messages.join(' / ') as string);
      } else {
        setError('保存に失敗しました。時間をおいて再試行してください。');
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
        <h1 className="text-2xl font-bold text-gray-800">名刺編集</h1>
        {isDirty && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm mb-4">
          <span className="text-base">⚠️</span><span>{error}</span>
        </div>
      )}

      {/* ステータス */}
      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">📋 ステータス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(opt => {
              const selected = (form.status ?? 'processed') === opt.value;
              return (
                <button key={opt.value} type="button"
                  onClick={() => { setForm(prev => ({ ...prev, status: opt.value })); setIsDirty(true); }}
                  className="px-4 py-1.5 rounded-md text-sm border transition-all font-medium"
                  style={selected
                    ? { backgroundColor: opt.bg, color: opt.color, borderColor: opt.color }
                    : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* フィールドグループ */}
      {FIELD_GROUPS.map(group => (
        <Card key={group.title} className="mb-4 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-700">{group.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.filter(f => group.fields.includes(f.name)).map(({ name, label, type, placeholder }) => (
                <div key={name} className={`space-y-1.5 ${name === 'address' ? 'col-span-2' : ''}`}>
                  <Label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</Label>
                  <Input
                    id={name} name={name} type={type}
                    placeholder={placeholder}
                    value={(form as Record<string, string | null | undefined>)[name] ?? ''}
                    onChange={handleChange}
                    className="border-gray-200"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 保存ボタン */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleBack} disabled={saving}>
          キャンセル
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
          {saving
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />保存中...</>
            : '💾 保存する'}
        </Button>
      </div>
    </div>
  );
}
