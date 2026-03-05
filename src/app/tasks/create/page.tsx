'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

export default function TaskCreatePage() {
  const [form, setForm]         = useState<Record<string, string>>({
    priority: '中', status: '未着手',
  });
  const [description, setDescription] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const router = useRouter();

  const fetchMasters = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/deals',     { params: { page: 1 } }),
      ]);
      setCustomers(cRes.data.data);
      setDeals(dRes.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  // 顧客選択時に商談を絞り込む
  useEffect(() => {
    if (form.customer_id) {
      setFilteredDeals(deals.filter(d => d.customer_id === Number(form.customer_id)));
      setForm(prev => ({ ...prev, deal_id: '' }));
    } else {
      setFilteredDeals([]);
    }
  }, [form.customer_id, deals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!form.title?.trim()) { setError('タイトルは必須です'); return; }
    if (!form.priority)      { setError('優先度を選択してください'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/v1/tasks', { ...form, description });
      router.push('/tasks');
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
        <h1 className="text-2xl font-bold">タスク登録</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">タスク情報を入力</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* タイトル */}
            <div className="space-y-1 col-span-2">
              <Label>タイトル <span className="text-red-500">*</span></Label>
              <Input name="title" placeholder="例：提案書の作成"
                value={form.title ?? ''} onChange={handleChange} />
            </div>

            {/* 優先度 */}
            <div className="space-y-1">
              <Label>優先度 <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mt-1">
                {PRIORITIES.map(p => {
                  const s = PRIORITY_STYLE[p];
                  const selected = form.priority === p;
                  return (
                    <button key={p} type="button"
                      onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                      className="px-4 py-1.5 rounded-md text-sm border transition-all"
                      style={selected
                        ? { backgroundColor: s.bg, color: s.color, borderColor: s.border, fontWeight: 600 }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }
                      }>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ステータス */}
            <div className="space-y-1">
              <Label>ステータス <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mt-1">
                {STATUSES.map(s => {
                  const style = STATUS_STYLE[s];
                  const selected = form.status === s;
                  return (
                    <button key={s} type="button"
                      onClick={() => setForm(prev => ({ ...prev, status: s }))}
                      className="px-3 py-1.5 rounded-md text-sm border transition-all"
                      style={selected
                        ? { backgroundColor: style.bg, color: style.color, borderColor: style.color, fontWeight: 600 }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }
                      }>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 期限日 */}
            <div className="space-y-1">
              <Label>期限日</Label>
              <Input name="due_date" type="date"
                value={form.due_date ?? ''} onChange={handleChange} />
            </div>

            {/* 顧客選択 */}
            <div className="space-y-1">
              <Label>顧客（任意）</Label>
              <select name="customer_id" value={form.customer_id ?? ''} onChange={handleChange}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">顧客を選択（任意）</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>

            {/* 関連商談 */}
            <div className="space-y-1 col-span-2">
              <Label>関連商談（任意）</Label>
              <select name="deal_id" value={form.deal_id ?? ''} onChange={handleChange}
                disabled={!form.customer_id}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                <option value="">商談を選択（任意）</option>
                {filteredDeals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>

            {/* 詳細 */}
            <div className="space-y-1 col-span-2">
              <Label>詳細</Label>
              <textarea rows={4} placeholder="タスクの詳細を入力してください"
                value={description} onChange={e => setDescription(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
