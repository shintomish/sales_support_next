'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Toast from '@/components/Toast';

interface Recipient {
  id: number;
  email: string;
  name: string | null;
  report_type: string;
  is_active: boolean;
  created_at: string;
}

const REPORT_TYPE = 'daily_sales';

export default function ReportRecipientsPage() {
  const [items, setItems]       = useState<Recipient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  // 新規追加フォーム
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName]   = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ items: Recipient[] }>(`/api/v1/settings/report-recipients?report_type=${REPORT_TYPE}`);
      setItems(res.data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const add = async () => {
    if (!newEmail) return;
    setBusy(true);
    try {
      await apiClient.post('/api/v1/settings/report-recipients', {
        email:       newEmail,
        name:        newName || null,
        report_type: REPORT_TYPE,
      });
      setNewEmail(''); setNewName('');
      setToast('追加しました');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '追加に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: Recipient) => {
    setBusy(true);
    try {
      const res = await apiClient.put<Recipient>(`/api/v1/settings/report-recipients/${r.id}`, {
        email:     r.email,
        name:      r.name,
        is_active: !r.is_active,
      });
      setItems((prev) => prev.map((x) => x.id === r.id ? res.data : x));
      setToast(`${res.data.is_active ? '配信を有効' : '配信を停止'}にしました`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '更新に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Recipient) => {
    if (!confirm(`${r.email} を削除します。よろしいですか？`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/api/v1/settings/report-recipients/${r.id}`);
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      setToast('削除しました');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '削除に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">日次レポート配信先</h1>
      <p className="text-xs text-gray-400 mb-6">毎朝08:30に「昨日の動き＋今日の要対応リスト」を AWS SES 経由で送信します。配信を一時停止したい場合は、その行の「配信停止」ボタンを押してください。</p>

      {/* 追加フォーム */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">新規配信先を追加</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">メールアドレス</label>
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="sales@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">表示名（任意）</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="営業部 山田" />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add} disabled={busy || !newEmail} className="bg-blue-600 hover:bg-blue-700 text-white">
            {busy ? '追加中...' : '+ 追加'}
          </Button>
        </div>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">メールアドレス</th>
              <th className="text-left px-3 py-2 font-semibold w-[160px]">表示名</th>
              <th className="text-center px-3 py-2 font-semibold w-[110px]">状態</th>
              <th className="text-center px-3 py-2 font-semibold w-[160px]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">配信先が登録されていません</td></tr>
            ) : items.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2 text-gray-600">{r.name ?? '-'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.is_active ? '配信中' : '停止中'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center space-x-1">
                  <button
                    onClick={() => toggleActive(r)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    {r.is_active ? '停止' : '再開'}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
