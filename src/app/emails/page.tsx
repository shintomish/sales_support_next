'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from '@/lib/axios'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

type Email = {
  id: number
  subject: string
  from_name: string | null
  from_address: string
  to_address: string
  body_text: string | null
  received_at: string
  is_read: boolean
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

export default function EmailsPage() {
  const router = useRouter()
  const [emails, setEmails] = useState<PaginatedEmails | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [connectUrl, setConnectUrl] = useState('')
  const [page, setPage] = useState(1)
  const [syncMessage, setSyncMessage] = useState('')

  // Gmail接続状態確認
  useEffect(() => {
    axios.get('/api/v1/gmail/status').then(res => {
      setGmailConnected(res.data.connected)
    })

    // OAuth コールバック後のパラメータ確認
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') {
      setSyncMessage('Gmail接続が完了しました')
      router.replace('/emails')
    }
    if (params.get('error')) {
      setSyncMessage('Gmail接続に失敗しました')
    }
  }, [])

  // メール一覧取得
  const fetchEmails = useCallback(async () => {
    const res = await axios.get('/api/v1/emails', {
      params: { search, unread: unreadOnly ? 1 : undefined, page, per_page: 30 }
    })
    setEmails(res.data)
  }, [search, unreadOnly, page])

  useEffect(() => { fetchEmails() }, [fetchEmails])

  // Gmail認証URL取得
  const handleConnect = async () => {
    const res = await axios.get('/api/v1/gmail/redirect')
    window.location.href = res.data.url
  }

  // 同期
  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await axios.post('/api/v1/emails/sync')
      setSyncMessage(res.data.message)
      fetchEmails()
    } catch {
      setSyncMessage('同期に失敗しました')
    } finally {
      setSyncing(false)
    }
  }

  // メール選択（既読に）
  const handleSelectEmail = async (email: Email) => {
    const res = await axios.get(`/api/v1/emails/${email.id}`)
    setSelectedEmail(res.data)
    setEmails(prev => prev ? {
      ...prev,
      data: prev.data.map(e => e.id === email.id ? { ...e, is_read: true } : e)
    } : null)
  }

  const fromLabel = (email: Email) =>
    email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左ペイン: 一覧 */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">

        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900">メール</h1>
            <div className="flex gap-2">
              {!gmailConnected ? (
                <button
                  onClick={handleConnect}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
                >
                  Gmail接続
                </button>
              ) : (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  {syncing ? '同期中...' : '同期'}
                </button>
              )}
            </div>
          </div>

          {syncMessage && (
            <p className="text-xs text-green-600 mb-2">{syncMessage}</p>
          )}

          {/* 検索 */}
          <input
            type="text"
            placeholder="差出人・件名・本文で検索"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 未読フィルター */}
          <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={e => { setUnreadOnly(e.target.checked); setPage(1) }}
              className="rounded"
            />
            未読のみ表示
          </label>
        </div>

        {/* メールリスト */}
        <div className="flex-1 overflow-y-auto">
          {emails?.data.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              {gmailConnected ? 'メールがありません。「同期」を押してください。' : 'Gmailを接続してメールを取得してください。'}
            </div>
          )}

          {emails?.data.map(email => (
            <div
              key={email.id}
              onClick={() => handleSelectEmail(email)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedEmail?.id === email.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {!email.is_read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {email.from_name || email.from_address}
                  </span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(email.received_at), { locale: ja, addSuffix: true })}
                </span>
              </div>
              <p className={`text-sm mt-0.5 truncate ${!email.is_read ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                {email.subject || '(件名なし)'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {email.body_text?.slice(0, 80)}
              </p>
            </div>
          ))}
        </div>

        {/* ページネーション */}
        {emails && emails.last_page > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-blue-600 disabled:text-gray-300"
            >
              前へ
            </button>
            <span className="text-xs text-gray-500">{page} / {emails.last_page}</span>
            <button
              disabled={page === emails.last_page}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-blue-600 disabled:text-gray-300"
            >
              次へ
            </button>
          </div>
        )}
      </div>

      {/* 右ペイン: 詳細 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmail ? (
          <div className="flex-1 overflow-y-auto p-6">
            {/* メタ情報 */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                {selectedEmail.subject || '(件名なし)'}
              </h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="text-gray-400">差出人:</span> {fromLabel(selectedEmail)}</p>
                <p><span className="text-gray-400">宛先:</span> {selectedEmail.to_address}</p>
                <p><span className="text-gray-400">受信:</span> {new Date(selectedEmail.received_at).toLocaleString('ja-JP')}</p>
              </div>
            </div>

            {/* 紐付け情報 */}
            {(selectedEmail.contact || selectedEmail.deal || selectedEmail.customer) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
                {selectedEmail.customer && (
                  <p className="text-blue-700">顧客: {selectedEmail.customer.name}</p>
                )}
                {selectedEmail.contact && (
                  <p className="text-blue-700">担当者: {selectedEmail.contact.name}</p>
                )}
                {selectedEmail.deal && (
                  <p className="text-blue-700">商談: {selectedEmail.deal.name}</p>
                )}
              </div>
            )}

            {/* 本文 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              {selectedEmail.body_html ? (
                <div
                  className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                />
              ) : (
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                  {selectedEmail.body_text || '(本文なし)'}
                </pre>
              )}
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
