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
  sender_display_name?: string;
}

// 送信者名 (From ヘッダ表示名) のプリセット 2 種。英文がデフォルト。
const SENDER_PRESETS = [
  { value: 'Aizen Solution SES Support', label: 'Aizen Solution SES Support （英文）' },
  { value: 'アイゼン・ソリューション (営業)', label: 'アイゼン・ソリューション (営業)（和文）' },
];
const SENDER_DEFAULT = SENDER_PRESETS[0].value;

const EMPTY: EmailBodyTemplate = {
  name: '', name_en: '', department: '', position: '', email: '', mobile: '', sender_display_name: SENDER_DEFAULT,
};

function buildPreview(form: EmailBodyTemplate) {
  return `●● 様

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
}

export default function EmailTemplatePage() {
  const [form, setForm] = useState<EmailBodyTemplate>(EMPTY);
  const [previewText, setPreviewText] = useState(buildPreview(EMPTY));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // ユーザがプレビューを直接編集したかを追跡。false の間はフォーム変更時に自動同期する。
  const [previewEdited, setPreviewEdited] = useState(false);

  useEffect(() => {
    axios.get('/api/v1/email-body-templates/me')
      .then(res => {
        if (res.data) {
          const loaded = { ...EMPTY, ...res.data };
          // sender_display_name が null/空 または プリセット外 の場合は英文デフォルトに正規化
          if (!loaded.sender_display_name || !SENDER_PRESETS.some(p => p.value === loaded.sender_display_name)) {
            loaded.sender_display_name = SENDER_DEFAULT;
          }
          setForm(loaded);
          // body_text 保存済 = 過去にプレビューを手動編集した可能性 → 手動編集モードで再開
          if (res.data.body_text) {
            setPreviewText(res.data.body_text);
            const wouldGenerate = buildPreview(loaded);
            // 既存 body_text が今のフォームから自動生成可能な形と一致するなら手動編集なし扱い
            setPreviewEdited(res.data.body_text !== wouldGenerate);
          } else {
            setPreviewText(buildPreview(loaded));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // フォーム変更時、プレビューが未編集なら自動同期 (バグ #1: フォーム変更が body_text に反映されない問題対策)
  useEffect(() => {
    if (!loading && !previewEdited) {
      setPreviewText(buildPreview(form));
    }
  }, [form, previewEdited, loading]);

  const syncPreview = () => {
    setPreviewText(buildPreview(form));
    setPreviewEdited(false); // 同期したので「未編集」状態に戻す
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put('/api/v1/email-body-templates/me', { ...form, body_text: previewText });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

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

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ⑦ 送信者名（From ヘッダ表示名）
              <span className="text-xs text-gray-500 font-normal ml-2">提案・一斉配信メールの From: に使用</span>
            </label>
            <div className="space-y-2">
              {SENDER_PRESETS.map(preset => (
                <label key={preset.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="sender_display_name_preset"
                    value={preset.value}
                    checked={form.sender_display_name === preset.value}
                    onChange={e => setForm(f => ({ ...f, sender_display_name: e.target.value }))}
                  />
                  <span>{preset.label}</span>
                  <span className="text-xs text-gray-400 font-mono">{preset.value} &lt;outsource@aizen-sol.co.jp&gt;</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : saved ? '保存しました！' : '保存する'}
          </button>
        </form>

        {/* プレビュー（編集可能） */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">プレビュー（直接編集可能）</p>
            <button
              type="button"
              onClick={syncPreview}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              ↩ フォームから反映
            </button>
          </div>
          <textarea
            value={previewText}
            onChange={e => { setPreviewText(e.target.value); setPreviewEdited(true); }}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-md p-4 text-xs text-gray-700 leading-relaxed font-mono resize-none"
            style={{ minHeight: 420 }}
          />
          {previewEdited && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ プレビューを手動編集しています。フォーム変更は自動反映されません (「↩ フォームから反映」で再同期可)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
