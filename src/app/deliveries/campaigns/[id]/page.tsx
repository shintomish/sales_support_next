'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'
import { useRouter, useParams } from 'next/navigation'
import type { ApiError } from '@/lib/error-helpers'
import { extractDomain } from '@/lib/mailDomain'

// ── 型定義 ────────────────────────────────────────────────

type SendHistory = {
  id: number
  email: string
  name: string | null
  status: 'sent' | 'failed' | 'replied'
  sent_at: string | null
  resent_at: string | null
  parent_history_id: number | null
  replied_at: string | null
  reply_subject: string | null
  reply_received_at: string | null
  reply_body_snippet?: string | null
  reply_body_text?: string | null
  reply_from?: string | null
  reply_from_name?: string | null
}

type Campaign = {
  id: number
  project_mail_id: number | null
  project_title: string | null
  source_domain: string | null
  subject: string
  body: string
  sent_at: string | null
  sent_by: string | null
  total_count: number
  success_count: number
  failed_count: number
  histories: SendHistory[]
}

// ── ヘルパー ──────────────────────────────────────────────

const formatDateTime = (s: string | null | undefined): string => {
  if (!s) return '—'
  return new Date(s).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

// 本文の <%Name%> を name に置換（バックエンドが配信時に行う処理をプレビューで再現）
const applyName = (body: string, name: string | null): string => {
  return (body ?? '').replace(/<%Name%>/g, name ?? '')
}

const LS_SUMMARY = 'campaign_detail_summary_open'
const LS_FILTER = 'campaign_detail_filter_open'

// ── メインページ ──────────────────────────────────────────

export default function CampaignDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | 'sent' | 'failed' | 'replied'>('')
  const [search, setSearch] = useState('')
  const [resendingId, setResendingId] = useState<number | null>(null)
  // ドメイン一致警告モーダル: ソース企業ドメインと宛先ドメインが一致した場合のみ表示
  const [resendWarn, setResendWarn] = useState<SendHistory | null>(null)
  const PAGE_SIZE = 200
  const [page, setPage] = useState(1)

  // 折りたたみ/展開状態（localStorage で永続化）
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [filterOpen, setFilterOpen] = useState(true)
  // 行アコーディオン展開（同時に1件のみ）
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedTab, setExpandedTab] = useState<'sent' | 'reply'>('sent')

  // 初回マウント時に localStorage から復元
  useEffect(() => {
    if (typeof window === 'undefined') return
    const s = localStorage.getItem(LS_SUMMARY)
    const f = localStorage.getItem(LS_FILTER)
    if (s !== null) setSummaryOpen(s !== '0')
    if (f !== null) setFilterOpen(f !== '0')
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(LS_SUMMARY, summaryOpen ? '1' : '0')
  }, [summaryOpen])
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(LS_FILTER, filterOpen ? '1' : '0')
  }, [filterOpen])

  const fetchCampaign = () => {
    axios.get(`/api/v1/delivery-campaigns/${id}`)
      .then(res => setCampaign(res.data))
      .catch(() => router.push('/deliveries'))
  }

  useEffect(() => {
    fetchCampaign()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 実送信処理（モーダル/confirm 後に呼ぶ）
  const executeResend = async (h: SendHistory) => {
    setResendingId(h.id)
    try {
      await axios.post(`/api/v1/delivery-campaigns/${id}/histories/${h.id}/resend`)
      fetchCampaign()
    } catch (e) {
      const err = e as ApiError
      alert(err.response?.data?.message ?? '再送信に失敗しました')
    } finally {
      setResendingId(null)
    }
  }

  const handleResend = async (h: SendHistory) => {
    // 宛先ドメインがキャンペーンのソース企業ドメインと一致する場合は警告モーダル
    const recipientDomain = extractDomain(h.email)
    if (campaign?.source_domain && recipientDomain && recipientDomain === campaign.source_domain) {
      setResendWarn(h)
      return
    }
    // 通常フロー
    if (!confirm(`${h.email} に再送信しますか？`)) return
    await executeResend(h)
  }

  // 行アコーディオン: クリックで開閉。新規展開時は返信があれば「受信」、なければ「送信」をデフォルトに
  const toggleExpand = (h: SendHistory) => {
    if (expandedId === h.id) {
      setExpandedId(null)
    } else {
      setExpandedId(h.id)
      setExpandedTab(h.status === 'replied' && h.replied_at ? 'reply' : 'sent')
    }
  }

  const filtered = campaign?.histories.filter(h => {
    if (statusFilter && h.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!h.email.toLowerCase().includes(s) && !(h.name ?? '').toLowerCase().includes(s)) return false
    }
    return true
  }) ?? []

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [totalPages, page])

  const repliedCount = campaign?.histories.filter(h => h.status === 'replied').length ?? 0
  const replyRate = campaign && campaign.success_count > 0
    ? Number((repliedCount / campaign.success_count * 100).toFixed(2))
    : 0

  if (!campaign) {
    return <div className="p-6 text-gray-400">読み込み中...</div>
  }

  // ── 行アコーディオン展開エリア ──────────────────────────
  const renderExpandedPanel = (h: SendHistory) => {
    const hasReply = h.status === 'replied' && !!h.replied_at
    const sentBody = applyName(campaign.body, h.name)
    const replyBody = h.reply_body_text ?? h.reply_body_snippet ?? '—'
    const showReply = expandedTab === 'reply' && hasReply
    return (
      <div className="px-3 md:px-4 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100">
        {/* タブ */}
        <div className="flex border-b border-gray-200 mb-3">
          <button
            type="button"
            onClick={() => setExpandedTab('sent')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              expandedTab === 'sent'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📤 送信
          </button>
          {hasReply && (
            <button
              type="button"
              onClick={() => setExpandedTab('reply')}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                expandedTab === 'reply'
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📩 受信
            </button>
          )}
        </div>

        {/* 内容 */}
        {showReply ? (
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-[72px_1fr] gap-y-1 gap-x-3">
              <span className="text-gray-400">件名</span>
              <span className="text-gray-800 break-words">{h.reply_subject ?? '—'}</span>
              <span className="text-gray-400">差出人</span>
              <span className="text-gray-800 break-all">
                {h.reply_from_name ? `${h.reply_from_name} ＜${h.reply_from ?? h.email}＞` : (h.reply_from ?? h.email)}
              </span>
              <span className="text-gray-400">受信日時</span>
              <span className="text-gray-800">{formatDateTime(h.replied_at)}</span>
            </div>
            <div>
              <p className="text-gray-400 mb-1">本文</p>
              <pre className="bg-white border border-gray-200 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">{replyBody}</pre>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-[72px_1fr] gap-y-1 gap-x-3">
              <span className="text-gray-400">件名</span>
              <span className="text-gray-800 break-words">{campaign.subject}</span>
              <span className="text-gray-400">宛先</span>
              <span className="text-gray-800 break-all">
                {h.name ? `${h.name} ＜${h.email}＞` : h.email}
              </span>
              <span className="text-gray-400">送信日時</span>
              <span className="text-gray-800">{formatDateTime(h.sent_at)}</span>
              {h.resent_at && (
                <>
                  <span className="text-gray-400">再送信日時</span>
                  <span className="text-gray-800">{formatDateTime(h.resent_at)}</span>
                </>
              )}
            </div>
            <div>
              <p className="text-gray-400 mb-1">本文</p>
              <pre className="bg-white border border-gray-200 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">{sentBody}</pre>
            </div>
          </div>
        )}

        {/* アクション */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={() => setExpandedId(null)}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
          >
            閉じる
          </button>
          {(h.status === 'sent' || h.status === 'replied' || h.status === 'failed') && (
            <button
              type="button"
              onClick={() => handleResend(h)}
              disabled={resendingId === h.id}
              className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded disabled:opacity-50"
            >
              {resendingId === h.id ? '送信中…' : '再送信'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── 配信履歴行 ──────────────────────────────────────────
  const renderHistoryRow = (h: SendHistory) => {
    const isOpen = expandedId === h.id
    const statusBadge = {
      sent:    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">送信済</span>,
      failed:  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">失敗</span>,
      replied: <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">返信あり</span>,
    }[h.status]
    return (
      <div
        key={h.id}
        className={`${isOpen ? 'bg-blue-50/30' : ''} ${h.parent_history_id ? 'border-l-2 border-l-amber-300' : ''}`}
      >
        <button
          type="button"
          onClick={() => toggleExpand(h)}
          className="w-full text-left hover:bg-gray-50 transition-colors"
        >
          {/* md以上: グリッド行（横スクロールなし） */}
          <div className="hidden md:grid grid-cols-[28px_140px_minmax(160px,1.2fr)_72px_120px_minmax(120px,1.5fr)] gap-2 px-3 py-2.5 items-center">
            <div className="text-gray-400 text-xs">{isOpen ? '▼' : '▶'}</div>
            <div className="text-sm text-gray-800 truncate" title={h.name ?? ''}>
              {h.name ?? '-'}
              {h.parent_history_id && (
                <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">再送</span>
              )}
            </div>
            <div className="text-xs text-gray-600 truncate" title={h.email}>{h.email}</div>
            <div className="text-center">{statusBadge}</div>
            <div className="text-xs text-gray-600 whitespace-nowrap">{formatDateTime(h.sent_at)}</div>
            <div className="text-xs truncate" title={h.reply_subject ?? ''}>
              {h.status === 'replied' && h.reply_subject ? (
                <span className="text-blue-700">📩 {h.reply_subject}</span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>
          </div>
          {/* md未満: カード（縦積み） */}
          <div className="md:hidden flex items-start gap-2 px-3 py-3">
            <div className="text-gray-400 text-xs pt-0.5 shrink-0">{isOpen ? '▼' : '▶'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800 truncate">{h.name ?? '-'}</span>
                {h.parent_history_id && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">再送</span>
                )}
                {statusBadge}
              </div>
              <div className="text-xs text-gray-600 break-all mt-0.5">{h.email}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(h.sent_at)}</div>
              {h.status === 'replied' && h.reply_subject && (
                <div className="text-xs text-blue-700 truncate mt-0.5">📩 {h.reply_subject}</div>
              )}
            </div>
          </div>
        </button>
        {isOpen && renderExpandedPanel(h)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen px-3 md:px-6 py-3 md:py-4 gap-2 md:gap-3">
      {/* 再送信ドメイン一致警告モーダル */}
      {resendWarn && (
        <div
          onClick={() => setResendWarn(null)}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="bg-red-50 px-5 py-3 border-b border-red-200">
              <p className="text-sm font-bold text-red-700">⚠️ 元請けドメインと一致しています</p>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700 space-y-3">
              <p>
                配信先 <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{resendWarn.email}</span> のドメインが、
                この案件の元請けドメイン <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{campaign.source_domain}</span> と一致しています。
              </p>
              <p className="text-xs text-red-600">
                同じ案件を元請けに再送信すると、抜き額が露呈する恐れがあります。
              </p>
              <p>本当に送信しますか？</p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setResendWarn(null)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  const target = resendWarn
                  setResendWarn(null)
                  await executeResend(target)
                }}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                送信する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー（常時表示） */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <button onClick={() => router.push('/deliveries')} className="text-gray-400 hover:text-gray-600 text-sm shrink-0">
          ← 一覧
        </button>
        <h1 className="text-base md:text-xl font-bold text-gray-800 truncate">キャンペーン詳細</h1>
      </div>

      {/* サマリーカード（折りたたみ可） */}
      <div className="flex-shrink-0 bg-white border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setSummaryOpen(v => !v)}
          className="w-full px-3 md:px-4 py-2 flex items-center justify-between gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-gray-400 text-xs shrink-0">{summaryOpen ? '▼' : '▶'}</span>
            <span className="shrink-0">キャンペーン情報</span>
            {!summaryOpen && (
              <span className="text-xs text-gray-500 truncate hidden sm:inline">— {campaign.subject}</span>
            )}
          </span>
          {/* 集計サマリー（常時表示） */}
          <span className="flex items-center gap-2 md:gap-4 text-xs whitespace-nowrap shrink-0">
            <span><span className="text-gray-400">送信</span> <span className="font-bold text-gray-800">{campaign.total_count}</span></span>
            <span><span className="text-gray-400">成功</span> <span className="font-bold text-green-600">{campaign.success_count}</span></span>
            <span><span className="text-gray-400">失敗</span> <span className="font-bold text-red-500">{campaign.failed_count}</span></span>
            <span><span className="text-gray-400">返信</span> <span className="font-bold text-blue-600">{repliedCount}</span></span>
            <span className="hidden md:inline"><span className="text-gray-400">返信率</span> <span className="font-bold text-indigo-600">{replyRate}%</span></span>
          </span>
        </button>
        {summaryOpen && (
          <div className="px-3 md:px-4 pb-3 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs">件名</span>
                <p className="font-medium text-gray-800 break-words mt-0.5">{campaign.subject}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">送信者</span>
                <p className="font-medium text-gray-800 mt-0.5">{campaign.sent_by ?? '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">送信日時</span>
                <p className="font-medium text-gray-800 mt-0.5">{formatDateTime(campaign.sent_at)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">紐づき案件</span>
                <p className="font-medium text-gray-800 break-words mt-0.5">{campaign.project_title ?? '-'}</p>
              </div>
            </div>
            {campaign.success_count > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>返信率</span>
                  <span>{repliedCount} / {campaign.success_count} 件</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${replyRate}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* フィルタ（折りたたみ可） */}
      <div className="flex-shrink-0 bg-white border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setFilterOpen(v => !v)}
          className="w-full px-3 md:px-4 py-2 flex items-center justify-between gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-gray-400 text-xs shrink-0">{filterOpen ? '▼' : '▶'}</span>
            <span>絞り込み</span>
            {!filterOpen && (statusFilter || search) && (
              <span className="text-xs text-blue-600 shrink-0">適用中</span>
            )}
          </span>
          <span className="text-xs text-gray-500 shrink-0">{filtered.length} 件</span>
        </button>
        {filterOpen && (
          <div className="px-3 md:px-4 pb-3 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="メール・名前で検索"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">すべて</option>
              <option value="sent">送信済</option>
              <option value="replied">返信あり</option>
              <option value="failed">失敗</option>
            </select>
            {totalPages > 1 && (
              <span className="text-xs text-gray-400 ml-auto">{safePage} / {totalPages} ページ</span>
            )}
          </div>
        )}
      </div>

      {/* 送信履歴リスト（横スクロールなし・行アコーディオン） */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
        {/* ヘッダ行（md以上のみ） */}
        <div className="hidden md:grid grid-cols-[28px_140px_minmax(160px,1.2fr)_72px_120px_minmax(120px,1.5fr)] gap-2 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600 border-b">
          <div></div>
          <div>名前</div>
          <div>メール</div>
          <div className="text-center">状態</div>
          <div>送信日時</div>
          <div>返信</div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-gray-100">
          {paged.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm">該当する履歴がありません。</div>
          ) : (
            paged.map(h => renderHistoryRow(h))
          )}
        </div>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {(safePage - 1) * PAGE_SIZE + 1}〜{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} 件
          </span>
          <div className="flex gap-2">
            <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}
              className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">前へ</button>
            <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}
              className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">次へ</button>
          </div>
        </div>
      )}
    </div>
  )
}
