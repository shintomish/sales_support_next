'use client';

import { useEffect, useState, useCallback } from 'react';
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

const FIELDS = [ // ★ コンポーネント外に定数として切り出し（再レンダリングのたびに生成しない）
  { name: 'company_name', label: '会社名', type: 'text' },
  { name: 'person_name',  label: '氏名',   type: 'text' },
  { name: 'department',   label: '部署',   type: 'text' },
  { name: 'position',     label: '役職',   type: 'text' },
  { name: 'postal_code',  label: '郵便番号', type: 'text' },
  { name: 'address',      label: '住所',   type: 'text' },
  { name: 'phone',        label: '電話',   type: 'tel' }, // ★ type指定でモバイルキーボード最適化
  { name: 'mobile',       label: '携帯',   type: 'tel' },
  { name: 'fax',          label: 'FAX',    type: 'tel' },
  { name: 'email',        label: 'メール', type: 'email' }, // ★ type="email"
  { name: 'website',      label: 'Webサイト', type: 'url' }, // ★ type="url"
] as const;

export default function BusinessCardEditPage() {
  const [form, setForm] = useState<Partial<BusinessCard>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false); // ★ 未保存変更の検知
  const router = useRouter();
  const { id } = useParams();

  const fetchCard = useCallback(async () => { // ★ useCallbackで安定化
    try {
      const res = await apiClient.get(`/api/v1/cards/${id}`);
      setForm(res.data.data ?? res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/login');
      } else {
        router.push('/business-cards'); // ★ 404・その他も一覧へ
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]); // ★ 依存配列を明示

  // ★ ページ離脱時に未保存の警告
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); // ★ prev使用で最新state保証
    setIsDirty(true); // ★ 変更フラグON
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/api/v1/cards/${id}`, form);
      setIsDirty(false); // ★ 保存成功後にフラグをリセット
      router.push(`/business-cards/${id}`);
    } catch (err: any) {
      // ★ バリデーションエラー（422）を個別表示
      if (err.response?.status === 422) {
        const messages = Object.values(err.response.data.errors ?? {}).flat();
        setError(messages.join(' / ') as string);
      } else {
        setError('保存に失敗しました。時間をおいて再試行してください。');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    // ★ 未保存の変更がある場合に確認ダイアログ
    if (isDirty && !confirm('変更が保存されていません。戻りますか？')) return;
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={handleBack}> {/* ★ 未保存チェック付きに */}
          ← 戻る
        </Button>
        <h1 className="text-2xl font-bold">名刺編集</h1>
        {isDirty && ( // ★ 未保存バッジ
          <span className="text-xs text-amber-500 border border-amber-300 rounded px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">情報を編集</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
          )}

          {FIELDS.map(({ name, label, type }) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                type={type} // ★ type属性を渡す
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

          <div className="flex gap-2 pt-2"> {/* ★ キャンセルボタンを追加 */}
            <Button variant="outline" className="flex-1" onClick={handleBack} disabled={saving}>
              キャンセル
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
              {saving ? '保存中...' : '保存する'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
