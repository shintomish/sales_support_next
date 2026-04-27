'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from '@/lib/axios'

type LastActivity = {
  type: 'sent' | 'received'
  subject: string
  datetime: string
}

type ProposalThread = {
  id: number
  type: 'project' | 'engineer'
  source_id: number
  customer_name: string | null
  title: string | null
  status: string
  partner_email: string
  partner_name: string | null
  last_activity: LastActivity | null
  thread_count: number
  has_unread_reply: boolean
}

type ThreadMessage = {
  type: 'sent' | 'received'
  campaign_id?: number
  history_id?: number
  email_id?: number
  to?: string
  to_name?: string | null
  from?: string
  from_name?: string | null
  subject: string
  body?: string
  body_text?: string
  sent_at?: string | null
  received_at?: string | null
  status?: string
}

type Paginated = {
  data: ProposalThread[]
  current_page: number
  last_page: number
  total: number
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  review: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  proposed: 'bg-purple-100 text-purple-700 border-purple-200',
  interview: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  won: 'bg-green-100 text-green-700 border-green-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
  excluded: 'bg-gray-100 text-gray-500 border-gray-200',
  registered: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  proposing: 'bg-purple-100 text-purple-700 border-purple-200',
  working: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const STATUS_LABELS: Record<string, string> = {
  new: '新着', review: '要確認', proposed: '提案済', interview: '面談',
  won: '成約', lost: '失注', excluded: '除外',
  registered: '登録済', proposing: '提案中', working: '稼働中',
}

function formatDateTime(raw: string): string {
  try {
    const s = raw.endsWith('Z') ? raw : raw.includes('T') ? raw + 'Z' : raw.replace(' ', 'T') + 'Z'
    const d = new Date(s)
    if (isNaN(d.getTime())) return '—'
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${day} ${h}:${min}`
  } catch { return '—' }
}

const threadKey = (t: ProposalThread) => `${t.type}-${t.source_id}`

export default function ProposalThreadsPage() {
  const [items, setItems] = useState<Paginated | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<'' | 'project' | 'engineer'>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({})
  const [threadLoadingKey, setThreadLoadingKey] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/v1/proposal-threads', {
        params: {
          page,
          per_page: 30,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
        },
      })
      setItems(res.data)
    } catch { setItems(null) }
    finally { setLoading(false) }
  }, [page, typeFilter, statusFilter, search])

  useEffect(() => { fetchList() }, [fetchList])

  const handleToggle = async (t: ProposalThread) => {
    const key = threadKey(t)
    if (expandedKey === key) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(key)

    if (!threadCache[key]) {
      setThreadLoadingKey(key)
      try {
        const path = t.type === 'project'
          ? `/api/v1/project-mails/${t.source_id}/thread`
          : `/api/v1/engineer-mails/${t.source_id}/thread`
        const res = await axios.get<{ thread: ThreadMessage[] }>(path)
        const thread = res.data.thread ?? []
        setThreadCache(prev => ({ ...prev, [key]: thread }))

        // 受信返信メールを既読化（GET /emails/{id} 側で自動既読）
        if (t.has_unread_reply) {
          const replyIds = thread
            .filter(m => m.type === 'received' && typeof m.email_id === 'number')
            .map(m => m.email_id as number)
          if (replyIds.length > 0) {
            await Promise.all(
              replyIds.map(id => axios.get(`/api/v1/emails/${id}`).catch(() => null))
            )
            setItems(prev => prev ? {
              ...prev,
              data: prev.data.map(x =>
                threadKey(x) === key ? { ...x, has_unread_reply: false } : x
              ),
            } : prev)
          }
        }
      } catch {
        setThreadCache(prev => ({ ...prev, [key]: [] }))
      } finally {
        setThreadLoadingKey(null)
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-800">提案スレッド</h1>
        <p className="text-xs text-gray-500 mt-0.5">案件・技術者メールの提案やり取り一覧</p>
      </div>

      {/* フィルタ */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as '' | 'project' | 'engineer'); setPage(1) }}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全タイプ</option>
          <option value="project">案件メール</option>
          <option value="engineer">技術者メール</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全ステータス</option>
          <option value="new">新着</option>
          <option value="review">要確認</option>
          <option value="proposed">提案済</option>
          <option value="interview">面談</option>
          <option value="won">成約</option>
          <option value="lost">失注</option>
        </select>
        <input type="text" placeholder="顧客名・技術者名・件名で検索" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        {items && <span className="text-xs text-gray-400 ml-auto">{items.total}件</span>}
      </div>

      {/* 一覧 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">読み込み中...</div>
        )}
        {!loading && (!items || items.data.length === 0) && (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">提案スレッドはありません</div>
        )}
        {!loading && items && items.data.map(t => {
          const key = threadKey(t)
          const isExpanded = expandedKey === key
          const isThreadLoading = threadLoadingKey === key
          const thread = threadCache[key]
          return (
            <div key={key} className="border-b border-gray-100">
              <div
                onClick={() => handleToggle(t)}
                className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${t.has_unread_reply ? 'bg-yellow-50/60' : 'bg-white'}`}>
                <div className="flex items-start gap-3">
                  {/* 展開アイコン */}
                  <span className={`text-gray-400 text-xs mt-2 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>

                  {/* タイプアイコン */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${t.type === 'project' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                    {t.type === 'project' ? '案' : '技'}
                  </div>

                  {/* メイン情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {t.customer_name ?? t.partner_name ?? t.partner_email}
                      </span>
                      {t.has_unread_reply && (
                        <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 font-bold flex-shrink-0">未確認</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{t.title ?? '—'}</p>

                    {/* 最新のやり取り */}
                    {t.last_activity && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-xs font-bold ${t.last_activity.type === 'sent' ? 'text-blue-600' : 'text-gray-600'}`}>
                          {t.last_activity.type === 'sent' ? '→' : '←'}
                        </span>
                        <span className="text-xs text-gray-400">{formatDateTime(t.last_activity.datetime)}</span>
                        <span className="text-xs text-gray-600 truncate">{t.last_activity.subject}</span>
                      </div>
                    )}
                  </div>

                  {/* 右側 */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                    <span className="text-xs text-gray-400">💬 {t.thread_count}</span>
                  </div>
                </div>
              </div>

              {/* 展開エリア */}
              {isExpanded && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                  {isThreadLoading && (
                    <div className="text-xs text-gray-400 py-2">読み込み中...</div>
                  )}
                  {!isThreadLoading && thread && thread.length === 0 && (
                    <div className="text-xs text-gray-400 py-2">やり取りはありません</div>
                  )}
                  {!isThreadLoading && thread && thread.length > 0 && (
                    <div className="space-y-3">
                      {thread.map((m, i) => (
                        <div key={i} className={`rounded-lg border p-3 ${m.type === 'sent' ? 'bg-blue-50 border-blue-100 ml-8' : 'bg-white border-gray-200 mr-8'}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-xs font-bold ${m.type === 'sent' ? 'text-blue-600' : 'text-gray-700'}`}>
                              {m.type === 'sent' ? '→ 送信' : '← 受信'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDateTime((m.sent_at ?? m.received_at) ?? '')}
                            </span>
                            <span className="text-xs text-gray-500 truncate">
                              {m.type === 'sent' ? `To: ${m.to_name ?? m.to ?? ''}` : `From: ${m.from_name ?? m.from ?? ''}`}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 mb-1">{m.subject}</p>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans break-words">
                            {m.type === 'sent' ? (m.body ?? '') : (m.body_text ?? '')}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ページネーション */}
      {items && items.last_page > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">{items.current_page} / {items.last_page} ページ</span>
          <div className="flex gap-2">
            <button disabled={items.current_page <= 1} onClick={() => setPage(p => p - 1)}
              className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">前へ</button>
            <button disabled={items.current_page >= items.last_page} onClick={() => setPage(p => p + 1)}
              className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">次へ</button>
          </div>
        </div>
      )}
    </div>
  )
}
