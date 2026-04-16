'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import axios from '@/lib/axios'
import { useRouter } from 'next/navigation'
import SortableHeader from '@/components/SortableHeader'

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
  engineer_mail_source_id: number | null
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

type EngineerMail = {
  id: number
  name: string | null
  email: { subject: string } | null
}

type EmailBodyTemplate = {
  name: string
  name_en: string | null
  department: string | null
  position: string | null
  email: string | null
  mobile: string | null
  body_text?: string | null
}

type DeliveryType = 'project' | 'engineer'

// ベーステンプレート（<送信者>等はapplyTemplate内で置換、<%Name%>はバックエンドで置換）
const TEMPLATE_PROJECT = `<%Name%>様

いつもお世話になっております。
株式会社アイゼン・ソリューションの<送信者>です。

下記案件のご紹介をさせていただきます。
内容をご確認いただき適任要員様いらっしゃいましたらご紹介をお願いいたします。
また、これまでの経験で似たような業務がございましたら経歴書の項番を
ご提示いただけますと幸いです。

また要員様をご紹介いただく場合は下記にお願いいたします。
※下記通りでないとメールがこちらに届かない場合がございます。
　お手数おかけしますがよろしくお願いいたします。

こちらからのご返信に関しまして基本的に動きがあった場合のみ
ご連絡させていただく形になると思います。

<送信者>
To:<送信者アドレス>
CC:outsource@aizen-sol.co.jp
TEL:<送信者TEL>

【案件情報】
-----------------------------------------------------------------------
■案件概要

■募集要項

勤務時間

勤務地：

単価：

時期：


■求める人物像
　・周囲とのコミュニケーションが円滑にとれること
　・必要に応じて周囲へ支援を仰ぎ能動的に動ける人
　・出来ないではなく、実現するためにどうすれば出来るかの思考の方
　・運用なのでお客様業務を優先するといった意識をお持ちの方
　・故障しているようなものを放っておかず復旧と優先に考える方
　・経験の浅い方への指導、支援などを考慮し対応できる方
-----------------------------------------------------------------------
以上となります。
是非よろしくお願いいたします。`

const TEMPLATE_ENGINEER = `<%Name%>様

いつもお世話になっております。
株式会社アイゼン・ソリューションの<送信者>です。

下記技術者のご紹介をさせていただきます。

また案件情報をご紹介いただく場合は下記にお願いいたします。
※下記通りでないとメールがこちらに届かない場合がございます。
　お手数おかけしますがよろしくお願いいたします。

こちらからのご返信に関しまして基本的に動きがあった場合のみ
ご連絡させていただく形になると思います。

<送信者>
To:<送信者アドレス>
CC:outsource@aizen-sol.co.jp
TEL:<送信者TEL>

【技術者情報】
-----------------------------------------------------------------------



ぜひ一度お会いいただき、詳しくお話しさせていただきたく存じます。
面談のご調整をお願いできますでしょうか。
-----------------------------------------------------------------------
以上となります。
是非よろしくお願いいたします。`

/** 署名ブロックを生成する（body_text があれば（本文）以降を抽出、なければフィールドから生成）*/
function buildSignature(tpl: EmailBodyTemplate | null): string {
  if (!tpl) return ''
  if (tpl.body_text) {
    const idx = tpl.body_text.indexOf('（本文）')
    if (idx !== -1) return tpl.body_text.slice(idx + '（本文）'.length).trimStart()
  }
  return `_/_/_/__/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/
株式会社アイゼン・ソリューション
　${tpl.department ?? ''}
　${tpl.position ?? ''}
　${tpl.name}${tpl.name_en ? `（${tpl.name_en}）` : ''}

　〒332-0017
　埼玉県川口市栄町3-12-11 コスモ川口栄町2F
　Tel：048-253-3922　Fax：048-271-9355
　E-Mail：${tpl.email ?? ''}
　Mobile：${tpl.mobile ?? ''}
　URL:https://www.aizen-sol.co.jp
/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/`
}

/** <送信者>等を署名設定から置換し、末尾に署名ブロックを追記する */
function applyTemplate(base: string, tpl: EmailBodyTemplate | null): string {
  let body = base
    .replace(/<送信者>/g,      tpl?.name   ?? '<送信者>')
    .replace(/<送信者アドレス>/g, tpl?.email  ?? '<送信者アドレス>')
    .replace(/<送信者TEL>/g,   tpl?.mobile ?? '<送信者TEL>')
  const sig = buildSignature(tpl)
  if (sig) body += '\n\n' + sig
  return body
}

type Tab = 'addresses' | 'campaigns' | 'send'

// ── デモ用モックデータ ─────────────────────────────────────

const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 9001, _isDemo: true,
    project_mail_id: 1372, engineer_mail_source_id: null,
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
    project_mail_id: 1366, engineer_mail_source_id: null,
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
    project_mail_id: null, engineer_mail_source_id: null,
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
  const [campPage, setCampPage]             = useState(1)
  const [campSearch, setCampSearch]         = useState('')
  const [campDateFrom, setCampDateFrom]     = useState('')
  const [campDateTo, setCampDateTo]         = useState('')
  const [campUserId, setCampUserId]         = useState('')
  const [campDeliveryType, setCampDeliveryType] = useState<'' | 'project' | 'engineer'>('')
  const [campSortBy, setCampSortBy]         = useState<CampSortBy>('sent_at')
  const [campSortDir, setCampSortDir]       = useState<SortDir>('desc')

  // 送信者一覧
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])

  // 新規配信
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('project')
  const [projectMails, setProjectMails] = useState<ProjectMail[]>([])
  const [engineerMails, setEngineerMails] = useState<EngineerMail[]>([])
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)
  const [pmSearch, setPmSearch] = useState('')
  const [sendForm, setSendForm] = useState({ project_mail_id: '', engineer_mail_source_id: '', subject: '【案件ご紹介】', body: applyTemplate(TEMPLATE_PROJECT, null) })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)

  // 添付ファイル
  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragOver, setIsDragOver]     = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return
    setAttachments(prev => [...prev, ...Array.from(files)])
  }
  const removeAttachment = (idx: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx))

  // 送信進捗
  const [sendProgress, setSendProgress] = useState<{
    campaignId: number
    total: number
    success: number
    failed: number
    isSending: boolean
  } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
        page:          campPage,
        search:        campSearch        || undefined,
        date_from:     campDateFrom      || undefined,
        date_to:       campDateTo        || undefined,
        user_id:       campUserId        || undefined,
        delivery_type: campDeliveryType  || undefined,
        sort_by:       campSortBy,
        sort_dir:      campSortDir,
      },
    })
    setCampaigns(res.data)
  }, [campPage, campSearch, campDateFrom, campDateTo, campUserId, campDeliveryType, campSortBy, campSortDir])

  useEffect(() => {
    if (tab === 'campaigns') fetchCampaigns()
  }, [tab, fetchCampaigns])

  // 送信者一覧取得
  useEffect(() => {
    axios.get('/api/v1/users').then(res => setSalesUsers(res.data)).catch(() => {})
  }, [])

  // ── 案件・技術者メール一覧 + 署名設定 取得（送信タブ用） ─
  useEffect(() => {
    if (tab !== 'send') return
    axios.get('/api/v1/project-mails', { params: { per_page: 100 } })
      .then(res => setProjectMails(res.data.data ?? []))
      .catch(() => {})
    axios.get('/api/v1/engineer-mails', { params: { per_page: 200 } })
      .then(res => setEngineerMails(res.data.data ?? []))
      .catch(() => {})
    axios.get('/api/v1/email-body-templates/me')
      .then(res => {
        const tpl: EmailBodyTemplate | null = res.data ?? null
        setEmailTemplate(tpl)
        // 現在のテンプレートに署名を反映
        const currentBase = deliveryType === 'project' ? TEMPLATE_PROJECT : TEMPLATE_ENGINEER
        setSendForm(f => ({ ...f, body: applyTemplate(currentBase, tpl) }))
      })
      .catch(() => {})
  }, [tab])

  // deliveryType 切替時にテンプレート・件名デフォルトを反映・セレクトをリセット
  const handleDeliveryTypeChange = (type: DeliveryType) => {
    setDeliveryType(type)
    const base = type === 'project' ? TEMPLATE_PROJECT : TEMPLATE_ENGINEER
    setSendForm(f => ({
      ...f,
      project_mail_id:         '',
      engineer_mail_source_id: '',
      subject: type === 'project' ? '【案件ご紹介】' : '【技術者ご紹介】',
      body: applyTemplate(base, emailTemplate),
    }))
    setPmSearch('')
  }

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
  const startProgressPolling = (campaignId: number, total: number) => {
    setSendProgress({ campaignId, total, success: 0, failed: 0, isSending: true })
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/v1/delivery-campaigns/${campaignId}/progress`)
        const { total_count, success_count, failed_count, is_sending } = res.data
        setSendProgress({ campaignId, total: total_count, success: success_count, failed: failed_count, isSending: is_sending })
        if (!is_sending) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setTimeout(() => {
            setSendProgress(null)
            setSendForm({ project_mail_id: '', engineer_mail_source_id: '', subject: '【案件ご紹介】', body: applyTemplate(TEMPLATE_PROJECT, null) })
            setDeliveryType('project')
            setAttachments([])
            setPmSearch('')
            setTab('campaigns')
            fetchCampaigns()
          }, 3000)
        }
      } catch {
        clearInterval(pollRef.current!)
        pollRef.current = null
      }
    }, 2000)
  }

  const handleSend = async () => {
    if (!sendForm.subject || !sendForm.body) return
    if (!confirm(`配信先リスト全員（有効件数）にメールを送信します。よろしいですか？`)) return
    setSending(true)
    setSendResult(null)
    try {
      const formData = new FormData()
      formData.append('subject', sendForm.subject)
      formData.append('body',    sendForm.body)
      if (deliveryType === 'project' && sendForm.project_mail_id)
        formData.append('project_mail_id', sendForm.project_mail_id)
      if (deliveryType === 'engineer' && sendForm.engineer_mail_source_id)
        formData.append('engineer_mail_source_id', sendForm.engineer_mail_source_id)
      attachments.forEach(file => formData.append('attachments[]', file))

      const res = await axios.post('/api/v1/delivery-campaigns', formData, {
        headers: { 'Content-Type': undefined },
      })
      const { id, total_count } = res.data
      setSending(false)
      startProgressPolling(id, total_count)
    } catch (err: any) {
      setSendResult({ success: false, message: `エラー: ${err.response?.data?.message ?? err.message}` })
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
              <label className="block text-xs text-gray-500 mb-1">分類</label>
              <select
                value={campDeliveryType}
                onChange={e => { setCampDeliveryType(e.target.value as '' | 'project' | 'engineer'); setCampPage(1) }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">全部</option>
                <option value="project">案件</option>
                <option value="engineer">技術者</option>
              </select>
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
            {(campSearch || campDateFrom || campDateTo || campUserId || campDeliveryType) && (
              <button
                onClick={() => { setCampSearch(''); setCampDateFrom(''); setCampDateTo(''); setCampUserId(''); setCampDeliveryType(''); setCampPage(1) }}
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
                      { col: 'sent_at' as CampSortBy, label: '送信日時' },
                      { col: 'sent_by' as CampSortBy, label: '送信者' },
                      { col: 'subject' as CampSortBy, label: '件名' },
                      { col: 'project_title' as CampSortBy, label: '紐づき案件' },
                    ] as const
                  ).map(({ col, label }) => (
                    <SortableHeader
                      key={col}
                      label={label}
                      field={col}
                      sortField={campSortBy}
                      sortOrder={campSortDir}
                      onSort={(f) => handleCampSort(f as CampSortBy)}
                      className="px-4 py-3"
                    />
                  ))}
                  <th className="px-4 py-3 text-center">分類</th>
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
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{camp.sent_by ?? '-'}</td>
                    <td className="px-4 py-3 w-44">
                      <div className="truncate max-w-[176px] text-gray-800" title={camp.subject}>{camp.subject}</div>
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="truncate max-w-[128px] text-gray-500 text-xs" title={camp.project_title ?? ''}>{camp.project_title ?? '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {camp.engineer_mail_source_id != null
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">技術者</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">案件</span>
                      }
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
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
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

          {/* 送信進捗 */}
          {sendProgress && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center text-sm text-blue-800 mb-2">
                <span className="font-medium">
                  {sendProgress.isSending ? '送信中...' : '送信完了'}
                </span>
                <span>
                  {sendProgress.success + sendProgress.failed} 件目 / {sendProgress.total} 件中
                </span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2.5 mb-2">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${sendProgress.isSending ? 'bg-blue-500' : 'bg-green-500'}`}
                  style={{ width: `${sendProgress.total ? ((sendProgress.success + sendProgress.failed) / sendProgress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-green-700">成功: {sendProgress.success}</span>
                <span className="text-red-600">失敗: {sendProgress.failed}</span>
                {!sendProgress.isSending && (
                  <span className="text-blue-600 ml-auto">まもなくキャンペーン一覧へ移動します</span>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            {/* 案件 / 技術者 切替 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">配信種別</label>
              <div className="flex gap-6">
                {(['project', 'engineer'] as const).map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deliveryType"
                      value={type}
                      checked={deliveryType === type}
                      onChange={() => handleDeliveryTypeChange(type)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{type === 'project' ? '案件' : '技術者'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 紐づきメール（任意） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {deliveryType === 'project' ? '紐づき案件メール' : '紐づき技術者メール'}
                <span className="text-gray-400 font-normal ml-1">（任意）</span>
              </label>
              <input
                type="text"
                value={pmSearch}
                onChange={e => setPmSearch(e.target.value)}
                placeholder={deliveryType === 'project' ? '案件名・会社名で絞り込み...' : '件名・技術者名で絞り込み...'}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {deliveryType === 'project' ? (
                <select
                  value={sendForm.project_mail_id}
                  onChange={e => setSendForm(f => ({ ...f, project_mail_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                          {label.length > 50 ? label.slice(0, 50) + '…' : label}
                        </option>
                      )
                    })}
                </select>
              ) : (
                <select
                  value={sendForm.engineer_mail_source_id}
                  onChange={e => setSendForm(f => ({ ...f, engineer_mail_source_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">選択しない</option>
                  {engineerMails
                    .filter(em => {
                      if (!pmSearch) return true
                      const q = pmSearch.toLowerCase()
                      return (em.email?.subject ?? '').toLowerCase().includes(q) ||
                             (em.name ?? '').toLowerCase().includes(q)
                    })
                    .map(em => {
                      const subject = em.email?.subject ?? `技術者メール #${em.id}`
                      const name = em.name ? ` ／ ${em.name}` : ''
                      const label = `${subject}${name}`
                      return (
                        <option key={em.id} value={em.id}>
                          {label.length > 50 ? label.slice(0, 50) + '…' : label}
                        </option>
                      )
                    })}
                </select>
              )}
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

            {/* 添付ファイル */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">添付ファイル</label>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFileAdd(e.dataTransfer.files) }}
                onClick={() => attachmentInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
                  isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm text-gray-500">クリックまたはドラッグ＆ドロップでファイルを追加</p>
                <p className="text-xs text-gray-400 mt-0.5">1ファイル最大 10MB</p>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => { handleFileAdd(e.target.files); e.target.value = '' }}
                />
              </div>
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((file, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                      <span className="truncate text-gray-700">{file.name}
                        <span className="ml-2 text-xs text-gray-400">
                          {file.size < 1024 * 1024
                            ? `${(file.size / 1024).toFixed(1)} KB`
                            : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="ml-3 text-gray-400 hover:text-red-500 shrink-0"
                      >✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 配信ボタン */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSend}
                disabled={sending || !!sendProgress || !sendForm.subject || !sendForm.body}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded"
              >
                {sending ? '送信準備中...' : '配信先リストへ一括送信'}
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
