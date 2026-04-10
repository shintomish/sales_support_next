'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'
import { useRouter, useParams } from 'next/navigation'

type SendHistory = {
  id: number
  email: string
  name: string | null
  status: 'sent' | 'failed' | 'replied'
  replied_at: string | null
  reply_subject: string | null
  reply_received_at: string | null
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

export default function CampaignDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | 'sent' | 'failed' | 'replied'>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    axios.get(`/api/v1/delivery-campaigns/${id}`)
      .then(res => setCampaign(res.data))
      .catch(() => router.push('/deliveries'))
  }, [id])

  const filtered = campaign?.histories.filter(h => {
    if (statusFilter && h.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!h.email.toLowerCase().includes(s) && !(h.name ?? '').toLowerCase().includes(s)) return false
    }
    return true
  }) ?? []

  const statusBadge = (status: SendHistory['status']) => {
    const map = {
      sent:    'bg-green-100 text-green-700',
      failed:  'bg-red-100 text-red-700',
      replied: 'bg-blue-100 text-blue-700',
    }
    const label = { sent: '送信済', failed: '失敗', replied: '返信あり' }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
        {label[status]}
      </span>
    )
  }

  if (!campaign) {
    return <div className="p-6 text-gray-400">読み込み中...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
              {campaign.sent_at ? new Date(campaign.sent_at).toLocaleString('ja-JP') : '-'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">紐づき案件</span>
            <p className="font-medium text-gray-800 mt-0.5">{campaign.project_title ?? '-'}</p>
          </div>
        </div>
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
            <p className="text-2xl font-bold text-blue-600">
              {campaign.histories.filter(h => h.status === 'replied').length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">返信あり</p>
          </div>
        </div>
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
              <th className="px-4 py-3 text-left">返信日時</th>
              <th className="px-4 py-3 text-left">返信件名</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(h => (
              <tr key={h.id} className={`hover:bg-gray-50 ${h.status === 'replied' ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-3 text-gray-800">{h.name ?? '-'}</td>
                <td className="px-4 py-3 text-gray-600">{h.email}</td>
                <td className="px-4 py-3 text-center">{statusBadge(h.status)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {h.replied_at ? new Date(h.replied_at).toLocaleString('ja-JP') : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                  {h.reply_subject ?? '-'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
