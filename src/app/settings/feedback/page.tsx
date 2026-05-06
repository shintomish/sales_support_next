'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Toast from '@/components/Toast';

type FeedbackType = 'bug' | 'request' | 'other';

const TYPE_OPTIONS: { value: FeedbackType; label: string; description: string }[] = [
  { value: 'bug',     label: '🐞 バグ報告', description: '動作がおかしい・エラーが出るなど' },
  { value: 'request', label: '✨ 要望',     description: '改善案・新機能のリクエスト' },
  { value: 'other',   label: '💬 その他',   description: '質問・コメントなど' },
];

export default function FeedbackPage() {
  const [type, setType]       = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [url, setUrl]         = useState('');
  const [busy, setBusy]       = useState(false);
  const [toast, setToast]     = useState<string | null>(null);

  // フォーム表示時に、直前訪問ページの URL をプリフィル（編集可能）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const last = sessionStorage.getItem('lastVisitedUrl');
      if (last) setUrl(last);
    } catch {}
  }, []);

  const submit = async () => {
    if (!subject.trim() || !body.trim()) {
      alert('件名と内容を入力してください');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post('/api/v1/feedback', {
        type,
        subject: subject.trim(),
        body:    body.trim(),
        url:     url.trim() || null,
      });
      setSubject(''); setBody(''); setType('bug');
      setToast('送信しました。ご報告ありがとうございます。');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '送信に失敗しました';
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <Toast message={toast} onClose={() => setToast(null)} />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">不具合・要望を送る</h1>
      <p className="text-xs text-gray-400 mb-6">
        運用中に気になる点・改善要望があれば、ここから運営担当（shintomi）に直接届きます。<br />
        投稿内容と画面 URL・ブラウザ情報も自動添付されます。
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        {/* 種別 */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">種別</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`text-left p-3 rounded-md border text-sm transition-colors ${
                  type === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 発生した画面 URL */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            発生した画面 URL <span className="text-gray-400">(自動入力・編集可)</span>
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3000/project-mails など"
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1">
            このページに来る直前に開いていた画面が初期値で入っています。違っていれば書き換えてください。
          </p>
        </div>

        {/* 件名 */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">件名</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例: 案件メールの一覧で、検索ボタンを押すと画面が固まる"
            maxLength={255}
          />
        </div>

        {/* 内容 */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            内容 <span className="text-gray-400">(再現手順・期待する挙動など)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={10000}
            placeholder={`再現手順:\n1. \n2. \n\n発生したこと:\n\n期待していたこと:`}
            className="w-full border border-gray-200 rounded-md p-3 text-sm font-mono whitespace-pre-wrap resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {body.length} / 10,000 文字
          </div>
        </div>

        {/* 送信 */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button
            onClick={submit}
            disabled={busy || !subject.trim() || !body.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? '送信中...' : '送信する'}
          </Button>
        </div>
      </div>
    </div>
  );
}
