'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Customer { id: number; company_name: string; }
interface Contact  { id: number; name: string; position: string | null; customer_id: number; }
interface Deal     { id: number; title: string; customer_id: number; }

const TYPES = ['訪問', '電話', 'メール', 'その他'];
const TYPE_STYLE: Record<string, { icon: string; bg: string; color: string }> = {
  訪問:   { icon: '🚶', bg: '#EFF6FF', color: '#2563EB' },
  電話:   { icon: '📞', bg: '#ECFDF5', color: '#10B981' },
  メール: { icon: '✉️', bg: '#FFF3E0', color: '#FF8C00' },
  その他: { icon: '•••', bg: '#F1F5F9', color: '#64748B' },
};

const selectCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400';
const textareaCls = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none';

export default function ActivityCreatePage() {
  const [form, setForm] = useState<Record<string, string>>({
    type: '訪問',
    activity_date: new Date().toISOString().split('T')[0],
  });
  const [content, setContent]     = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [filteredDeals, setFilteredDeals]       = useState<Deal[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const router = useRouter();

  const fetchMasters = useCallback(async () => {
    try {
      const [cRes, coRes, dRes] = await Promise.all([
        apiClient.get('/api/v1/customers', { params: { page: 1 } }),
        apiClient.get('/api/v1/contacts',  { params: { page: 1 } }),
        apiClient.get('/api/v1/deals',     { params: { page: 1 } }),
      ]);
      setCustomers(cRes.data.data);
      setContacts(coRes.data.data);
      setDeals(dRes.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  useEffect(() => {
    if (form.customer_id) {
      const cid = Number(form.customer_id);
      setFilteredContacts(contacts.filter(c => c.customer_id === cid));
      setFilteredDeals(deals.filter(d => d.customer_id === cid));
      setForm(prev => ({ ...prev, contact_id: '', deal_id: '' }));
    } else {
      setFilteredContacts([]); setFilteredDeals([]);
    }
  }, [form.customer_id, contacts, deals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.customer_id) { setError('顧客を選択してください'); return; }
    if (!form.subject?.trim()) { setError('件名は必須です'); return; }
    if (!form.type) { setError('活動種別を選択してください'); return; }
    setSaving(true); setError(null);
    try {
      await apiClient.post('/api/v1/activities', { ...form, content });
      router.push('/activities');
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
        <h1 className="text-2xl font-bold text-gray-800">活動履歴登録</h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gray-700">🕐 活動情報を入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
              <span className="text-base">⚠️</span><span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 活動日 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">活動日 <span className="text-red-500">*</span></Label>
              <Input name="activity_date" type="date"
                value={form.activity_date ?? ''} onChange={handleChange} className="border-gray-200" />
            </div>

            {/* 活動種別 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">活動種別 <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {TYPES.map(t => {
                  const s = TYPE_STYLE[t];
                  const selected = form.type === t;
                  return (
                    <button key={t} type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: t }))}
                      className="px-3 py-1.5 rounded-md text-sm border transition-all"
                      style={selected
                        ? { backgroundColor: s.bg, color: s.color, borderColor: s.color, fontWeight: 600 }
                        : { backgroundColor: '#fff', color: '#64748B', borderColor: '#E2E8F0' }}>
                      {s.icon} {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 顧客・担当者 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">顧客 <span className="text-red-500">*</span></Label>
              <select name="customer_id" value={form.customer_id ?? ''} onChange={handleChange} className={selectCls}>
                <option value="">顧客を選択してください</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">担当者</Label>
              <select name="contact_id" value={form.contact_id ?? ''} onChange={handleChange}
                disabled={!form.customer_id} className={selectCls}>
                <option value="">担当者を選択してください</option>
                {filteredContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.position ? `（${c.position}）` : ''}</option>
                ))}
              </select>
            </div>

            {/* 関連商談 */}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">関連商談</Label>
              <select name="deal_id" value={form.deal_id ?? ''} onChange={handleChange}
                disabled={!form.customer_id} className={selectCls}>
                <option value="">商談を選択してください（任意）</option>
                {filteredDeals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>

            {/* 件名 */}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">件名 <span className="text-red-500">*</span></Label>
              <Input name="subject" placeholder="例：新システム提案のヒアリング"
                value={form.subject ?? ''} onChange={handleChange} className="border-gray-200" />
            </div>

            {/* 内容 */}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">内容</Label>
              <textarea rows={5} placeholder="活動内容の詳細を入力してください"
                value={content} onChange={e => setContent(e.target.value)}
                className={textareaCls} />
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
