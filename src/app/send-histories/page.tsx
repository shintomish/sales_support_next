'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from '@/lib/axios'
import { useRouter } from 'next/navigation'

// ── 型定義 ────────────────────────────────────────────────

type SendHistory = {
  id: number
  _isDemo?: true
  send_type: 'proposal' | 'bulk' | 'matching_proposal'
  status: 'sent' | 'failed'
  to_address: string
  to_name: string | null
  subject: string
  sent_at: string | null
  sent_by: string | null
  error_message: string | null
  project_mail_id: number | null
  project_mail_title: string | null
  engineer_id: number | null
  engineer_name: string | null
  public_project_id: number | null
  public_project_title: string | null
  // 将来実装: 返信紐づけ
  replied_at?: string | null
  reply_subject?: string | null
  reply_body_snippet?: string | null
}

type Paginated = {
  data: SendHistory[]
  current_page: number
  last_page: number
  total: number
}

// ── デモ用モックデータ（返信紐づけ後の画面イメージ） ────────

const DEMO_DATA: SendHistory[] = [
  {
    id: 9001, _isDemo: true,
    send_type: 'matching_proposal',
    status: 'sent',
    to_address: 'tanaka@techrecruit.co.jp',
    to_name: '田中 博史',
    subject: '【技術者ご紹介】React/Vue.jsエンジニアのご紹介',
    sent_at: '2026-04-10T10:15:00+09:00',
    sent_by: '新冨 泰明',
    error_message: null,
    project_mail_id: null,
    project_mail_title: null,
    engineer_id: 1,
    engineer_name: '山田 太郎',
    public_project_id: 1,
    public_project_title: 'React/Next.js 開発案件（渋谷）',
    // 返信あり
    replied_at: '2026-04-10T14:23:00+09:00',
    reply_subject: 'Re: 【技術者ご紹介】React/Vue.jsエンジニアのご紹介',
    reply_body_snippet: 'ご連絡ありがとうございます。ご紹介いただいた山田様、ぜひ面談を設定させていただきたいと思います。来週はいかがでしょうか。',
  },
  {
    id: 9002, _isDemo: true,
    send_type: 'proposal',
    status: 'sent',
    to_address: 'sato@nextsystems.co.jp',
    to_name: '佐藤 健二',
    subject: '【技術者ご紹介】Java/Springエンジニアのご案内',
    sent_at: '2026-04-11T09:30:00+09:00',
    sent_by: '新冨 泰明',
    error_message: null,
    project_mail_id: 1372,
    project_mail_title: 'Java/Spring バックエンド開発（六本木）',
    engineer_id: null,
    engineer_name: null,
    public_project_id: null,
    public_project_title: null,
    // 返信なし
    replied_at: null,
    reply_subject: null,
    reply_body_snippet: null,
  },
  {
    id: 9003, _isDemo: true,
    send_type: 'bulk',
    status: 'sent',
    to_address: 'yamamoto@itstaff.jp',
    to_name: '山本 友紀',
    subject: '【エンジニアご紹介】3名の技術者をご案内',
    sent_at: '2026-04-11T11:00:00+09:00',
    sent_by: '新冨 泰明',
    error_message: null,
    project_mail_id: 1366,
    project_mail_title: 'Python/Django データ基盤開発',
    engineer_id: null,
    engineer_name: null,
    public_project_id: null,
    public_project_title: null,
    // 返信あり
    replied_at: '2026-04-11T15:45:00+09:00',
    reply_subject: 'Re: 【エンジニアご紹介】3名の技術者をご案内',
    reply_body_snippet: '早速のご紹介ありがとうございます。3名のうち、Aさんと Cさんのスキルシートをお送りいただけますでしょうか。',
  },
  {
    id: 9004, _isDemo: true,
    send_type: 'matching_proposal',
    status: 'sent',
    to_address: 'ito@bridge-tech.co.jp',
    to_name: '伊藤 美咲',
    subject: '【技術者ご紹介】インフラ/AWS エンジニアのご提案',
    sent_at: '2026-04-12T08:50:00+09:00',
    sent_by: '新冨 泰明',
    error_message: null,
    project_mail_id: null,
    project_mail_title: null,
    engineer_id: 3,
    engineer_name: '鈴木 一郎',
    public_project_id: 5,
    public_project_title: 'AWS インフラ構築・運用（フルリモート）',
    // 返信なし
    replied_at: null,
    reply_subject: null,
    reply_body_snippet: null,
  },
]

// ── 本文プレビューモーダル ────────────────────────────────

function BodyModal({
  id,
  subject,
  isDemo,
  demoBody,
  onClose,
}: {
  id: number
  subject: string
  isDemo: boolean
  demoBody?: string
  onClose: () => void
}) {
  const [body, setBody] = useState<string | null>(isDemo ? (demoBody ?? null) : null)

  useEffect(() => {
    if (isDemo) return
    axios.get(`/api/v1/send-histories/${id}`)
      .then(res => setBody(res.data.body))
      .catch(() => setBody('（取得に失敗しました）'))
  }, [id, isDemo])

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-sm font-bold text-gray-800 truncate flex-1">{subject}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {body === null ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 返信プレビューモーダル ────────────────────────────────

function ReplyModal({
  history,
  onClose,
}: {
  history: SendHistory
  onClose: () => void
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-xl shadow-2xl overflow-hidden"
      >
        {/* ヘッダー */}
        <div className="bg-blue-50 px-5 py-3 border-b border-blue-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-700 mb-0.5">📩 受信メール（返信）</p>
            <p className="text-sm font-semibold text-gray-800 truncate max-w-sm">{history.reply_subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
        </div>

        {/* メタ情報 */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs space-y-1 text-gray-600">
          <div className="flex gap-2">
            <span className="w-14 text-gray-400 shrink-0">差出人</span>
            <span>{history.to_name ? `${history.to_name} ＜${history.to_address}＞` : history.to_address}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 text-gray-400 shrink-0">受信日時</span>
            <span>{formatDateTime(history.replied_at ?? null)}</span>
          </div>
        </div>

        {/* 送信メールとの対応 */}
        <div className="px-5 py-3 bg-blue-50/50 border-b border-gray-200 text-xs text-gray-600">
          <p className="text-gray-400 mb-1">紐づいた送信メール</p>
          <p className="text-gray-700 font-medium">📤 {history.subject}</p>
          <p className="text-gray-400 mt-0.5">{formatDateTime(history.sent_at)}</p>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-2">本文（抜粋）</p>
          <p className="text-sm text-gray-700 leading-relaxed">{history.reply_body_snippet}</p>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ユーティリティ ────────────────────────────────────────

const SEND_TYPE_LABEL: Record<string, string> = {
  proposal:          '個別提案',
  bulk:              'まとめて提案',
  matching_proposal: 'マッチング提案',
}

const SEND_TYPE_COLOR: Record<string, string> = {
  proposal:          'bg-blue-100 text-blue-700',
  bulk:              'bg-purple-100 text-purple-700',
  matching_proposal: 'bg-teal-100 text-teal-700',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 行コンポーネント ──────────────────────────────────────

function HistoryRow({
  h,
  isDemo,
  onPreview,
  onReplyPreview,
  router,
}: {
  h: SendHistory
  isDemo: boolean
  onPreview: (id: number, subject: string) => void
  onReplyPreview: (h: SendHistory) => void
  router: ReturnType<typeof useRouter>
}) {
  const hasReply = !!h.replied_at

  return (
    <tr className="hover:bg-blue-50 transition-colors border-b border-gray-100">
      {/* デモバッジ */}
      {isDemo && (
        <td className="px-2 py-3 text-center">
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">デモ</span>
        </td>
      )}
      {!isDemo && <td className="px-2 py-3" />}

      {/* 送信日時 */}
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
        {formatDateTime(h.sent_at)}
      </td>

      {/* 種別バッジ */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEND_TYPE_COLOR[h.send_type] ?? 'bg-gray-100 text-gray-600'}`}>
          {SEND_TYPE_LABEL[h.send_type] ?? h.send_type}
        </span>
      </td>

      {/* 宛先 */}
      <td className="px-4 py-3">
        <p className="text-gray-800 text-xs font-medium truncate max-w-[150px]">
          {h.to_name ?? h.to_address}
        </p>
        {h.to_name && (
          <p className="text-gray-400 text-xs truncate max-w-[150px]">{h.to_address}</p>
        )}
      </td>

      {/* 件名 */}
      <td className="px-4 py-3 max-w-[200px]">
        <button
          onClick={() => onPreview(h.id, h.subject)}
          className="text-blue-600 hover:underline text-left text-xs truncate block w-full"
          title={h.subject}
        >
          {h.subject}
        </button>
      </td>

      {/* 返信ステータス ★ 新列 */}
      <td className="px-4 py-3 whitespace-nowrap">
        {hasReply ? (
          <button
            onClick={() => onReplyPreview(h)}
            className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-xs font-medium transition-colors"
          >
            <span>📩</span>
            <span>返信あり</span>
          </button>
        ) : (
          <span className="text-xs text-gray-300">未返信</span>
        )}
        {hasReply && (
          <p className="text-xs text-gray-400 mt-0.5 pl-1">{formatDateTime(h.replied_at ?? null)}</p>
        )}
      </td>

      {/* 紐づき情報 */}
      <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
        {h.send_type === 'matching_proposal' && h.engineer_name && (
          <div className="space-y-0.5">
            <button
              onClick={() => router.push(`/engineers/${h.engineer_id}`)}
              className="text-blue-600 hover:underline block truncate max-w-full"
            >
              🧑‍💻 {h.engineer_name}
            </button>
            {h.public_project_title && (
              <button
                onClick={() => router.push(`/public-projects/${h.public_project_id}`)}
                className="text-blue-600 hover:underline block truncate max-w-full"
              >
                🔍 {h.public_project_title}
              </button>
            )}
          </div>
        )}
        {(h.send_type === 'proposal' || h.send_type === 'bulk') && h.project_mail_title && (
          <button
            onClick={() => router.push(`/matching/${h.project_mail_id}`)}
            className="text-blue-600 hover:underline block truncate max-w-full"
          >
            📨 {h.project_mail_title}
          </button>
        )}
        {!h.project_mail_title && !h.engineer_name && (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* 送信ステータス */}
      <td className="px-4 py-3 whitespace-nowrap">
        {h.status === 'sent' ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">送信済み</span>
        ) : (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 cursor-help"
            title={h.error_message ?? ''}
          >
            失敗
          </span>
        )}
      </td>

      {/* 送信者 */}
      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
        {h.sent_by ?? '—'}
      </td>
    </tr>
  )
}

// ── メインページ ──────────────────────────────────────────

export default function SendHistoriesPage() {
  const router = useRouter()

  const [data, setData] = useState<Paginated | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [showDemo, setShowDemo] = useState(false)

  // フィルター
  const [sendType, setSendType] = useState('')
  const [status, setStatus]     = useState('')
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  // モーダル
  const [previewId, setPreviewId]     = useState<{ id: number; subject: string; isDemo: boolean; demoBody?: string } | null>(null)
  const [replyPreview, setReplyPreview] = useState<SendHistory | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/v1/send-histories', {
        params: {
          page,
          per_page: 30,
          send_type: sendType || undefined,
          status:    status    || undefined,
          search:    search    || undefined,
          date_from: dateFrom  || undefined,
          date_to:   dateTo    || undefined,
        },
      })
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, sendType, status, search, dateFrom, dateTo])

  useEffect(() => { fetch() }, [fetch])

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value)
    setPage(1)
  }

  // デモ表示時は先頭にデモデータを結合
  const displayRows: SendHistory[] = showDemo
    ? [...DEMO_DATA, ...(data?.data ?? [])]
    : (data?.data ?? [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 本文プレビューモーダル */}
      {previewId && (
        <BodyModal
          id={previewId.id}
          subject={previewId.subject}
          isDemo={previewId.isDemo}
          demoBody={previewId.demoBody}
          onClose={() => setPreviewId(null)}
        />
      )}

      {/* 返信プレビューモーダル */}
      {replyPreview && (
        <ReplyModal history={replyPreview} onClose={() => setReplyPreview(null)} />
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">送信履歴</h1>
          {data && !showDemo && (
            <p className="text-sm text-gray-500 mt-1">全 {data.total} 件</p>
          )}
        </div>

        {/* デモ切替ボタン */}
        <button
          onClick={() => setShowDemo(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            showDemo
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>{showDemo ? '🔶' : '👁'}</span>
          {showDemo ? '返信紐づけ デモ表示中' : '返信紐づけ後のイメージを見る'}
        </button>
      </div>

      {/* デモ説明バナー */}
      {showDemo && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">🔶 デモ表示モード</p>
          <p className="text-xs leading-relaxed">
            上部の4件はモックデータです。<strong>「返信あり」</strong>をクリックすると、受信メールとの紐づきイメージを確認できます。
            実装時は <code className="bg-amber-100 px-1 rounded">mail_send_histories.to_address</code> と
            受信メールの <code className="bg-amber-100 px-1 rounded">from_address</code> を照合して自動紐づけします。
          </p>
        </div>
      )}

      {/* フィルターバー */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">種別</label>
          <select
            value={sendType}
            onChange={handleFilterChange(setSendType)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">すべて</option>
            <option value="proposal">個別提案</option>
            <option value="bulk">まとめて提案</option>
            <option value="matching_proposal">マッチング提案</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">ステータス</label>
          <select
            value={status}
            onChange={handleFilterChange(setStatus)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">すべて</option>
            <option value="sent">送信済み</option>
            <option value="failed">失敗</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">送信日 From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={handleFilterChange(setDateFrom)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">送信日 To</label>
          <input
            type="date"
            value={dateTo}
            onChange={handleFilterChange(setDateTo)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">宛先・件名で検索</label>
          <input
            type="text"
            placeholder="example@example.com, 件名..."
            value={search}
            onChange={handleFilterChange(setSearch)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {(sendType || status || search || dateFrom || dateTo) && (
          <button
            onClick={() => { setSendType(''); setStatus(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded"
          >
            リセット
          </button>
        )}
      </div>

      {/* テーブル */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 330px)' }}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-3 w-12" />
                <th className="px-4 py-3 text-left whitespace-nowrap">送信日時</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">種別</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">宛先</th>
                <th className="px-4 py-3 text-left">件名</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">
                  返信
                  {showDemo && <span className="ml-1 text-xs text-amber-600 font-normal">（デモ）</span>}
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap">紐づき情報</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">送信状態</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">送信者</th>
              </tr>
            </thead>
            <tbody>
              {loading && !showDemo ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">読み込み中...</td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">送信履歴がありません</td>
                </tr>
              ) : displayRows.map(h => (
                <HistoryRow
                  key={h.id}
                  h={h}
                  isDemo={!!h._isDemo}
                  onPreview={(id, subject) => setPreviewId({ id, subject, isDemo: !!h._isDemo, demoBody: h._isDemo ? '（デモデータのため本文は省略）' : undefined })}
                  onReplyPreview={setReplyPreview}
                  router={router}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ページネーション */}
      {!showDemo && data && data.last_page > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data.last_page }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${
                p === data.current_page
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
