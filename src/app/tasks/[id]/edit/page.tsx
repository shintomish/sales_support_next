'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiClient from '@/lib/axios';
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

export default function TaskEditPage() {
  const [form, setForm]           = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isDirty, setIsDirty]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const router = useRouter();
  const { id } = useParams();

  const fetchData = useCallback(async () => {
    try {
      const [taskRes, cRes, dRes] = await Promise.all([
        apiClient.get(`/api/v1/tasks/${id}`),
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/deals',     { params: { page: 1 } }),
      ]);
      const t = taskRes.data.data ?? taskRes.data;
      setForm({
        title:       t.title               ?? '',
        priority:    t.priority            ?? '中',
        status:      t.status              ?? '未着手',
        due_date:    t.due_date            ?? '',
        customer_id: t.customer_id?.toString() ?? '',
        deal_id:     t.deal_id?.toString()     ?? '',
      });
      setDescription(t.description ?? '');
      setCustomers(cRes.data.data);
      setDeals(dRes.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else router.push('/tasks');
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (form.customer_id) {
      setFilteredDeals(deals.filter(d => d.customer_id === Number(form.customer_id)));
    } else {
      setFilteredDeals([]);
    }
  }, [form.customer_id, deals]);

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
    if (!form.title?.trim()) { setError('タイトルは必須です'); return; }
    setSaving(true); setError(null);
    try {
      await apiClient.put(`/api/v1/tasks/${id}`, { ...form, description });
      setIsDirty(false);
      router.push(`/tasks/${id}`);
    } catch (err: any) {
      if (err.response?.status === 422) {
        const messages = Object.values(err.response.data.errors ?? {}).flat();
        setError(messages.join(' / ') as string);
      } else {
        setError('更新に失敗しました');
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
        <h1 className="text-2xl font-bold text-gray-800">タスク編集</h1>
        {isDirty && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            未保存の変更あり
          </span>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">✅ タスク情報を編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span className="text-base">⚠️</span><span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">タイトル <span className="text-red-500">*</span></Label>
              <Input name="title" placeholder="例：提案書の作成"
                value={form.title ?? ''} onChange={handleChange} className="border-gray-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">優先度 <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mt-1">
                {PRIORITIES.map(p => {
                  const s = PRIORITY_STYLE[p];
                  const selected = form.priority === p;
                  return (
                    <button key={p} type="button"
                      onClick={() => { setForm(prev => ({ ...prev, priority: p })); setIsDirty(true); }}
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
                      onClick={() => { setForm(prev => ({ ...prev, status: s })); setIsDirty(true); }}
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
                value={description} onChange={e => { setDescription(e.target.value); setIsDirty(true); }}
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
