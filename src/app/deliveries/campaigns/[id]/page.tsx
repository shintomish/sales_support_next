'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'
import { useRouter, useParams } from 'next/navigation'

// ── 型定義 ────────────────────────────────────────────────

type SendHistory = {
  id: number
  email: string
  name: string | null
  status: 'sent' | 'failed' | 'replied'
  replied_at: string | null
  reply_subject: string | null
  reply_received_at: string | null
  reply_body_snippet?: string | null
}

type Campaign = {
  id: number
  project_mail_id: number | null
  project_title: string | null
  subject: string
  body: string
  sent_at: string | null
  sent_by: string | null
  total_count: number
  success_count: number
  failed_count: number
  histories: SendHistory[]
}

// ── 返信本文モーダル ──────────────────────────────────────

function ReplyModal({ h, campaignSubject, onClose }: { h: SendHistory; campaignSubject: string; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-xl max-h-[80vh] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* ヘッダー */}
        <div className="bg-blue-50 px-5 py-3 border-b border-blue-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-700 mb-0.5">📩 受信メール（返信）</p>
            <p className="text-sm font-semibold text-gray-800 truncate max-w-sm">{h.reply_subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
        </div>

        {/* メタ情報 */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs space-y-1 text-gray-600">
          <div className="flex gap-2">
            <span className="w-14 text-gray-400 shrink-0">差出人</span>
            <span>{h.name ? `${h.name} ＜${h.email}＞` : h.email}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 text-gray-400 shrink-0">受信日時</span>
            <span>{h.replied_at ? new Date(h.replied_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'}</span>
          </div>
        </div>

        {/* 送信メールとの対応 */}
        <div className="px-5 py-3 bg-blue-50/50 border-b border-gray-200 text-xs text-gray-600">
          <p className="text-gray-400 mb-1">紐づいた送信メール（キャンペーン）</p>
          <p className="text-gray-700 font-medium">📤 {campaignSubject}</p>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-gray-400 mb-2">本文（抜粋）</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{h.reply_body_snippet}</p>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────

export default function CampaignDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | 'sent' | 'failed' | 'replied'>('')
  const [search, setSearch] = useState('')
  const [replyModal, setReplyModal] = useState<SendHistory | null>(null)

  useEffect(() => {
    axios.get(`/api/v1/delivery-campaigns/${id}`)
      .then(res => setCampaign(res.data))
      .catch(() => router.push('/deliveries'))
  }, [id, router])

  const filtered = campaign?.histories.filter(h => {
    if (statusFilter && h.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!h.email.toLowerCase().includes(s) && !(h.name ?? '').toLowerCase().includes(s)) return false
    }
    return true
  }) ?? []

  const repliedCount = campaign?.histories.filter(h => h.status === 'replied').length ?? 0
  const replyRate = campaign && campaign.success_count > 0
    ? Math.round(repliedCount / campaign.success_count * 100)
    : 0

  if (!campaign) {
    return <div className="p-6 text-gray-400">読み込み中...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 返信モーダル */}
      {replyModal && (
        <ReplyModal
          h={replyModal}
          campaignSubject={campaign.subject}
          onClose={() => setReplyModal(null)}
        />
      )}

      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/deliveries')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← キャンペーン一覧
        </button>
        <h1 className="text-xl font-bold text-gray-800">キャンペーン詳細</h1>
      </div>

      {/* サマリーカード */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">件名</span>
            <p className="font-medium text-gray-800 mt-0.5">{campaign.subject}</p>
          </div>
          <div>
            <span className="text-gray-500">送信者</span>
            <p className="font-medium text-gray-800 mt-0.5">{campaign.sent_by ?? '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">送信日時</span>
            <p className="font-medium text-gray-800 mt-0.5">
              {campaign.sent_at ? new Date(campaign.sent_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">紐づき案件</span>
            <p className="font-medium text-gray-800 mt-0.5">{campaign.project_title ?? '-'}</p>
          </div>
        </div>

        {/* 集計バー */}
        <div className="flex gap-6 border-t border-gray-100 pt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{campaign.total_count}</p>
            <p className="text-xs text-gray-500 mt-0.5">送信数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{campaign.success_count}</p>
            <p className="text-xs text-gray-500 mt-0.5">成功</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{campaign.failed_count}</p>
            <p className="text-xs text-gray-500 mt-0.5">失敗</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{repliedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">返信あり</p>
          </div>
          <div className="text-center ml-auto">
            <p className="text-2xl font-bold text-indigo-600">{replyRate}%</p>
            <p className="text-xs text-gray-500 mt-0.5">返信率</p>
          </div>
        </div>

        {/* 返信率プログレスバー */}
        {campaign.success_count > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>返信率</span>
              <span>{repliedCount} / {campaign.success_count} 件</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${replyRate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* フィルタ */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="メール・名前で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">すべて</option>
          <option value="sent">送信済</option>
          <option value="replied">返信あり</option>
          <option value="failed">失敗</option>
        </select>
        <span className="text-sm text-gray-500">{filtered.length} 件</span>
      </div>

      {/* 送信履歴テーブル */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">名前</th>
              <th className="px-4 py-3 text-left">メールアドレス</th>
              <th className="px-4 py-3 text-center">状態</th>
              <th className="px-4 py-3 text-left">返信</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(h => (
              <tr
                key={h.id}
                className={`transition-colors ${
                  h.status === 'replied' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 text-gray-800">{h.name ?? '-'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{h.email}</td>
                <td className="px-4 py-3 text-center">
                  {{
                    sent:    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">送信済</span>,
                    failed:  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">失敗</span>,
                    replied: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">返信あり</span>,
                  }[h.status]}
                </td>
                <td className="px-4 py-3">
                  {h.status === 'replied' && h.replied_at ? (
                    <div>
                      <button
                        onClick={() => setReplyModal(h)}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium group"
                      >
                        <span className="text-base">📩</span>
                        <span className="group-hover:underline truncate max-w-[280px]">{h.reply_subject}</span>
                      </button>
                      <p className="text-xs text-gray-400 mt-0.5 pl-6">
                        {new Date(h.replied_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  該当する履歴がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
