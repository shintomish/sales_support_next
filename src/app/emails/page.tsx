'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from '@/lib/axios'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

// ── 型定義 ────────────────────────────────────────────────

type Attachment = {
  id: number
  filename: string
  mime_type: string | null
  size: number | null
  gmail_attachment_id: string
}

type Email = {
  id: number
  subject: string
  from_name: string | null
  from_address: string
  to_address: string
  body_text: string | null
  body_html: string | null
  thread_id: string | null
  received_at: string
  is_read: boolean
  attachments_count: number
  attachments?: Attachment[]
  category: 'engineer' | 'project' | 'unknown' | null
  registered_at: string | null
  contact?: { id: number; name: string } | null
  deal?: { id: number; name: string } | null
  customer?: { id: number; name: string } | null
}

type PaginatedEmails = {
  data: Email[]
  current_page: number
  last_page: number
  total: number
}

// ── 定数 ─────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  engineer: { label: '技術者', cls: 'bg-purple-100 text-purple-700' },
  project:  { label: '案件',   cls: 'bg-blue-100 text-blue-700' },
  unknown:  { label: '不明',   cls: 'bg-gray-100 text-gray-500' },
}

// ── メインコンポーネント ──────────────────────────────────

export default function EmailsPage() {
  const router = useRouter()
  const [emails, setEmails] = useState<PaginatedEmails | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<'' | 'project' | 'engineer'>('project')
  const [syncing, setSyncing] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailTokenExpired, setGmailTokenExpired] = useState(false)
  const [page, setPage] = useState(1)
  const [syncMessage, setSyncMessage] = useState('')
  const [newEmailCount, setNewEmailCount] = useState(0)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const fetchEmailsRef = useRef<() => void>(() => {})

  // Gmail接続状態確認
  useEffect(() => {
    axios.get('/api/v1/gmail/status').then(res => setGmailConnected(res.data.connected))
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') { setSyncMessage('Gmail接続が完了しました'); router.replace('/emails') }
    if (params.get('error')) setSyncMessage('Gmail接続に失敗しました')
    const emailId = params.get('email_id')
    if (emailId) {
      axios.get(`/api/v1/emails/${emailId}`).then(res => {
        setSelectedEmail(res.data)
        setCategoryFilter('')
        router.replace('/emails')
      }).catch(() => {})
    }
  }, [])

  // メール一覧取得
  const fetchEmails = useCallback(async () => {
    const res = await axios.get('/api/v1/emails', {
      params: {
        search,
        unread:   unreadOnly ? 1 : undefined,
        category: categoryFilter || undefined,
        page,
        per_page: 30,
      }
    })
    setEmails(res.data)
    setNewEmailCount(0)
  }, [search, unreadOnly, categoryFilter, page])

  useEffect(() => { fetchEmailsRef.current = fetchEmails }, [fetchEmails])
  useEffect(() => { fetchEmails() }, [fetchEmails])

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel('emails-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, () => {
        if (page === 1 && !search && !unreadOnly) fetchEmailsRef.current()
        else setNewEmailCount(c => c + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [page, search, unreadOnly])

  // 全件既読
  const handleMarkAllRead = async () => {
    setMarkingAllRead(true)
    try {
      const res = await axios.post('/api/v1/emails/mark-all-read')
      await fetchEmails()
      setSyncMessage(res.data.message)
      window.dispatchEvent(new CustomEvent('emails:mark-all-read'))
    } catch { setSyncMessage('既読処理に失敗しました') }
    finally { setMarkingAllRead(false) }
  }

  const handleConnect = async () => {
    const res = await axios.get('/api/v1/gmail/redirect')
    window.location.href = res.data.url
  }

  const handleSync = async () => {
    setSyncing(true); setSyncMessage('')
    try {
      const res = await axios.post('/api/v1/emails/sync')
      setGmailTokenExpired(false)
      setSyncMessage(res.data.message); fetchEmails()
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string; token_expired?: boolean } } })?.response?.data
      if (data?.token_expired) {
        setGmailTokenExpired(true)
        setSyncMessage(data.message ?? 'Gmailトークンが失効しました。再接続してください。')
      } else {
        setSyncMessage(data?.message ?? '同期に失敗しました')
      }
    }
    finally { setSyncing(false) }
  }

  // メール選択
  const handleSelectEmail = async (email: Email) => {
    const wasUnread = !email.is_read
    const res = await axios.get(`/api/v1/emails/${email.id}`)
    setSelectedEmail(res.data)
    setEmails(prev => prev ? { ...prev, data: prev.data.map(e => e.id === email.id ? { ...e, is_read: true } : e) } : null)
    if (wasUnread) window.dispatchEvent(new CustomEvent('emails:mark-all-read'))
  }

  const handleDownloadAttachment = async (emailId: number, attachmentId: number, filename: string, mimeType: string | null) => {
    const res = await axios.get(`/api/v1/emails/${emailId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([res.data], { type: mimeType ?? 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const fromLabel = (email: Email) =>
    email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address

  return (
    <div className="flex h-screen bg-gray-50">

      {/* 左ペイン: 一覧 */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">メール</h1>
              {newEmailCount > 0 && (
                <button onClick={() => { setPage(1); fetchEmails() }}
                  className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse hover:bg-blue-600">
                  +{newEmailCount} 新着
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {(!gmailConnected || gmailTokenExpired) ? (
                <button onClick={handleConnect} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">
                  {gmailTokenExpired ? '再接続' : 'Gmail接続'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleMarkAllRead} disabled={markingAllRead}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50">
                    {markingAllRead ? '処理中...' : '全て既読'}
                  </button>
                  <button onClick={handleSync} disabled={syncing}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5">
                    {syncing && <Spinner size={12} />}
                    {syncing ? '同期中...' : '同期'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {syncMessage && <p className="text-xs text-green-600 mb-2">{syncMessage}</p>}

          <input type="text" placeholder="差出人・件名・本文で検索" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={unreadOnly}
                onChange={e => { setUnreadOnly(e.target.checked); setPage(1) }} className="rounded" />
              未読のみ
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={categoryFilter === 'project'}
                onChange={e => { setCategoryFilter(e.target.checked ? 'project' : ''); setPage(1); setSelectedEmail(null) }}
                className="rounded accent-blue-500" />
              <span className="text-blue-700">案件</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={categoryFilter === 'engineer'}
                onChange={e => { setCategoryFilter(e.target.checked ? 'engineer' : ''); setPage(1); setSelectedEmail(null) }}
                className="rounded accent-purple-500" />
              <span className="text-purple-700">技術者</span>
            </label>
          </div>
        </div>

        {/* メールリスト */}
        <div className="flex-1 overflow-y-auto">
          {emails?.data.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              {gmailConnected ? 'メールがありません。「同期」を押してください。' : 'Gmailを接続してメールを取得してください。'}
            </div>
          )}
          {emails?.data.map(email => {
            const badge = email.category ? CATEGORY_BADGE[email.category] : null
            return (
              <div key={email.id} onClick={() => handleSelectEmail(email)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedEmail?.id === email.id
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {!email.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                    <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {email.from_name || email.from_address}
                    </span>
                    {email.attachments_count > 0 && (
                      <span className="flex-shrink-0 text-gray-400" title={`添付ファイル ${email.attachments_count}件`}>
                        📎
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatReceivedAt(email.received_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className={`text-sm truncate flex-1 ${!email.is_read ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                    {email.subject || '(件名なし)'}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                    {email.registered_at && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        登録済
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{email.body_text?.slice(0, 80)}</p>
              </div>
            )
          })}
        </div>

        {emails && emails.last_page > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="text-xs text-blue-600 disabled:text-gray-300">前へ</button>
            <span className="text-xs text-gray-500">{page} / {emails.last_page}</span>
            <button disabled={page === emails.last_page} onClick={() => setPage(p => p + 1)}
              className="text-xs text-blue-600 disabled:text-gray-300">次へ</button>
          </div>
        )}
      </div>

      {/* 右ペイン: 詳細 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmail ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* メタ情報 */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-xl font-semibold text-gray-900 flex-1">
                    {selectedEmail.subject || '(件名なし)'}
                  </h2>
                  {selectedEmail.category && CATEGORY_BADGE[selectedEmail.category] && (
                    <span className={`text-sm px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${CATEGORY_BADGE[selectedEmail.category].cls}`}>
                      {CATEGORY_BADGE[selectedEmail.category].label}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="text-gray-400">差出人:</span> {fromLabel(selectedEmail)}</p>
                  <p><span className="text-gray-400">宛先:</span> {selectedEmail.to_address}</p>
                  <p><span className="text-gray-400">受信:</span> {formatDateFull(selectedEmail.received_at)}</p>
                </div>
              </div>

              {/* 紐付け情報 */}
              {(selectedEmail.contact || selectedEmail.deal || selectedEmail.customer) && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
                  {selectedEmail.customer && <p className="text-blue-700">顧客: {selectedEmail.customer.name}</p>}
                  {selectedEmail.contact && <p className="text-blue-700">担当者: {selectedEmail.contact.name}</p>}
                  {selectedEmail.deal && <p className="text-blue-700">商談: {selectedEmail.deal.name}</p>}
                </div>
              )}

              {/* 添付ファイル */}
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 mb-2">
                    📎 添付ファイル（{selectedEmail.attachments.length}件）
                  </p>
                  <div className="space-y-1.5">
                    {selectedEmail.attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{fileIcon(att.mime_type, att.filename)}</span>
                          <span className="text-xs text-gray-700 truncate">{att.filename}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {att.size ? formatFileSize(att.size) : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadAttachment(selectedEmail.id, att.id, att.filename, att.mime_type)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0 ml-3 px-2 py-1 border border-blue-200 rounded hover:bg-blue-50"
                        >
                          DL
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 本文 */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                {selectedEmail.body_html ? (
                  <div className="prose prose-sm max-w-none text-gray-800"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                ) : (
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                    {selectedEmail.body_text || '(本文なし)'}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-sm">メールを選択してください</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ヘルパーコンポーネント ────────────────────────────────

function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      className={`animate-spin ${className}`}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── ユーティリティ ────────────────────────────────────────

function formatReceivedAt(raw: string): string {
  try {
    if (!raw) return '—'
    const s = raw.endsWith('Z') ? raw : raw.includes('T') ? raw + 'Z' : raw.replace(' ', 'T') + 'Z'
    const d = new Date(s)
    if (isNaN(d.getTime())) return '—'
    return formatDistanceToNow(d, { locale: ja, addSuffix: true })
  } catch { return '—' }
}

function formatDateFull(raw: string): string {
  try {
    const s = raw.replace(' ', 'T') + (raw.endsWith('Z') ? '' : 'Z')
    return new Date(s).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  } catch { return raw }
}

function fileIcon(mimeType: string | null, filename?: string): string {
  const m = mimeType ?? ''
  const ext = filename?.split('.').pop()?.toLowerCase() ?? ''

  if (m.includes('pdf') || ext === 'pdf')
    return '📕'
  if (m.includes('spreadsheet') || m.includes('ms-excel') || ['xlsx', 'xls', 'csv'].includes(ext))
    return '📗'
  if (m.includes('wordprocessing') || m.includes('msword') || ['docx', 'doc'].includes(ext))
    return '📘'
  if (m.includes('presentationml') || m.includes('powerpoint') || ['pptx', 'ppt'].includes(ext))
    return '📙'
  if (m.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext))
    return '🖼️'
  if (m.includes('zip') || m.includes('archive') || ['zip', 'rar', 'gz', 'tar'].includes(ext))
    return '🗜️'
  if (m.includes('text') || ['txt', 'md', 'csv'].includes(ext))
    return '📝'
  return '📄'
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}
