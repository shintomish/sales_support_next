'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from '@/lib/axios'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

// ── 型定義 ─────────────────────────────────────────────────

type SkillMap = { name: string; skill_id: number | null; matched: boolean }

type ExtractResult = {
  // 案件
  title?: string
  description?: string
  end_client?: string
  unit_price_min?: number | null
  unit_price_max?: number | null
  contract_type?: string | null
  contract_period_months?: number | null
  start_date?: string | null
  work_location?: string | null
  nearest_station?: string | null
  work_style?: string | null
  remote_frequency?: string | null
  required_experience_years?: number | null
  interview_count?: number | null
  // 技術者
  name?: string | null
  desired_unit_price_min?: number | null
  desired_unit_price_max?: number | null
  available_from?: string | null
  preferred_location?: string | null
  self_introduction?: string | null
  // 共通
  skills?: string[]
  parse_error?: boolean
}

type MatchCandidate = {
  id: number
  name?: string        // engineer
  title?: string       // project
  score: number
  skill_matches: string[]
  // engineer
  desired_price_min?: number | null
  desired_price_max?: number | null
  available_from?: string | null
  affiliation?: string | null
  // project
  unit_price_min?: number | null
  unit_price_max?: number | null
  start_date?: string | null
  work_location?: string | null
  work_style?: string | null
}

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
  extracted_data: {
    result?: ExtractResult
    classification_reason?: string
    has_attachments?: boolean
    extracted_at?: string
  } | null
  registered_at: string | null
  registered_engineer_id: number | null
  registered_project_id: number | null
  best_match_score: number | null
  match_count: number
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

type Skill = { id: number; name: string }

// ── 定数 ─────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  engineer: { label: '技術者', cls: 'bg-purple-100 text-purple-700' },
  project:  { label: '案件',   cls: 'bg-blue-100 text-blue-700' },
  unknown:  { label: '不明',   cls: 'bg-gray-100 text-gray-500' },
}

const WORK_STYLE_OPTIONS = [
  { value: 'office', label: 'オフィス' },
  { value: 'remote', label: 'フルリモート' },
  { value: 'hybrid', label: 'ハイブリッド' },
]

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

  // 抽出・登録パネル用
  const [extracting, setExtracting] = useState(false)
  const [skillMap, setSkillMap] = useState<SkillMap[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [showRegisterPanel, setShowRegisterPanel] = useState(false)
  const [registerForm, setRegisterForm] = useState<Record<string, unknown>>({})
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([])
  const [registering, setRegistering] = useState(false)
  const [registerMessage, setRegisterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // マッチングプレビュー
  const [showMatchPreview, setShowMatchPreview] = useState(false)
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([])
  const [loadingMatch, setLoadingMatch] = useState(false)

  const fetchEmailsRef = useRef<() => void>(() => {})

  // Gmail接続状態確認
  useEffect(() => {
    axios.get('/api/v1/gmail/status').then(res => setGmailConnected(res.data.connected))
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') { setSyncMessage('Gmail接続が完了しました'); router.replace('/emails') }
    if (params.get('error')) setSyncMessage('Gmail接続に失敗しました')
  }, [])

  // スキルマスタ取得
  useEffect(() => {
    axios.get('/api/v1/matching/skills').then(res => setAllSkills(res.data.data ?? res.data))
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
    // 各パネルをリセット
    setShowRegisterPanel(false)
    setRegisterMessage(null)
    setShowMatchPreview(false)
    setMatchCandidates([])
    // 既に抽出済みならスキルマップをセット
    if (res.data.extracted_data?.result) {
      setSkillMap(buildSkillMapFromResult(res.data.extracted_data.result, allSkills))
    } else {
      setSkillMap([])
    }
  }

  // ── Claude抽出 ─────────────────────────────────────────

  const handleExtract = async () => {
    if (!selectedEmail) return
    setExtracting(true); setRegisterMessage(null)
    try {
      const res = await axios.post(`/api/v1/emails/${selectedEmail.id}/extract`)
      const updated = {
        ...selectedEmail,
        extracted_data:   res.data.email.extracted_data,
        best_match_score: res.data.email.best_match_score ?? null,
        match_count:      res.data.email.match_count ?? 0,
      }
      setSelectedEmail(updated)
      setSkillMap(res.data.skill_map ?? [])
      setEmails(prev => prev ? { ...prev, data: prev.data.map(e => e.id === updated.id ? {
        ...e,
        extracted_data:   updated.extracted_data,
        best_match_score: updated.best_match_score,
        match_count:      updated.match_count,
      } : e) } : null)
    } catch { setRegisterMessage({ type: 'error', text: '抽出に失敗しました' }) }
    finally { setExtracting(false) }
  }

  // 登録フォームを開く（抽出結果をプリセット）
  const handleOpenRegisterPanel = () => {
    const result = selectedEmail?.extracted_data?.result ?? {}
    const form: Record<string, unknown> = { ...result }
    // スキルは照合済みのものを初期選択
    const matched = skillMap.filter(s => s.matched && s.skill_id).map(s => s.skill_id as number)
    setSelectedSkillIds(matched)
    setRegisterForm(form)
    setShowRegisterPanel(true)
    setRegisterMessage(null)
  }

  // ── 登録実行 ────────────────────────────────────────────

  const handleRegister = async () => {
    if (!selectedEmail) return
    setRegistering(true); setRegisterMessage(null)
    const endpoint = selectedEmail.category === 'engineer'
      ? `/api/v1/emails/${selectedEmail.id}/register-engineer`
      : `/api/v1/emails/${selectedEmail.id}/register-project`

    const skills = selectedSkillIds.map(id => ({ skill_id: id }))

    try {
      await axios.post(endpoint, { ...registerForm, skills })
      const refreshed = await axios.get(`/api/v1/emails/${selectedEmail.id}`)
      setSelectedEmail(refreshed.data)
      setEmails(prev => prev ? { ...prev, data: prev.data.map(e => e.id === refreshed.data.id ? refreshed.data : e) } : null)
      setRegisterMessage({ type: 'success', text: selectedEmail.category === 'engineer' ? '技術者として登録しました' : '案件として登録しました' })
      setShowRegisterPanel(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '登録に失敗しました'
      setRegisterMessage({ type: 'error', text: msg })
    } finally { setRegistering(false) }
  }

  const handleMatchPreview = async () => {
    if (!selectedEmail) return
    setLoadingMatch(true)
    setShowMatchPreview(true)
    try {
      const res = await axios.get(`/api/v1/emails/${selectedEmail.id}/match-preview`)
      setMatchCandidates(res.data.matches ?? [])
    } catch {
      setMatchCandidates([])
    } finally {
      setLoadingMatch(false)
    }
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
                onChange={e => { setCategoryFilter(e.target.checked ? 'project' : ''); setPage(1) }}
                className="rounded accent-blue-500" />
              <span className="text-blue-700">案件</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={categoryFilter === 'engineer'}
                onChange={e => { setCategoryFilter(e.target.checked ? 'engineer' : ''); setPage(1) }}
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
            const scoreBgStyle = selectedEmail?.id === email.id ? {} :
              email.best_match_score === null || email.best_match_score === undefined ? {} :
              email.best_match_score >= 70 ? { backgroundColor: '#bbf7d0' } :  // green-200
              email.best_match_score >= 45 ? { backgroundColor: '#fef08a' } :  // yellow-200
              { backgroundColor: '#e5e7eb' }                                   // gray-200
            return (
              <div key={email.id} onClick={() => handleSelectEmail(email)}
                style={scoreBgStyle}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:brightness-85 ${
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
                  {/* 分類バッジ */}
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

              {/* ── AI抽出・登録パネル ─────────────────────────── */}
              {selectedEmail.category && selectedEmail.category !== 'unknown' && (
                <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">AI自動抽出</span>
                      {selectedEmail.extracted_data?.result && !selectedEmail.extracted_data.result.parse_error && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">抽出済み</span>
                      )}
                      {selectedEmail.registered_at && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">登録済み</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {/* 抽出ボタン */}
                      {!selectedEmail.registered_at && (
                        <button onClick={handleExtract} disabled={extracting}
                          className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                          {extracting && <Spinner size={12} />}
                          {extracting ? '抽出中...' : selectedEmail.extracted_data?.result ? '再抽出' : 'Claude抽出'}
                        </button>
                      )}
                      {/* マッチング候補ボタン */}
                      {selectedEmail.extracted_data?.result && !selectedEmail.extracted_data.result.parse_error && (
                        <button onClick={handleMatchPreview} disabled={loadingMatch}
                          className={`text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5 ${
                            selectedEmail.best_match_score !== null && selectedEmail.best_match_score !== undefined && selectedEmail.best_match_score >= 70
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : selectedEmail.best_match_score !== null && selectedEmail.best_match_score !== undefined && selectedEmail.best_match_score >= 45
                              ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-800'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}>
                          {loadingMatch && <Spinner size={12} />}
                          {selectedEmail.best_match_score !== null && selectedEmail.best_match_score !== undefined && selectedEmail.best_match_score >= 70
                            ? '🟢 '
                            : selectedEmail.best_match_score !== null && selectedEmail.best_match_score !== undefined && selectedEmail.best_match_score >= 45
                            ? '🟡 '
                            : ''}
                          {selectedEmail.category === 'engineer'
                            ? `案件候補${matchCandidates.length > 0 ? matchCandidates.length : selectedEmail.match_count}件`
                            : `技術者候補${matchCandidates.length > 0 ? matchCandidates.length : selectedEmail.match_count}人`}
                        </button>
                      )}
                      {/* 登録ボタン */}
                      {selectedEmail.extracted_data?.result && !selectedEmail.extracted_data.result.parse_error && !selectedEmail.registered_at && (
                        <button onClick={handleOpenRegisterPanel}
                          className={`text-xs text-white px-3 py-1.5 rounded-lg ${
                            selectedEmail.category === 'engineer'
                              ? 'bg-purple-600 hover:bg-purple-700'
                              : 'bg-blue-600 hover:bg-blue-700'}`}>
                          {selectedEmail.category === 'engineer' ? '技術者として登録' : '案件として登録'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 抽出中オーバーレイ */}
                  {extracting && (
                    <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
                      <Spinner size={20} />
                      <span className="text-sm">Claude APIで情報を抽出しています...</span>
                    </div>
                  )}

                  {/* 抽出結果プレビュー */}
                  {!extracting && selectedEmail.extracted_data?.result && !selectedEmail.extracted_data.result.parse_error && (
                    <div className="p-4">
                      <ExtractPreview
                        result={selectedEmail.extracted_data.result}
                        category={selectedEmail.category}
                        skillMap={skillMap}
                      />
                    </div>
                  )}

                  {registerMessage && (
                    <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-sm ${
                      registerMessage.type === 'success'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'}`}>
                      {registerMessage.text}
                    </div>
                  )}
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

      {/* マッチングプレビューモーダル */}
      {showMatchPreview && selectedEmail && (
        <MatchPreviewModal
          email={selectedEmail}
          candidates={matchCandidates}
          loading={loadingMatch}
          onClose={() => setShowMatchPreview(false)}
          onRegister={() => { setShowMatchPreview(false); handleOpenRegisterPanel() }}
        />
      )}

      {/* 登録モーダル */}
      {showRegisterPanel && selectedEmail && (
        <RegisterModal
          email={selectedEmail}
          form={registerForm}
          setForm={setRegisterForm}
          allSkills={allSkills}
          skillMap={skillMap}
          selectedSkillIds={selectedSkillIds}
          setSelectedSkillIds={setSelectedSkillIds}
          registering={registering}
          onRegister={handleRegister}
          onClose={() => setShowRegisterPanel(false)}
        />
      )}
    </div>
  )
}

// ── 抽出結果プレビュー ────────────────────────────────────

function ExtractPreview({ result, category, skillMap }: {
  result: ExtractResult
  category: string
  skillMap: SkillMap[]
}) {
  const rows: { label: string; value: string | null | undefined }[] = category === 'engineer'
    ? [
        { label: '氏名',     value: result.name },
        { label: '希望単価', value: formatPrice(result.desired_unit_price_min, result.desired_unit_price_max) },
        { label: '稼働開始', value: result.available_from },
        { label: '勤務形態', value: workStyleLabel(result.work_style) },
        { label: '希望勤務地', value: result.preferred_location },
      ]
    : [
        { label: 'タイトル',   value: result.title },
        { label: '単価',       value: formatPrice(result.unit_price_min, result.unit_price_max) },
        { label: '開始日',     value: result.start_date },
        { label: '勤務形態',   value: workStyleLabel(result.work_style) },
        { label: '勤務地',     value: result.work_location },
        { label: 'リモート',   value: result.remote_frequency },
        { label: '面談',       value: result.interview_count != null ? `${result.interview_count}回` : null },
      ]

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.filter(r => r.value).map(r => (
          <div key={r.label} className="flex gap-2">
            <dt className="text-gray-400 flex-shrink-0">{r.label}:</dt>
            <dd className="text-gray-800 font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      {skillMap.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">抽出スキル</p>
          <div className="flex flex-wrap gap-1.5">
            {skillMap.map(s => (
              <span key={s.name}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  s.matched ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {s.name}{!s.matched && ' *'}
              </span>
            ))}
          </div>
          {skillMap.some(s => !s.matched) && (
            <p className="text-xs text-gray-400 mt-1">* マスタ未登録（登録時に手動選択）</p>
          )}
        </div>
      )}
      {category === 'engineer' && result.self_introduction && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
          {result.self_introduction}
        </p>
      )}
      {category === 'project' && result.description && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
          {result.description}
        </p>
      )}
    </div>
  )
}

// ── マッチングプレビューモーダル ──────────────────────────

function MatchPreviewModal({ email, candidates, loading, onClose, onRegister }: {
  email: Email
  candidates: MatchCandidate[]
  loading: boolean
  onClose: () => void
  onRegister: () => void
}) {
  const isEngineer = email.category === 'engineer'
  const title = isEngineer
    ? `案件候補 ${candidates.length}件`
    : `技術者候補 ${candidates.length}人`
  const accentCls = isEngineer ? 'bg-blue-600' : 'bg-purple-600'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{email.subject}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* 候補リスト */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-gray-400">
              <Spinner size={20} />
              <span className="text-sm">マッチング計算中...</span>
            </div>
          )}
          {!loading && candidates.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-12">候補が見つかりませんでした</p>
          )}
          {!loading && candidates.map((c, i) => (
            <div key={c.id} className={`border-2 rounded-xl p-4 transition-colors ${
              c.score >= 70 ? 'border-green-400'
              : c.score >= 45 ? 'border-yellow-400'
              : 'border-gray-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* 順位バッジ */}
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold ${accentCls}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {c.name ?? c.title ?? '—'}
                    </p>
                    {/* サブ情報 */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {isEngineer ? (
                        <>
                          {(c.unit_price_min || c.unit_price_max) && (
                            <span className="text-xs text-gray-500">
                              💴 {formatPrice(c.unit_price_min, c.unit_price_max)}
                            </span>
                          )}
                          {c.work_location && (
                            <span className="text-xs text-gray-500">📍 {c.work_location}</span>
                          )}
                          {c.start_date && (
                            <span className="text-xs text-gray-500">📅 {c.start_date}</span>
                          )}
                        </>
                      ) : (
                        <>
                          {(c.desired_price_min || c.desired_price_max) && (
                            <span className="text-xs text-gray-500">
                              💴 {formatPrice(c.desired_price_min, c.desired_price_max)}
                            </span>
                          )}
                          {c.affiliation && (
                            <span className="text-xs text-gray-500">🏢 {c.affiliation}</span>
                          )}
                          {c.available_from && (
                            <span className="text-xs text-gray-500">📅 {c.available_from}</span>
                          )}
                        </>
                      )}
                      {c.work_style && (
                        <span className="text-xs text-gray-500">{workStyleLabel(c.work_style)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* スコアバッジ + 詳細リンク */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <ScoreBadge score={c.score} />
                  <a
                    href={isEngineer ? `/public-projects/${c.id}` : `/engineers/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    詳細 →
                  </a>
                </div>
              </div>

              {/* 一致スキル */}
              {c.skill_matches.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {c.skill_matches.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full">
                      ✓ {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
            閉じる
          </button>
          {!email.registered_at && (
            <button onClick={onRegister}
              className={`text-sm text-white px-5 py-2 rounded-lg ${
                isEngineer ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isEngineer ? '技術者として登録する →' : '案件として登録する →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500'
    : score >= 45 ? 'bg-yellow-500'
    : 'bg-gray-800'
  return (
    <span className={`text-xs text-white font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score}点
    </span>
  )
}

// ── 登録モーダル ──────────────────────────────────────────

function RegisterModal({ email, form, setForm, allSkills, skillMap, selectedSkillIds, setSelectedSkillIds, registering, onRegister, onClose }: {
  email: Email
  form: Record<string, unknown>
  setForm: (f: Record<string, unknown>) => void
  allSkills: Skill[]
  skillMap: SkillMap[]
  selectedSkillIds: number[]
  setSelectedSkillIds: (ids: number[]) => void
  registering: boolean
  onRegister: () => void
  onClose: () => void
}) {
  const isEngineer = email.category === 'engineer'
  const f = (key: string) => (form[key] as string) ?? ''
  const set = (key: string, val: unknown) => setForm({ ...form, [key]: val })

  const toggleSkill = (id: number) =>
    setSelectedSkillIds(selectedSkillIds.includes(id)
      ? selectedSkillIds.filter(s => s !== id)
      : [...selectedSkillIds, id])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            {isEngineer ? '技術者として登録' : '案件として登録'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* フォーム */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {isEngineer ? (
            <>
              <FormRow label="氏名 *">
                <input value={f('name')} onChange={e => set('name', e.target.value)}
                  className="form-input" placeholder="山田 太郎" />
              </FormRow>
              <FormRow label="所属会社">
                <input value={f('affiliation')} onChange={e => set('affiliation', e.target.value)}
                  className="form-input" placeholder="株式会社〇〇" />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="希望単価 下限（万円）">
                  <input type="number" value={f('desired_unit_price_min')} onChange={e => set('desired_unit_price_min', e.target.value)}
                    className="form-input" placeholder="60" />
                </FormRow>
                <FormRow label="上限（万円）">
                  <input type="number" value={f('desired_unit_price_max')} onChange={e => set('desired_unit_price_max', e.target.value)}
                    className="form-input" placeholder="80" />
                </FormRow>
              </div>
              <FormRow label="稼働可能日">
                <input type="date" value={f('available_from')} onChange={e => set('available_from', e.target.value)}
                  className="form-input" />
              </FormRow>
              <FormRow label="勤務形態">
                <select value={f('work_style')} onChange={e => set('work_style', e.target.value)} className="form-input">
                  <option value="">未選択</option>
                  {WORK_STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormRow>
              <FormRow label="希望勤務地">
                <input value={f('preferred_location')} onChange={e => set('preferred_location', e.target.value)}
                  className="form-input" placeholder="東京都" />
              </FormRow>
              <FormRow label="スキルサマリー">
                <textarea value={f('self_introduction')} onChange={e => set('self_introduction', e.target.value)}
                  className="form-input" rows={3} />
              </FormRow>
            </>
          ) : (
            <>
              <FormRow label="タイトル *">
                <input value={f('title')} onChange={e => set('title', e.target.value)}
                  className="form-input" placeholder="案件タイトル" />
              </FormRow>
              <FormRow label="案件概要">
                <textarea value={f('description')} onChange={e => set('description', e.target.value)}
                  className="form-input" rows={3} />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="単価 下限（万円）">
                  <input type="number" value={f('unit_price_min')} onChange={e => set('unit_price_min', e.target.value)}
                    className="form-input" placeholder="60" />
                </FormRow>
                <FormRow label="上限（万円）">
                  <input type="number" value={f('unit_price_max')} onChange={e => set('unit_price_max', e.target.value)}
                    className="form-input" placeholder="80" />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="開始日">
                  <input type="date" value={f('start_date')} onChange={e => set('start_date', e.target.value)}
                    className="form-input" />
                </FormRow>
                <FormRow label="契約期間（ヶ月）">
                  <input type="number" value={f('contract_period_months')} onChange={e => set('contract_period_months', e.target.value)}
                    className="form-input" placeholder="6" />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="勤務地">
                  <input value={f('work_location')} onChange={e => set('work_location', e.target.value)}
                    className="form-input" placeholder="東京都千代田区" />
                </FormRow>
                <FormRow label="最寄駅">
                  <input value={f('nearest_station')} onChange={e => set('nearest_station', e.target.value)}
                    className="form-input" placeholder="東京駅" />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="勤務形態">
                  <select value={f('work_style')} onChange={e => set('work_style', e.target.value)} className="form-input">
                    <option value="">未選択</option>
                    {WORK_STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </FormRow>
                <FormRow label="リモート頻度">
                  <input value={f('remote_frequency')} onChange={e => set('remote_frequency', e.target.value)}
                    className="form-input" placeholder="週3リモート" />
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="面談回数">
                  <input type="number" value={f('interview_count')} onChange={e => set('interview_count', e.target.value)}
                    className="form-input" placeholder="1" />
                </FormRow>
                <FormRow label="必要経験年数">
                  <input type="number" value={f('required_experience_years')} onChange={e => set('required_experience_years', e.target.value)}
                    className="form-input" placeholder="3" />
                </FormRow>
              </div>
            </>
          )}

          {/* スキル選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">スキル</label>
            {skillMap.length > 0 && (
              <p className="text-xs text-gray-400 mb-2">
                AI抽出スキル（青 = マスタ一致、グレー = 未登録）
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {skillMap.map(s => s.matched && s.skill_id ? (
                <button key={s.name} type="button" onClick={() => toggleSkill(s.skill_id!)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedSkillIds.includes(s.skill_id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'}`}>
                  {s.name}
                </button>
              ) : (
                <span key={s.name} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">
                  {s.name} (未登録)
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-1.5">マスタから追加</p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {allSkills.map(s => (
                <button key={s.id} type="button" onClick={() => toggleSkill(s.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedSkillIds.includes(s.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
            キャンセル
          </button>
          <button onClick={onRegister} disabled={registering}
            className={`text-sm text-white px-5 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2 ${
              isEngineer ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {registering && <Spinner size={14} className="text-white" />}
            {registering ? '登録中...' : isEngineer ? '技術者として登録' : '案件として登録'}
          </button>
        </div>
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

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ── ユーティリティ ────────────────────────────────────────

function buildSkillMapFromResult(result: ExtractResult, allSkills: Skill[]): SkillMap[] {
  const skillNames = result.skills ?? []
  if (!skillNames.length) return []
  const byName = new Map(allSkills.map(s => [s.name.toLowerCase(), s]))
  return skillNames.map(name => {
    const matched = byName.get(name.toLowerCase())
    return { name, skill_id: matched?.id ?? null, matched: !!matched }
  })
}

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

function formatPrice(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null
  if (min && max && min !== max) return `${min}〜${max}万円`
  return `${min ?? max}万円`
}

function workStyleLabel(val?: string | null): string | null {
  return WORK_STYLE_OPTIONS.find(o => o.value === val)?.label ?? null
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
