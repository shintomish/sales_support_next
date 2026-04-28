'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import axios from '@/lib/axios'
import { useRouter, useSearchParams } from 'next/navigation'
import SortableHeader from '@/components/SortableHeader'

// ── 型定義 ────────────────────────────────────────────────

type DeliveryAddress = {
  id: number
  email: string
  name: string | null
  zip_code: string | null
  prefecture: string | null
  address: string | null
  tel: string | null
  occupation: string | null
  is_active: boolean
}

type EditAddressForm = {
  email: string
  name: string
  zip_code: string
  prefecture: string
  address: string
  tel: string
  occupation: string
  is_active: boolean
}

type SavedAddressState = {
  label: string
  created_at: string | null
  count: number
}

type PaginatedAddresses = {
  data: DeliveryAddress[]
  current_page: number
  last_page: number
  total: number
  all_count?: number
  active_count?: number
  saved_state?: SavedAddressState | null
}

type Campaign = {
  id: number
  project_mail_id: number | null
  engineer_mail_source_id: number | null
  project_title: string | null
  engineer_mail_title: string | null
  subject: string
  sent_at: string | null
  sent_by: string | null
  total_count: number
  success_count: number
  failed_count: number
  replied_count?: number
}

type SendHistory = {
  id: number
  email: string
  name: string | null
  status: 'sent' | 'failed' | 'replied'
  replied_at: string | null
  reply_subject: string | null
  reply_received_at: string | null
  reply_body_snippet?: string | null
  reply_body_text?: string | null
  reply_from?: string | null
  reply_from_name?: string | null
}

type CampaignDetail = Campaign & {
  body: string
  histories: SendHistory[]
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

type ThreadLastActivity = {
  type: 'sent' | 'received'
  subject: string | null
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
  last_activity: ThreadLastActivity | null
  last_sent: ThreadLastActivity | null
  last_received: ThreadLastActivity | null
  thread_count: number
  has_unread_reply: boolean
}

type PaginatedThreads = {
  data: ProposalThread[]
  current_page: number
  last_page: number
  total: number
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
  total_count?: number
  success_count?: number
  failed_count?: number
}

const THREAD_STATUS_COLORS: Record<string, string> = {
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

const THREAD_STATUS_LABELS: Record<string, string> = {
  new: '新着', review: '要確認', proposed: '提案済', interview: '面談',
  won: '成約', lost: '失注', excluded: '除外',
  registered: '登録済', proposing: '提案中', working: '稼働中',
}

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

type Tab = 'addresses' | 'campaigns' | 'threads' | 'send'

// ── メインコンポーネント ──────────────────────────────────

export default function DeliveriesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initTab = searchParams.get('tab') as Tab | null
  const initProjectMailId = searchParams.get('project_mail_id')
  const initEngineerMailId = searchParams.get('engineer_mail_id')
  const initDeliveryType = searchParams.get('delivery_type') as DeliveryType | null
  const [tab, setTab] = useState<Tab>(initTab || 'addresses')

  // 配信先一覧
  const [addresses, setAddresses] = useState<PaginatedAddresses | null>(null)
  const [addrSearch, setAddrSearch] = useState('')
  const [addrPage, setAddrPage] = useState(1)
  const [addrSortBy, setAddrSortBy] = useState('id')
  const [addrSortOrder, setAddrSortOrder] = useState<'asc' | 'desc'>('asc')

  const handleAddrSort = (field: string) => {
    if (addrSortBy === field) { setAddrSortOrder(o => o === 'asc' ? 'desc' : 'asc') }
    else { setAddrSortBy(field); setAddrSortOrder('asc') }
    setAddrPage(1)
  }
  // 提案スレッド
  const [threads, setThreads] = useState<PaginatedThreads | null>(null)
  const [threadPage, setThreadPage] = useState(1)
  const [threadTypeFilter, setThreadTypeFilter] = useState<'' | 'project' | 'engineer'>('')
  const [threadStatusFilter, setThreadStatusFilter] = useState('')
  const [threadSearch, setThreadSearch] = useState('')
  const [threadLoading, setThreadLoading] = useState(false)

  const fetchThreads = useCallback(async () => {
    setThreadLoading(true)
    try {
      const res = await axios.get('/api/v1/proposal-threads', {
        params: {
          page: threadPage, per_page: 30,
          type: threadTypeFilter || undefined,
          status: threadStatusFilter || undefined,
          search: threadSearch || undefined,
        },
      })
      setThreads(res.data)
    } catch { setThreads(null) }
    finally { setThreadLoading(false) }
  }, [threadPage, threadTypeFilter, threadStatusFilter, threadSearch])

  useEffect(() => {
    if (tab === 'threads') fetchThreads()
  }, [tab, fetchThreads])

  // 提案スレッドのアコーディオン展開
  const [expandedThreadKey, setExpandedThreadKey] = useState<string | null>(null)
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({})
  const [threadDetailLoadingKey, setThreadDetailLoadingKey] = useState<string | null>(null)

  const handleToggleThread = async (t: ProposalThread) => {
    const key = `${t.type}-${t.source_id}`
    if (expandedThreadKey === key) {
      setExpandedThreadKey(null)
      return
    }
    setExpandedThreadKey(key)

    {
      setThreadDetailLoadingKey(key)
      try {
        const path = t.type === 'project'
          ? `/api/v1/project-mails/${t.source_id}/thread`
          : `/api/v1/engineer-mails/${t.source_id}/thread`
        const res = await axios.get<{ thread: ThreadMessage[] }>(path)
        const thread = res.data.thread ?? []
        setThreadCache(prev => ({ ...prev, [key]: thread }))

        if (t.has_unread_reply) {
          const replyIds = thread
            .filter(m => m.type === 'received' && typeof m.email_id === 'number')
            .map(m => m.email_id as number)
          if (replyIds.length > 0) {
            await Promise.all(
              replyIds.map(id => axios.get(`/api/v1/emails/${id}`).catch(() => null))
            )
            setThreads(prev => prev ? {
              ...prev,
              data: prev.data.map(x =>
                `${x.type}-${x.source_id}` === key ? { ...x, has_unread_reply: false } : x
              ),
            } : prev)
          }
        }
      } catch {
        setThreadCache(prev => ({ ...prev, [key]: [] }))
      } finally {
        setThreadDetailLoadingKey(null)
      }
    }
  }

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
  const [mailBodyText, setMailBodyText] = useState('')
  const [mailBodyOpen, setMailBodyOpen] = useState(false)

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
      params: { search: addrSearch || undefined, page: addrPage, per_page: 100, sort_by: addrSortBy, sort_order: addrSortOrder },
    })
    setAddresses(res.data)
  }, [addrSearch, addrPage, addrSortBy, addrSortOrder])

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
        exclude_proposals: 1,
        sort_by:       campSortBy,
        sort_dir:      campSortDir,
      },
    })
    setCampaigns(res.data)
  }, [campPage, campSearch, campDateFrom, campDateTo, campUserId, campDeliveryType, campSortBy, campSortDir])

  useEffect(() => {
    if (tab === 'campaigns') fetchCampaigns()
  }, [tab, fetchCampaigns])

  // 配信履歴のアコーディオン展開
  const [expandedCampId, setExpandedCampId] = useState<number | null>(null)
  const [campDetailCache, setCampDetailCache] = useState<Record<number, CampaignDetail>>({})
  const [campDetailLoadingId, setCampDetailLoadingId] = useState<number | null>(null)

  const handleToggleCamp = async (id: number) => {
    if (expandedCampId === id) {
      setExpandedCampId(null)
      return
    }
    setExpandedCampId(id)
    if (!campDetailCache[id]) {
      setCampDetailLoadingId(id)
      try {
        const res = await axios.get<CampaignDetail>(`/api/v1/delivery-campaigns/${id}`)
        setCampDetailCache(prev => ({ ...prev, [id]: res.data }))
      } catch {
        // 取得失敗時はキャッシュに空データを入れず、再試行可能にする
      } finally {
        setCampDetailLoadingId(null)
      }
    }
  }

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

  // クエリパラメータから案件メール自動選択
  const autoSelectDone = useRef(false)
  useEffect(() => {
    if (!initProjectMailId || autoSelectDone.current || tab !== 'send') return
    autoSelectDone.current = true
    ;(async () => {
      try {
        // 署名テンプレート取得を待つ
        const tplRes = await axios.get('/api/v1/email-body-templates/me').catch(() => ({ data: null }))
        const tpl: EmailBodyTemplate | null = tplRes.data ?? null
        setEmailTemplate(tpl)

        const res = await axios.get(`/api/v1/project-mails/${initProjectMailId}`)
        const pm = res.data
        const emailSubject = pm.email?.subject ?? pm.title ?? ''
        setMailBodyText(pm.email?.body_text ?? '')
        const projectInfo = `■案件概要\n${pm.title ?? ''}\n\n■募集要項\n${(pm.required_skills ?? []).join('、')}\n\n勤務時間\n\n勤務地：${pm.work_location ?? ''}\n\n単価：${pm.unit_price_min ?? ''}〜${pm.unit_price_max ?? ''}万円\n\n時期：${pm.start_date ?? ''}`
        const baseBody = applyTemplate(TEMPLATE_PROJECT, tpl)
        const updatedBody = baseBody.replace(
          /■案件概要[\s\S]*?(?=\n\n■求める人物像|\n-{3,})/,
          projectInfo
        )
        setSendForm({
          project_mail_id: initProjectMailId,
          engineer_mail_source_id: '',
          subject: `【案件ご紹介】${emailSubject}`,
          body: updatedBody,
        })
      } catch {}
    })()
  }, [tab, initProjectMailId])

  // クエリパラメータから技術者メール自動選択
  const autoSelectEngDone = useRef(false)
  useEffect(() => {
    if (!initEngineerMailId || autoSelectEngDone.current || tab !== 'send') return
    autoSelectEngDone.current = true
    if (initDeliveryType === 'engineer') setDeliveryType('engineer')
    ;(async () => {
      try {
        const tplRes = await axios.get('/api/v1/email-body-templates/me').catch(() => ({ data: null }))
        const tpl: EmailBodyTemplate | null = tplRes.data ?? null
        setEmailTemplate(tpl)

        const res = await axios.get(`/api/v1/engineer-mails/${initEngineerMailId}`)
        const em = res.data
        const emailSubject = em.email?.subject ?? em.name ?? ''
        setMailBodyText(em.email?.body_text ?? '')
        const skills = (em.skills ?? []).join('、')
        const engineerInfo = `氏名：${em.name ?? ''}\n年齢：${em.age ?? ''}歳\nスキル：${skills}\n最寄駅：${em.nearest_station ?? ''}\n稼働可能日：${em.available_from ?? ''}`
        let comment = ''
        try {
          const commentRes = await axios.post(`/api/v1/engineer-mails/${initEngineerMailId}/generate-comment`)
          comment = commentRes.data.comment ?? ''
        } catch {}
        const baseBody = applyTemplate(TEMPLATE_ENGINEER, tpl)
        const commentBlock = comment ? `\n${comment}\n` : '\n'
        const infoReplacement = `【技術者情報】\n-----------------------------------------------------------------------\n${engineerInfo}\n${commentBlock}`
        const infoPattern = /【技術者情報】\n-{3,}\n[\s\S]*?(?=\nぜひ一度)/
        const updatedBody = infoPattern.test(baseBody)
          ? baseBody.replace(infoPattern, infoReplacement)
          : baseBody
        setSendForm({
          project_mail_id: '',
          engineer_mail_source_id: initEngineerMailId,
          subject: `【技術者ご紹介】${emailSubject}`,
          body: updatedBody,
        })
      } catch {}
    })()
  }, [tab, initEngineerMailId, initDeliveryType])

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
    setMailBodyText('')
    setMailBodyOpen(false)
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

  // ── 全有効・全無効・状態保存 ────────────────────────
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)

  const handleBulkSetActive = async (active: boolean) => {
    const label = active ? '全有効' : '全無効'
    if (!confirm(`配信先全件を ${label} にします。よろしいですか？`)) return
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const res = await axios.post('/api/v1/delivery-addresses/bulk-set-active', { is_active: active })
      setBulkMsg(res.data?.message ?? `${label}に更新しました`)
      fetchAddresses()
    } catch {
      setBulkMsg('一括更新に失敗しました')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleSaveState = async () => {
    if (!confirm('現在の有効/無効状態をラベル "A" で保存します（既存の保存状態は上書きされます）。よろしいですか？')) return
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const res = await axios.post('/api/v1/delivery-addresses/save-state', { label: 'A' })
      setBulkMsg(res.data?.message ?? '状態を保存しました')
      fetchAddresses()
    } catch {
      setBulkMsg('状態の保存に失敗しました')
    } finally {
      setBulkBusy(false)
    }
  }

  const handleRestoreState = async () => {
    const saved = addresses?.saved_state
    if (!saved) {
      alert('保存された状態がありません。先に「現在の状態を保存」してください。')
      return
    }
    if (!confirm(`保存状態「${saved.label}」(${saved.count}件) に復元します。現在の有効/無効は上書きされます。よろしいですか？`)) return
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const res = await axios.post('/api/v1/delivery-addresses/restore-state')
      setBulkMsg(res.data?.message ?? '状態を復元しました')
      fetchAddresses()
    } catch {
      setBulkMsg('状態の復元に失敗しました')
    } finally {
      setBulkBusy(false)
    }
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

  // ── 編集モーダル ─────────────────────────────────────
  const [editingAddrId, setEditingAddrId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditAddressForm>({
    email: '', name: '', zip_code: '', prefecture: '', address: '', tel: '', occupation: '', is_active: true,
  })
  const [editFormError, setEditFormError] = useState<string | null>(null)
  const [editFormSaving, setEditFormSaving] = useState(false)

  const startEditAddress = (addr: DeliveryAddress) => {
    setEditingAddrId(addr.id)
    setEditForm({
      email:      addr.email,
      name:       addr.name ?? '',
      zip_code:   addr.zip_code ?? '',
      prefecture: addr.prefecture ?? '',
      address:    addr.address ?? '',
      tel:        addr.tel ?? '',
      occupation: addr.occupation ?? '',
      is_active:  addr.is_active,
    })
    setEditFormError(null)
  }

  const handleEditSave = async () => {
    if (!editingAddrId || !editForm.email) return
    setEditFormSaving(true)
    setEditFormError(null)
    try {
      await axios.patch(`/api/v1/delivery-addresses/${editingAddrId}`, {
        email:      editForm.email,
        name:       editForm.name || null,
        zip_code:   editForm.zip_code || null,
        prefecture: editForm.prefecture || null,
        address:    editForm.address || null,
        tel:        editForm.tel || null,
        occupation: editForm.occupation || null,
        is_active:  editForm.is_active,
      })
      setEditingAddrId(null)
      fetchAddresses()
    } catch (err: any) {
      setEditFormError(err.response?.data?.message ?? 'エラーが発生しました。')
    } finally {
      setEditFormSaving(false)
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

  // 未置換プレースホルダ検出（<%Name%> は除外: 送信時にバックエンドで配信先名に置換される）
  const findUnresolvedPlaceholders = (text: string): string[] => {
    const matches = text.match(/<送信者[^>]*>/g)
    return matches ? Array.from(new Set(matches)) : []
  }

  const unresolvedPlaceholders = findUnresolvedPlaceholders((sendForm.subject ?? '') + '\n' + (sendForm.body ?? ''))

  const handleSend = async () => {
    if (!sendForm.subject || !sendForm.body) return
    if (unresolvedPlaceholders.length > 0) {
      alert(`未置換のプレースホルダがあります:\n${unresolvedPlaceholders.join(' / ')}\n\nメール署名設定（/settings/email-template）を確認してください。`)
      return
    }
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
    { key: 'campaigns', label: '一斉配信履歴' },
    { key: 'threads',   label: '提案スレッド' },
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
              {addresses
                ? `全 ${addresses.all_count ?? addresses.total} 件 / 有効 ${addresses.active_count ?? '-'} 件`
                : ''}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleSaveState}
                disabled={bulkBusy}
                className="border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm px-3 py-2 rounded">
                💾 現在の状態を保存
              </button>
              <button
                onClick={handleRestoreState}
                disabled={bulkBusy || !addresses?.saved_state}
                title={addresses?.saved_state
                  ? `保存日時: ${addresses.saved_state.created_at ? new Date(addresses.saved_state.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '不明'}（${addresses.saved_state.count}件）`
                  : '保存された状態がありません'}
                className="border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm px-3 py-2 rounded">
                ↩ 保存状態{addresses?.saved_state ? `「${addresses.saved_state.label}」` : 'A'}に戻す
              </button>
              <button
                onClick={() => handleBulkSetActive(true)}
                disabled={bulkBusy}
                className="border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 text-sm px-3 py-2 rounded">
                全有効
              </button>
              <button
                onClick={() => handleBulkSetActive(false)}
                disabled={bulkBusy}
                className="border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-gray-600 text-sm px-3 py-2 rounded">
                全無効
              </button>
              <span className="w-px h-6 bg-gray-200 mx-1" />
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

          {bulkMsg && (
            <div className="mb-2 px-4 py-2 rounded text-sm bg-blue-50 text-blue-700 border border-blue-200">
              {bulkMsg}
            </div>
          )}

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
                  <th className="px-4 py-3 w-16 text-left text-xs font-semibold text-gray-600">No.</th>
                  <SortableHeader label="名前" field="name" sortField={addrSortBy} sortOrder={addrSortOrder} onSort={handleAddrSort} className="px-4 py-3" />
                  <SortableHeader label="メールアドレス" field="email" sortField={addrSortBy} sortOrder={addrSortOrder} onSort={handleAddrSort} className="px-4 py-3" />
                  <SortableHeader label="職種" field="occupation" sortField={addrSortBy} sortOrder={addrSortOrder} onSort={handleAddrSort} className="px-4 py-3" />
                  <SortableHeader label="状態" field="is_active" sortField={addrSortBy} sortOrder={addrSortOrder} onSort={handleAddrSort} className="px-4 py-3 text-center" />
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {addresses?.data.map((addr, idx) => (
                  <tr key={addr.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{(addrPage - 1) * 100 + idx + 1}</td>
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
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => startEditAddress(addr)}
                          className="text-xs text-gray-700 hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => toggleActive(addr)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {addr.is_active ? '無効にする' : '有効にする'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {addresses?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-3 w-8" />
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
                {(campaigns?.data ?? []).map((camp, idx) => {
                  const isExpanded = expandedCampId === camp.id
                  const isDetailLoading = campDetailLoadingId === camp.id
                  const detail = campDetailCache[camp.id]
                  return (
                    <Fragment key={camp.id}>
                      <tr
                        onClick={() => handleToggleCamp(camp.id)}
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer`}>
                        <td className="px-2 py-3 text-center text-gray-400 text-xs">
                          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {camp.sent_at ? new Date(camp.sent_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{camp.sent_by ?? '-'}</td>
                        <td className="px-4 py-3 w-44">
                          <div className="truncate max-w-[176px] text-gray-800" title={camp.subject}>{camp.subject}</div>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <div className="truncate max-w-[128px] text-gray-500 text-xs" title={camp.project_title ?? camp.engineer_mail_title ?? ''}>{camp.project_title ?? camp.engineer_mail_title ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {camp.engineer_mail_source_id != null
                            ? <span
                                onClick={e => { e.stopPropagation(); router.push(`/engineer-mails?select=${camp.engineer_mail_source_id}`) }}
                                className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium cursor-pointer hover:bg-purple-200 transition-colors"
                              >技術者</span>
                            : camp.project_mail_id != null
                              ? <span
                                  onClick={e => { e.stopPropagation(); router.push(`/project-mails?select=${camp.project_mail_id}`) }}
                                  className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium cursor-pointer hover:bg-blue-200 transition-colors"
                                >案件</span>
                              : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">配信</span>
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
                            onClick={e => {
                              e.stopPropagation()
                              router.push(`/deliveries/campaigns/${camp.id}`)
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={11} className="px-6 py-4 border-t border-gray-200">
                            {isDetailLoading && (
                              <div className="text-xs text-gray-400">読み込み中...</div>
                            )}
                            {!isDetailLoading && !detail && (
                              <div className="text-xs text-gray-400">読み込みに失敗しました</div>
                            )}
                            {!isDetailLoading && detail && (
                              <div className="space-y-3">
                                {/* 送信メール */}
                                <div className="rounded-lg border p-3 bg-blue-50 border-blue-100 ml-8">
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-blue-600">→ 送信</span>
                                    <span className="text-xs text-gray-400">
                                      {detail.sent_at ? new Date(detail.sent_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      送信数: {detail.total_count}件（成功: {detail.success_count} / 失敗: {detail.failed_count}）
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-800 mb-1">{detail.subject}</p>
                                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans break-words">{detail.body?.replace(/<%Name%>/g, '（各配信先名）')}</pre>
                                </div>

                                {/* 返信一覧 */}
                                {detail.histories.filter(h => h.status === 'replied').length > 0 && (
                                  <div className="space-y-3">
                                    {detail.histories.filter(h => h.status === 'replied').map(h => (
                                      <div key={h.id} className="rounded-lg border p-3 bg-white border-gray-200 mr-8">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                          <span className="text-xs font-bold text-gray-700">← 受信</span>
                                          <span className="text-xs text-gray-400">
                                            {h.replied_at ? new Date(h.replied_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            From: {h.reply_from_name ?? h.reply_from ?? h.name ?? h.email}
                                          </span>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800 mb-1">{h.reply_subject ?? '（件名なし）'}</p>
                                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans break-words">
                                          {h.reply_body_text ?? h.reply_body_snippet ?? ''}
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* 送信先サマリー（失敗があれば表示） */}
                                {detail.histories.some(h => h.status === 'failed') && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-red-600 mb-1">送信失敗:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {detail.histories.filter(h => h.status === 'failed').map(h => (
                                        <span key={h.id} className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-2 py-0.5">
                                          {h.name ?? h.email}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {campaigns?.data.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
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

      {/* ── 提案スレッドタブ ────────────────────────────── */}
      {tab === 'threads' && (
        <div>
          {/* フィルタ */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <select value={threadTypeFilter} onChange={e => { setThreadTypeFilter(e.target.value as '' | 'project' | 'engineer'); setThreadPage(1) }}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5">
              <option value="">全タイプ</option>
              <option value="project">案件メール</option>
              <option value="engineer">技術者メール</option>
            </select>
            <select value={threadStatusFilter} onChange={e => { setThreadStatusFilter(e.target.value); setThreadPage(1) }}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5">
              <option value="">全ステータス</option>
              <option value="new">新着</option>
              <option value="review">要確認</option>
              <option value="proposed">提案済</option>
              <option value="interview">面談</option>
              <option value="won">成約</option>
              <option value="lost">失注</option>
            </select>
            <input type="text" placeholder="顧客名・技術者名で検索" value={threadSearch}
              onChange={e => { setThreadSearch(e.target.value); setThreadPage(1) }}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-64" />
            {threads && <span className="text-xs text-gray-400 ml-auto">{threads.total}件</span>}
          </div>

          {/* 一覧 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {threadLoading && (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">読み込み中...</div>
            )}
            {!threadLoading && (!threads || threads.data.length === 0) && (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">提案スレッドはありません</div>
            )}
            {!threadLoading && threads && threads.data.map(t => {
              const key = `${t.type}-${t.source_id}`
              const isExpanded = expandedThreadKey === key
              const isDetailLoading = threadDetailLoadingKey === key
              const detail = threadCache[key]
              return (
                <div key={key} className="border-b border-gray-100">
                  <div
                    onClick={() => handleToggleThread(t)}
                    className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${t.has_unread_reply ? 'bg-yellow-50/60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-gray-400 text-xs mt-2 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${t.type === 'project' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                        {t.type === 'project' ? '案' : '技'}
                      </div>
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
                        {t.last_sent && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-xs font-bold text-blue-600">→ 送信</span>
                            <span className="text-xs text-gray-400">{formatDateTime(t.last_sent.datetime)}</span>
                            <span className="text-xs text-gray-600 truncate">{t.last_sent.subject}</span>
                          </div>
                        )}
                        {t.last_received && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs font-bold text-gray-700">← 受信</span>
                            <span className="text-xs text-gray-400">{formatDateTime(t.last_received.datetime)}</span>
                            <span className="text-xs text-gray-600 truncate">{t.last_received.subject}</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          router.push(t.type === 'project' ? `/project-mails?select=${t.source_id}` : `/engineer-mails?select=${t.source_id}`)
                        }}
                        className="text-xs border border-gray-300 bg-white text-gray-700 rounded px-2 py-1 hover:bg-gray-50 flex-shrink-0 self-center whitespace-nowrap"
                        title={t.type === 'project' ? '案件メールを開く' : '技術者メールを開く'}>
                        {t.type === 'project' ? '案件メール' : '技術者メール'} →
                      </button>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${THREAD_STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {THREAD_STATUS_LABELS[t.status] ?? t.status}
                        </span>
                        <span className="text-xs text-gray-400">💬 {t.thread_count}</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                      {isDetailLoading && (
                        <div className="text-xs text-gray-400 py-2">読み込み中...</div>
                      )}
                      {!isDetailLoading && detail && detail.length === 0 && (
                        <div className="text-xs text-gray-400 py-2">やり取りはありません</div>
                      )}
                      {!isDetailLoading && detail && detail.length > 0 && (
                        <div className="space-y-3">
                          {detail.map((m, i) => (
                            <div key={i} className={`rounded-lg border p-3 ${m.type === 'sent' ? 'bg-blue-50 border-blue-100 ml-8' : 'bg-white border-gray-200 mr-8'}`}>
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`text-xs font-bold ${m.type === 'sent' ? 'text-blue-600' : 'text-gray-700'}`}>
                                  {m.type === 'sent' ? '→ 送信' : '← 受信'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatDateTime((m.sent_at ?? m.received_at) ?? '')}
                                </span>
                                {m.type === 'sent' && m.total_count != null && (
                                  <span className="text-xs text-gray-500">
                                    送信数: {m.total_count}件（成功: {m.success_count ?? 0} / 失敗: {m.failed_count ?? 0}）
                                  </span>
                                )}
                                {m.type !== 'sent' && (
                                  <span className="text-xs text-gray-500 truncate">
                                    From: {m.from_name ?? m.from ?? ''}
                                  </span>
                                )}
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
          {threads && threads.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">{threads.current_page} / {threads.last_page} ページ</span>
              <div className="flex gap-2">
                <button disabled={threads.current_page <= 1} onClick={() => setThreadPage(p => p - 1)}
                  className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">前へ</button>
                <button disabled={threads.current_page >= threads.last_page} onClick={() => setThreadPage(p => p + 1)}
                  className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">次へ</button>
              </div>
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
                  onChange={async e => {
                    const val = e.target.value
                    setSendForm(f => ({ ...f, project_mail_id: val }))
                    if (!val) {
                      setMailBodyText('')
                      setSendForm(f => ({ ...f, subject: '【案件ご紹介】', body: applyTemplate(TEMPLATE_PROJECT, emailTemplate) }))
                      return
                    }
                    try {
                      const res = await axios.get(`/api/v1/project-mails/${val}`)
                      const pm = res.data
                      const emailSubject = pm.email?.subject ?? pm.title ?? ''
                      setMailBodyText(pm.email?.body_text ?? '')
                      // 件名更新
                      setSendForm(f => ({ ...f, subject: `【案件ご紹介】${emailSubject}` }))
                      // 本文の案件情報セクションを更新
                      const projectInfo = `■案件概要\n${pm.title ?? ''}\n\n■募集要項\n${(pm.required_skills ?? []).join('、')}\n\n勤務時間\n\n勤務地：${pm.work_location ?? ''}\n\n単価：${pm.unit_price_min ?? ''}〜${pm.unit_price_max ?? ''}万円\n\n時期：${pm.start_date ?? ''}`
                      setSendForm(f => {
                        const body = f.body.replace(
                          /■案件概要[\s\S]*?(?=\n\n■求める人物像|\n-{3,})/,
                          projectInfo
                        )
                        return { ...f, body }
                      })
                    } catch {}
                  }}
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
                  onChange={async e => {
                    const val = e.target.value
                    setSendForm(f => ({ ...f, engineer_mail_source_id: val }))
                    if (!val) {
                      setMailBodyText('')
                      setSendForm(f => ({ ...f, subject: '【技術者ご紹介】', body: applyTemplate(TEMPLATE_ENGINEER, emailTemplate) }))
                      return
                    }
                    try {
                      const res = await axios.get(`/api/v1/engineer-mails/${val}`)
                      const em = res.data
                      const emailSubject = em.email?.subject ?? em.name ?? ''
                      setMailBodyText(em.email?.body_text ?? '')
                      // 件名更新
                      setSendForm(f => ({ ...f, subject: `【技術者ご紹介】${emailSubject}` }))
                      // 本文の技術者情報セクションを更新
                      const skills = (em.skills ?? []).join('、')
                      const engineerInfo = `氏名：${em.name ?? ''}\n年齢：${em.age ?? ''}歳\nスキル：${skills}\n最寄駅：${em.nearest_station ?? ''}\n稼働可能日：${em.available_from ?? ''}`
                      // 前向きコメント生成
                      let comment = ''
                      try {
                        const commentRes = await axios.post(`/api/v1/engineer-mails/${val}/generate-comment`)
                        comment = commentRes.data.comment ?? ''
                      } catch {}
                      setSendForm(f => {
                        const infoBlock = `【技術者情報】\n-----------------------------------------------------------------------\n${engineerInfo}\n`
                        const commentBlock = comment ? `\n${comment}\n` : '\n'
                        const pattern = /【技術者情報】\n-{3,}\n[\s\S]*?(?=\nぜひ一度)/
                        let body = f.body
                        if (pattern.test(body)) {
                          body = body.replace(pattern, `${infoBlock}${commentBlock}`)
                        } else {
                          // 正規表現がマッチしない場合、テンプレートから再構築
                          const base = applyTemplate(TEMPLATE_ENGINEER, emailTemplate)
                          body = base.replace(pattern, `${infoBlock}${commentBlock}`)
                        }
                        return { ...f, body }
                      })
                    } catch {}
                  }}
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

            {/* 元メール本文 */}
            {mailBodyText && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMailBodyOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                >
                  <span>📧 元メール本文</span>
                  <span className="text-gray-400">{mailBodyOpen ? '▲ 閉じる' : '▼ 開く'}</span>
                </button>
                {mailBodyOpen && (
                  <div className="px-4 py-3 bg-white max-h-64 overflow-y-auto border-t border-gray-200">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{mailBodyText}</pre>
                  </div>
                )}
              </div>
            )}

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

            {/* 未置換プレースホルダ警告 */}
            {unresolvedPlaceholders.length > 0 && (
              <div className="px-4 py-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                <p className="font-semibold mb-1">⚠ 未置換のプレースホルダがあります</p>
                <p className="text-xs">
                  {unresolvedPlaceholders.join(' / ')} がそのまま残っています。
                  <a href="/settings/email-template" className="underline ml-1">メール署名設定</a>
                  を確認してください。
                </p>
              </div>
            )}

            {/* 配信ボタン */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSend}
                disabled={sending || !!sendProgress || !sendForm.subject || !sendForm.body || unresolvedPlaceholders.length > 0}
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
      {/* ── 編集モーダル ──────────────────────────────── */}
      {editingAddrId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">配信先を編集</h2>

            {editFormError && (
              <div className="mb-3 px-3 py-2 bg-red-50 text-red-700 text-sm rounded">
                {editFormError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">職種</label>
                <input
                  type="text"
                  value={editForm.occupation}
                  onChange={e => setEditForm(f => ({ ...f, occupation: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                  <input
                    type="text"
                    value={editForm.zip_code}
                    onChange={e => setEditForm(f => ({ ...f, zip_code: e.target.value }))}
                    placeholder="332-0017"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">都道府県</label>
                  <input
                    type="text"
                    value={editForm.prefecture}
                    onChange={e => setEditForm(f => ({ ...f, prefecture: e.target.value }))}
                    placeholder="埼玉県"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                <input
                  type="text"
                  value={editForm.tel}
                  onChange={e => setEditForm(f => ({ ...f, tel: e.target.value }))}
                  placeholder="048-253-3922"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  有効（一斉配信に含める）
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingAddrId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                disabled={editFormSaving || !editForm.email}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
              >
                {editFormSaving ? '保存中...' : '保存'}
              </button>
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

function formatDateTime(raw: string): string {
  try {
    if (!raw) return '—'
    const hasTimezone = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw)
    const s = hasTimezone ? raw : raw.includes('T') ? raw + 'Z' : raw.replace(' ', 'T') + 'Z'
    const d = new Date(s)
    if (isNaN(d.getTime())) return '—'
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '—' }
}
