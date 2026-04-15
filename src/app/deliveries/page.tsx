'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from '@/lib/axios'
import { useRouter } from 'next/navigation'

// ── 型定義 ────────────────────────────────────────────────

type DeliveryAddress = {
  id: number
  email: string
  name: string | null
  occupation: string | null
  is_active: boolean
}

type PaginatedAddresses = {
  data: DeliveryAddress[]
  current_page: number
  last_page: number
  total: number
}

type Campaign = {
  id: number
  project_mail_id: number | null
  project_title: string | null
  subject: string
  sent_at: string | null
  sent_by: string | null
  total_count: number
  success_count: number
  failed_count: number
  replied_count?: number
  _isDemo?: true
}

type PaginatedCampaigns = {
  data: Campaign[]
  current_page: number
  last_page: number
  total: number
}

type ProjectMail = {
  id: number
  title: string | null
  customer_name: string | null
}

type SortDir = 'asc' | 'desc'
type CampSortBy = 'sent_at' | 'subject' | 'sent_by' | 'project_title'

type SalesUser = {
  id: number
  name: string
}

type Tab = 'addresses' | 'campaigns' | 'send'

// ── デモ用モックデータ ─────────────────────────────────────

const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 9001, _isDemo: true,
    project_mail_id: 1372,
    project_title: 'Java/Spring バックエンド開発（六本木）',
    subject: '【エンジニアご紹介】即日稼働可能なJavaエンジニア3名のご案内',
    sent_at: '2026-04-11T10:00:00+09:00',
    sent_by: '新冨 泰明',
    total_count: 5,
    success_count: 5,
    failed_count: 0,
    replied_count: 3,
  },
  {
    id: 9002, _isDemo: true,
    project_mail_id: 1366,
    project_title: 'Python/Django データ基盤開発',
    subject: '【ご紹介】Python・データエンジニア2名のご案内',
    sent_at: '2026-04-10T14:30:00+09:00',
    sent_by: '新冨 泰明',
    total_count: 8,
    success_count: 8,
    failed_count: 0,
    replied_count: 1,
  },
  {
    id: 9003, _isDemo: true,
    project_mail_id: null,
    project_title: null,
    subject: '【定期配信】4月の稼働可能エンジニアご案内',
    sent_at: '2026-04-01T09:00:00+09:00',
    sent_by: '新冨 泰明',
    total_count: 42,
    success_count: 40,
    failed_count: 2,
    replied_count: 7,
  },
]

// ── メインコンポーネント ──────────────────────────────────

export default function DeliveriesPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('addresses')
  const [showCampDemo, setShowCampDemo] = useState(false)

  // 配信先一覧
  const [addresses, setAddresses] = useState<PaginatedAddresses | null>(null)
  const [addrSearch, setAddrSearch] = useState('')
  const [addrPage, setAddrPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [skippedList, setSkippedList] = useState<{ row: number; email: string; name: string; reason: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // キャンペーン一覧
  const [campaigns, setCampaigns] = useState<PaginatedCampaigns | null>(null)
  const [campPage, setCampPage]   = useState(1)
  const [campSearch, setCampSearch]     = useState('')
  const [campDateFrom, setCampDateFrom] = useState('')
  const [campDateTo, setCampDateTo]     = useState('')
  const [campUserId, setCampUserId]     = useState('')
  const [campSortBy, setCampSortBy]     = useState<CampSortBy>('sent_at')
  const [campSortDir, setCampSortDir]   = useState<SortDir>('desc')

  // 送信者一覧
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])

  // 新規配信
  const [projectMails, setProjectMails] = useState<ProjectMail[]>([])
  const [pmSearch, setPmSearch] = useState('')
  const [sendForm, setSendForm] = useState({ project_mail_id: '', subject: '', body: '' })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)

  // ── 配信先一覧取得 ────────────────────────────────────
  const fetchAddresses = useCallback(async () => {
    const res = await axios.get('/api/v1/delivery-addresses', {
      params: { search: addrSearch || undefined, page: addrPage, per_page: 100 },
    })
    setAddresses(res.data)
  }, [addrSearch, addrPage])

  useEffect(() => {
    if (tab === 'addresses') fetchAddresses()
  }, [tab, fetchAddresses])

  // ── キャンペーン一覧取得 ──────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    const res = await axios.get('/api/v1/delivery-campaigns', {
      params: {
        page:      campPage,
        search:    campSearch   || undefined,
        date_from: campDateFrom || undefined,
        date_to:   campDateTo   || undefined,
        user_id:   campUserId   || undefined,
        sort_by:   campSortBy,
        sort_dir:  campSortDir,
      },
    })
    setCampaigns(res.data)
  }, [campPage, campSearch, campDateFrom, campDateTo, campUserId, campSortBy, campSortDir])

  useEffect(() => {
    if (tab === 'campaigns') fetchCampaigns()
  }, [tab, fetchCampaigns])

  // 送信者一覧取得
  useEffect(() => {
    axios.get('/api/v1/users').then(res => setSalesUsers(res.data)).catch(() => {})
  }, [])

  // ── 案件メール一覧取得（送信タブ用） ─────────────────
  useEffect(() => {
    if (tab === 'send') {
      axios.get('/api/v1/project-mails', { params: { per_page: 100 } })
        .then(res => setProjectMails(res.data.data ?? []))
        .catch(() => {})
    }
  }, [tab])

  // ── CSVインポート ─────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setSkippedList([])
    setImportProgress({ current: 0, total: 0 })

    // 進捗ポーリング開始
    progressTimerRef.current = setInterval(async () => {
      try {
        const res = await axios.get('/api/v1/delivery-addresses/import-progress')
        setImportProgress({ current: res.data.current, total: res.data.total })
        if (res.data.done) {
          clearInterval(progressTimerRef.current!)
        }
      } catch {}
    }, 500)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post('/api/v1/delivery-addresses/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data.message)
      setSkippedList(res.data.skipped_list ?? [])
      fetchAddresses()
    } catch (err: any) {
      setImportResult(`エラー: ${err.response?.data?.message ?? err.message}`)
    } finally {
      clearInterval(progressTimerRef.current!)
      setImporting(false)
      setImportProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── 有効/無効切替 ─────────────────────────────────────
  const toggleActive = async (addr: DeliveryAddress) => {
    await axios.patch(`/api/v1/delivery-addresses/${addr.id}`, { is_active: !addr.is_active })
    fetchAddresses()
  }

  // ── 新規登録モーダル ──────────────────────────────────
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ email: '', name: '', occupation: '' })
  const [newFormError, setNewFormError] = useState<string | null>(null)
  const [newFormSaving, setNewFormSaving] = useState(false)

  const handleNewAddress = async () => {
    if (!newForm.email) return
    setNewFormSaving(true)
    setNewFormError(null)
    try {
      await axios.post('/api/v1/delivery-addresses', {
        email:      newForm.email,
        name:       newForm.name || null,
        occupation: newForm.occupation || null,
      })
      setShowNewModal(false)
      setNewForm({ email: '', name: '', occupation: '' })
      fetchAddresses()
    } catch (err: any) {
      setNewFormError(err.response?.data?.message ?? 'エラーが発生しました。')
    } finally {
      setNewFormSaving(false)
    }
  }

  // ── 名前インライン編集 ────────────────────────────────
  const [editingNameId, setEditingNameId] = useState<number | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')

  const startEditName = (addr: DeliveryAddress) => {
    setEditingNameId(addr.id)
    setEditingNameValue(addr.name ?? '')
  }

  const saveEditName = async (addr: DeliveryAddress) => {
    await axios.patch(`/api/v1/delivery-addresses/${addr.id}`, { name: editingNameValue })
    setEditingNameId(null)
    fetchAddresses()
  }

  // ── 配信実行 ─────────────────────────────────────────
  const handleSend = async () => {
    if (!sendForm.subject || !sendForm.body) return
    if (!confirm(`配信先リスト全員（有効件数）にメールを送信します。よろしいですか？`)) return
    setSending(true)
    setSendResult(null)
    try {
      await axios.post('/api/v1/delivery-campaigns', {
        project_mail_id: sendForm.project_mail_id ? Number(sendForm.project_mail_id) : null,
        subject: sendForm.subject,
        body: sendForm.body,
      })
      setSendResult({ success: true, message: '配信を開始しました。キャンペーン一覧で進捗を確認できます。' })
      setSendForm({ project_mail_id: '', subject: '', body: '' })
      setTab('campaigns')
      setTimeout(fetchCampaigns, 1000)
    } catch (err: any) {
      setSendResult({ success: false, message: `エラー: ${err.response?.data?.message ?? err.message}` })
    } finally {
      setSending(false)
    }
  }

  // ── ソート切替 ────────────────────────────────────────
  const handleCampSort = (col: CampSortBy) => {
    if (campSortBy === col) {
      setCampSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setCampSortBy(col)
      setCampSortDir('desc')
    }
    setCampPage(1)
  }

  const SortIcon = ({ col }: { col: CampSortBy }) => {
    if (campSortBy !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1 text-blue-500">{campSortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── タブラベル ────────────────────────────────────────
  const tabs: { key: Tab; label: string }[] = [
    { key: 'addresses', label: '配信先一覧' },
    { key: 'campaigns', label: 'キャンペーン履歴' },
    { key: 'send',      label: '新規配信' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">配信管理</h1>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 配信先一覧タブ ─────────────────────────────── */}
      {tab === 'addresses' && (
        <div>
          {/* 操作バー */}
          <div className="flex items-center gap-4 mb-4">
            <input
              type="text"
              placeholder="メール・名前で検索"
              value={addrSearch}
              onChange={e => { setAddrSearch(e.target.value); setAddrPage(1) }}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-sm text-gray-500">
              {addresses ? `全 ${addresses.total} 件` : ''}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { setShowNewModal(true); setNewFormError(null) }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
              >
                新規登録
              </button>
              <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded"
              >
                {importing ? 'インポート中...' : 'CSVインポート'}
              </button>
            </div>
          </div>

          {importing && importProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>インポート中...</span>
                <span>
                  {importProgress.total > 0
                    ? `${importProgress.current} / ${importProgress.total} 件`
                    : 'ファイル読み込み中...'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: importProgress.total > 0
                      ? `${Math.round((importProgress.current / importProgress.total) * 100)}%`
                      : '5%'
                  }}
                />
              </div>
              {importProgress.total > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {Math.round((importProgress.current / importProgress.total) * 100)}%
                </p>
              )}
            </div>
          )}

          {importResult && (
            <div className={`mb-2 px-4 py-2 rounded text-sm ${
              importResult.startsWith('エラー') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {importResult}
            </div>
          )}

          {skippedList.length > 0 && (
            <div className="mb-4 border border-yellow-300 bg-yellow-50 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                スキップされた {skippedList.length} 件
              </p>
              <div className="overflow-y-auto max-h-48">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-yellow-700 border-b border-yellow-200">
                      <th className="px-2 py-1 text-left">行</th>
                      <th className="px-2 py-1 text-left">メールアドレス</th>
                      <th className="px-2 py-1 text-left">名前</th>
                      <th className="px-2 py-1 text-left">理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skippedList.map((s, i) => (
                      <tr key={i} className="border-b border-yellow-100">
                        <td className="px-2 py-1 text-yellow-700">{s.row}</td>
                        <td className="px-2 py-1 text-yellow-900">{s.email}</td>
                        <td className="px-2 py-1 text-yellow-900">{s.name}</td>
                        <td className="px-2 py-1 text-yellow-700">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* テーブル */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">名前</th>
                  <th className="px-4 py-3 text-left">メールアドレス</th>
                  <th className="px-4 py-3 text-left">職種</th>
                  <th className="px-4 py-3 text-center">状態</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {addresses?.data.map((addr, idx) => (
                  <tr key={addr.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-4 py-3 text-gray-800">
                      {editingNameId === addr.id ? (
                        <input
                          autoFocus
                          value={editingNameValue}
                          onChange={e => setEditingNameValue(e.target.value)}
                          onBlur={() => saveEditName(addr)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditName(addr); if (e.key === 'Escape') setEditingNameId(null) }}
                          className="border border-blue-400 rounded px-1 py-0.5 text-sm w-full"
                        />
                      ) : (
                        <span
                          onClick={() => startEditName(addr)}
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                          title="クリックで編集"
                        >
                          {addr.name ?? '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{addr.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{addr.occupation ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        addr.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {addr.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(addr)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {addr.is_active ? '無効にする' : '有効にする'}
                      </button>
                    </td>
                  </tr>
                ))}
                {addresses?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      配信先がありません。CSVをインポートしてください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* ページネーション */}
          {addresses && addresses.last_page > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: addresses.last_page }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setAddrPage(p)}
                  className={`px-3 py-1 rounded text-sm ${
                    p === addresses.current_page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── キャンペーン履歴タブ ────────────────────────── */}
      {tab === 'campaigns' && (
        <div>
          {/* フィルターバー */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">件名・案件・受信者で検索</label>
              <input
                type="text"
                placeholder="件名、案件名、受信者メール・名前..."
                value={campSearch}
                onChange={e => { setCampSearch(e.target.value); setCampPage(1) }}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">送信日 From</label>
              <input
                type="date"
                value={campDateFrom}
                onChange={e => { setCampDateFrom(e.target.value); setCampPage(1) }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">送信日 To</label>
              <input
                type="date"
                value={campDateTo}
                onChange={e => { setCampDateTo(e.target.value); setCampPage(1) }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">送信者</label>
              <select
                value={campUserId}
                onChange={e => { setCampUserId(e.target.value); setCampPage(1) }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">全員</option>
                {salesUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            {(campSearch || campDateFrom || campDateTo || campUserId) && (
              <button
                onClick={() => { setCampSearch(''); setCampDateFrom(''); setCampDateTo(''); setCampUserId(''); setCampPage(1) }}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded"
              >
                リセット
              </button>
            )}
            {campaigns && (
              <span className="text-sm text-gray-500 ml-auto self-center">
                全 {campaigns.total} 件
              </span>
            )}
          </div>

          {/* デモ切替ボタン */}
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setShowCampDemo(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                showCampDemo
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{showCampDemo ? '🔶' : '👁'}</span>
              {showCampDemo ? '返信紐づけ デモ表示中' : '返信紐づけ後のイメージを見る'}
            </button>
          </div>

          {/* デモバナー */}
          {showCampDemo && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">🔶 デモ表示モード</p>
              <p className="text-xs leading-relaxed">
                上部3件はモックデータです。「詳細」を押すとキャンペーン詳細ページで返信内容のイメージを確認できます。
              </p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                <tr>
                  {(
                    [
                      { col: 'sent_at' as CampSortBy, label: '送信日時', align: 'left' },
                      { col: 'sent_by' as CampSortBy, label: '送信者', align: 'left' },
                      { col: 'subject' as CampSortBy, label: '件名', align: 'left' },
                      { col: 'project_title' as CampSortBy, label: '紐づき案件', align: 'left' },
                    ] as const
                  ).map(({ col, label, align }) => (
                    <th
                      key={col}
                      className={`px-4 py-3 text-${align} cursor-pointer select-none hover:bg-gray-100`}
                      onClick={() => handleCampSort(col)}
                    >
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">送信数</th>
                  <th className="px-4 py-3 text-center">成功</th>
                  <th className="px-4 py-3 text-center">失敗</th>
                  <th className="px-4 py-3 text-center">返信率</th>
                  <th className="px-4 py-3 text-center">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...(showCampDemo ? DEMO_CAMPAIGNS : []), ...(campaigns?.data ?? [])].map((camp, idx) => (
                  <tr key={camp.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {camp._isDemo && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">デモ</span>
                        )}
                        {camp.sent_at ? new Date(camp.sent_at).toLocaleString('ja-JP') : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{camp.sent_by ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{camp.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {camp.project_title ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{camp.total_count}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{camp.success_count}</td>
                    <td className="px-4 py-3 text-center text-red-500">{camp.failed_count}</td>
                    <td className="px-4 py-3 text-center">
                      {camp.replied_count != null && camp.success_count > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-blue-600 font-medium text-xs">
                            {Math.round(camp.replied_count / camp.success_count * 100)}%
                          </span>
                          <span className="text-gray-400 text-xs">{camp.replied_count}件</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => router.push(camp._isDemo ? `/deliveries/campaigns/demo?demo=1` : `/deliveries/campaigns/${camp.id}`)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
                {campaigns?.data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      キャンペーン履歴がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {campaigns && campaigns.last_page > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: campaigns.last_page }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCampPage(p)}
                  className={`px-3 py-1 rounded text-sm ${
                    p === campaigns.current_page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 新規配信タブ ────────────────────────────────── */}
      {tab === 'send' && (
        <div className="max-w-2xl overflow-hidden">
          {sendResult && (
            <div className={`mb-4 px-4 py-3 rounded text-sm ${
              sendResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {sendResult.message}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            {/* 案件紐づけ（任意） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                紐づき案件メール <span className="text-gray-400 font-normal">（任意）</span>
              </label>
              <input
                type="text"
                value={pmSearch}
                onChange={e => setPmSearch(e.target.value)}
                placeholder="案件名・会社名で絞り込み..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <select
                value={sendForm.project_mail_id}
                onChange={e => setSendForm(f => ({ ...f, project_mail_id: e.target.value }))}
                className="w-full max-w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">選択しない</option>
                {projectMails
                  .filter(pm => {
                    if (!pmSearch) return true
                    const q = pmSearch.toLowerCase()
                    return (pm.title ?? '').toLowerCase().includes(q) ||
                           (pm.customer_name ?? '').toLowerCase().includes(q)
                  })
                  .map(pm => {
                    const title = pm.title ?? `案件 #${pm.id}`
                    const customer = pm.customer_name ? ` ／ ${pm.customer_name}` : ''
                    const label = `${title}${customer}`
                    return (
                      <option key={pm.id} value={pm.id}>
                        {label.length > 40 ? label.slice(0, 40) + '…' : label}
                      </option>
                    )
                  })}
              </select>
            </div>

            {/* 件名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                件名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sendForm.subject}
                onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="例：【ご紹介】ITエンジニアのご案内"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                本文 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={sendForm.body}
                onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))}
                rows={12}
                placeholder="メール本文を入力してください"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
              />
            </div>

            {/* 配信ボタン */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSend}
                disabled={sending || !sendForm.subject || !sendForm.body}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded"
              >
                {sending ? '送信中...' : '配信先リストへ一括送信'}
              </button>
              <span className="text-xs text-gray-400">
                ※ 有効な配信先全員に送信されます
              </span>
            </div>
          </div>
        </div>
      )}
      {/* ── 新規登録モーダル ──────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">配信先を新規登録</h2>

            {newFormError && (
              <div className="mb-3 px-3 py-2 bg-red-50 text-red-700 text-sm rounded">
                {newFormError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newForm.email}
                  onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="example@company.co.jp"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="山田 太郎"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">職種</label>
                <input
                  type="text"
                  value={newForm.occupation}
                  onChange={e => setNewForm(f => ({ ...f, occupation: e.target.value }))}
                  placeholder="営業担当"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowNewModal(false); setNewForm({ email: '', name: '', occupation: '' }) }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleNewAddress}
                disabled={newFormSaving || !newForm.email}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
              >
                {newFormSaving ? '登録中...' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
