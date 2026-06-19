'use client';

import { useEffect, useState } from 'react';
import axios from '@/lib/axios';

type DeliveryPurpose = 'standard' | 'real_spot';

const PURPOSES: { value: DeliveryPurpose; label: string }[] = [
  { value: 'standard',  label: '配信用' },
  { value: 'real_spot', label: 'リアル案件用' },
];
const purposeLabel = (p: string) => PURPOSES.find(x => x.value === p)?.label ?? p;

interface DeliveryTemplate {
  id: number;
  purpose: DeliveryPurpose;
  name: string;
  subject: string | null;
  body_text: string | null;
  is_active: boolean;
}

type EditForm = {
  id?: number;
  purpose: DeliveryPurpose;
  name: string;
  subject: string;
  body_text: string;
  is_active: boolean;
};

// 新規テンプレ本文のひな型。<%Name%>(送信時に宛先名へ置換)・<送信者>(署名設定の氏名へ置換)を
// 最初から入れておく。署名ブロックは書かない（配信フォームで選択時に署名設定から自動付与される）。
const BODY_SCAFFOLD = `<%Name%> 様

いつもお世話になっております。
株式会社アイゼン・ソリューションの<送信者>です。

（ここに案内文を記入してください）

何かご不明な点やご質問がございましたら、お気軽にご連絡いただければ幸いです。
引き続き何卒よろしくお願いいたします。
--`;

const EMPTY: EditForm = { purpose: 'standard', name: '', subject: '', body_text: BODY_SCAFFOLD, is_active: true };

export default function DeliveryTemplatesPage() {
  const [templates, setTemplates] = useState<DeliveryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EditForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    axios.get('/api/v1/email-delivery-templates')
      .then(res => setTemplates(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startNew = () => { setForm(EMPTY); setError(''); };
  const startEdit = (t: DeliveryTemplate) => {
    setForm({
      id: t.id,
      purpose: t.purpose,
      name: t.name,
      subject: t.subject ?? '',
      body_text: t.body_text ?? '',
      is_active: t.is_active,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('テンプレ名は必須です'); return; }
    setSaving(true);
    setError('');
    const payload = {
      purpose: form.purpose,
      name: form.name,
      subject: form.subject || null,
      body_text: form.body_text || null,
      is_active: form.is_active,
    };
    try {
      if (form.id) {
        await axios.put(`/api/v1/email-delivery-templates/${form.id}`, payload);
      } else {
        await axios.post('/api/v1/email-delivery-templates', payload);
      }
      setForm(EMPTY);
      load();
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: DeliveryTemplate) => {
    if (!confirm(`「${t.name}」を削除しますか？`)) return;
    try {
      await axios.delete(`/api/v1/email-delivery-templates/${t.id}`);
      if (form.id === t.id) setForm(EMPTY);
      load();
    } catch {
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">配信テンプレ</h1>
      <p className="text-sm text-gray-500 mb-6">
        一斉配信フォームで目的別に選んで件名/本文をプリフィルできるテンプレート（テナント共有）。
        「配信用」と「リアル案件用」で文面を分けて反応率を改善します。
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 一覧 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">登録済みテンプレ</h2>
            <button
              type="button"
              onClick={startNew}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              + 新規作成
            </button>
          </div>
          {loading ? (
            <div className="text-gray-500 text-sm">読み込み中...</div>
          ) : templates.length === 0 ? (
            <div className="text-gray-400 text-sm border border-dashed border-gray-200 rounded-md p-6 text-center">
              テンプレが未登録です。右のフォームから作成してください。
            </div>
          ) : (
            <ul className="space-y-2">
              {templates.map(t => (
                <li
                  key={t.id}
                  className={`border rounded-md p-3 ${form.id === t.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{purposeLabel(t.purpose)}</span>
                        {!t.is_active && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">無効</span>}
                        <span className="text-sm font-medium text-gray-800 truncate">{t.name}</span>
                      </div>
                      {t.subject && <p className="text-xs text-gray-500 mt-1 truncate">件名: {t.subject}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => startEdit(t)} className="text-xs text-blue-600 hover:text-blue-800">編集</button>
                      <button type="button" onClick={() => handleDelete(t)} className="text-xs text-red-500 hover:text-red-700">削除</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4 lg:border-l lg:border-gray-200 lg:pl-8">
          <h2 className="text-sm font-semibold text-gray-700">{form.id ? 'テンプレを編集' : '新しいテンプレ'}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">配信目的 <span className="text-red-500">*</span></label>
            <div className="flex gap-6">
              {PURPOSES.map(p => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="purpose"
                    value={p.value}
                    checked={form.purpose === p.value}
                    onChange={() => setForm(f => ({ ...f, purpose: p.value }))}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">テンプレ名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="6月配信用 / 超リアル案件用 など"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="【ご案内】稼働可能なエンジニアのご紹介"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
            <textarea
              value={form.body_text}
              onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
              rows={12}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <ul className="text-xs text-gray-400 mt-1 space-y-0.5 leading-snug">
              <li>・<code className="text-gray-500">&lt;%Name%&gt;</code> … 送信時に各宛先の名前へ自動置換</li>
              <li>・<code className="text-gray-500">&lt;送信者&gt;</code> … 配信時に「メール署名設定」の氏名へ置換</li>
              <li>・署名ブロックは書かない（配信フォームで選択時に署名設定から自動で付きます）</li>
            </ul>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="accent-blue-600"
            />
            有効（配信フォームの選択肢に表示）
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white py-2 px-5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : form.id ? '更新する' : '作成する'}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={startNew}
                className="py-2 px-5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
