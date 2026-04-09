'use client';

import { useEffect, useState } from 'react';
import axios from '@/lib/axios';

interface EmailBodyTemplate {
  id?: number;
  name: string;
  name_en: string;
  department: string;
  position: string;
  email: string;
  mobile: string;
}

const EMPTY: EmailBodyTemplate = {
  name: '', name_en: '', department: '', position: '', email: '', mobile: '',
};

export default function EmailTemplatePage() {
  const [form, setForm] = useState<EmailBodyTemplate>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get('/api/v1/email-body-templates/me')
      .then(res => { if (res.data) setForm({ ...EMPTY, ...res.data }); })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put('/api/v1/email-body-templates/me', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const preview = `【メール本文イメージ】

●● 様

いつも大変お世話になっております。
株式会社アイゼン・ソリューションの${form.name || '（氏名）'}です。

（本文）

お忙しいところ大変恐れ入りますが、ご検討いただけますと幸いでございます。
何卒よろしくお願いいたします。
_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/
　　株式会社アイゼン・ソリューション
　${form.department || '（所属部署）'}
　${form.position || '（役職）'}
　${form.name || '（氏名）'}${form.name_en ? `（${form.name_en}）` : ''}

　〒332-0017
　埼玉県川口市栄町3-12-11 コスモ川口栄町2F
　Tel：048-253-3922　Fax：048-271-9355

　E-Mail：${form.email || '（メールアドレス）'}
　Mobile：${form.mobile || '（携帯電話）'}

　URL:https://www.aizen-sol.co.jp
_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/`;

  if (loading) return <div className="p-8 text-gray-500">読み込み中...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">メール署名テンプレート</h1>
      <p className="text-sm text-gray-500 mb-6">提案メール・一斉配信メールの冒頭挨拶・署名に自動挿入されます。</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">① 氏名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="新冨　泰明"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">② 英字氏名</label>
            <input
              type="text"
              value={form.name_en}
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
              placeholder="Yasuaki Shintomi"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">③ 所属部署</label>
            <input
              type="text"
              value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="第1営業部"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">④ 役職</label>
            <input
              type="text"
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              placeholder="執行役員"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">⑤ メールアドレス</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="y-shintomi@aizen-sol.co.jp"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">⑥ 携帯電話</label>
            <input
              type="text"
              value={form.mobile}
              onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
              placeholder="080-3268-9820"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : saved ? '保存しました！' : '保存する'}
          </button>
        </form>

        {/* プレビュー */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
          <pre className="bg-gray-50 border border-gray-200 rounded-md p-4 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  );
}
