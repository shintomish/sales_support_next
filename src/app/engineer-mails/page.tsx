'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import axios from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import { useStaleResponseGuard } from '@/hooks/useStaleResponseGuard'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import EmailHtmlFrame from '@/components/EmailHtmlFrame'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useResizableSplit } from '@/hooks/useResizableSplit'

// ── 型定義 ─────────────────────────────────────────────────

type EmailAttachment = {
  id: number
  filename: string
  mime_type: string | null
  size: number | null
  storage_path: string | null
}

type Email = {
  id: number
  subject: string
  from_name: string | null
  from_address: string
  body_text: string | null
  body_html: string | null
  received_at: string
  attachments: EmailAttachment[]
}

type EngineerMail = {
  id: number
  email_id: number
  score: number
  score_reasons: string[]
  engine: string
  name: string | null
  age: number | null
  unit_price_min: number | null
  unit_price_max: number | null
  affiliation_type: string | null
  available_from: string | null
  nearest_station: string | null
  skills: string[] | null
  has_attachment: boolean
  status: string
  received_at: string
  email?: Email
}

type Paginated = {
  data: EngineerMail[]
  current_page: number
  last_page: number
  total: number
}

type ThreadItem = {
  type: 'sent' | 'received'
  campaign_id?: number
  history_id?: number
  email_id?: number
  to?: string
  to_name?: string
  from?: string
  from_name?: string
  subject: string
  body?: string
  body_text?: string
  sent_at?: string
  received_at?: string
  status?: string
}

type MatchedProject = {
  project_id: number
  project_title: string
  match_score: number
  matched_count: number
  total_skills: number
  required_skills: { name: string; is_required: boolean; matched: boolean }[]
  unit_price_min: number | null
  unit_price_max: number | null
  work_style: string | null
  to_email: string
  sales_contact: string
}

// 鮮度マッチング（過去N日の案件メールから候補抽出）
type FreshPms = {
  project_mail_id: number
  title: string | null
  customer_name: string | null
  required_skills: string[] | null
  unit_price_min: number | null
  unit_price_max: number | null
  work_location: string | null
  remote_ok: boolean | null
  start_date: string | null
  received_at: string | null
  email_from_address: string | null
  email_from_name: string | null
  email_subject: string | null
  email_body: string | null
  sales_contact: string | null
  score: number
  breakdown: {
    requirements: number
    skills: number
    conditions: number
    availability: number
    track_record: number
  }
  reasons: string[]
  badge: 'new' | 'registered' | 'proposed'
}

type ProposalModal = {
  project: MatchedProject
  to: string
  toName: string
  subject: string
  body: string
  attachments: File[]
  generating: boolean
  sending: boolean
  sent: boolean
  error: string
  // 鮮度マッチング: PMS 起点の場合のみ project_mail_id を保持
  // → 送信時に send-proposal-from-pms エンドポイントへルーティング
  projectMailId?: number
  // ▼アコーディオン用 (鮮度モード=PMS本文をセット)
  originalMailBody?: string | null
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

function buildEmailBody(
  greeting: string,
  mainContent: string,
  tpl: EmailBodyTemplate | null,
): string {
  if (tpl?.body_text) {
    return tpl.body_text
      .replace(/^.*?様\s*/u, `${greeting}\n\n`)
      .replace('（本文）', mainContent)
  }
  const intro = tpl
    ? `いつも大変お世話になっております。\n株式会社アイゼン・ソリューションの${tpl.name}です。`
    : `いつも大変お世話になっております。`
  const sig = tpl
    ? `_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/
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
_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/`
    : ''
  return `${greeting}\n\n${intro}\n\n${mainContent}\n\nお忙しいところ大変恐れ入りますが、ご検討いただけますと幸いでございます。\n何卒よろしくお願いいたします。\n${sig}`
}

function buildSignature(tpl: EmailBodyTemplate | null): string {
  if (!tpl) return ''
  if (tpl.body_text) {
    const idx = tpl.body_text.indexOf('（本文）')
    if (idx >= 0) return tpl.body_text.slice(idx + '（本文）'.length).replace(/^\s*\n/, '')
  }
  return `_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/
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
_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/`
}

function buildReplyBody(recipientName: string, originalBody: string, tpl: EmailBodyTemplate | null): string {
  const greeting = recipientName ? `${recipientName}様\n\n\n` : ''
  const quoted = originalBody
    ? originalBody.replace(/\r\n/g, '\n').split('\n').map(l => `> ${l}`).join('\n')
    : ''
  const sig = buildSignature(tpl)
  return `${greeting}${quoted}${sig ? `\n\n${sig}` : ''}`
}

// ── 定数 ─────────────────────────────────────────────────

const STATUS_TABS = [
  { value: '',           label: '全て',    color: 'text-white bg-gray-700 border-gray-700' },
  { value: 'review',     label: '要確認',  color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  { value: 'new',        label: '新着',    color: 'text-teal-700 bg-teal-50 border-teal-300' },
  { value: 'registered', label: '登録済',  color: 'text-blue-700 bg-blue-50 border-blue-300' },
  { value: 'proposing',  label: '提案中',  color: 'text-purple-700 bg-purple-50 border-purple-300' },
  { value: 'working',    label: '稼働中',  color: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'excluded',   label: '除外',    color: 'text-gray-500 bg-gray-50 border-gray-300' },
]

const STATUS_NEXT: Record<string, { label: string; value: string; cls: string }[]> = {
  review:     [
    { label: '新着にする', value: 'new',      cls: 'bg-teal-600 text-white hover:bg-teal-700' },
    { label: '除外',       value: 'excluded', cls: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
  ],
  new:        [
    { label: '登録済にする', value: 'registered', cls: 'bg-blue-600 text-white hover:bg-blue-700' },
    { label: '除外',         value: 'excluded',   cls: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
  ],
  registered: [
    { label: '提案中にする', value: 'proposing', cls: 'bg-purple-600 text-white hover:bg-purple-700' },
  ],
  proposing:  [
    { label: '稼働中にする', value: 'working', cls: 'bg-green-600 text-white hover:bg-green-700' },
  ],
  working:    [],
  excluded:   [
    { label: '技術者に戻す', value: 'new', cls: 'bg-teal-600 text-white hover:bg-teal-700' },
  ],
}

const AFFILIATION_OPTIONS = [
  '自社正社員', '一社先正社員', 'BP', 'BP要員', '契約社員', '個人事業主', '入社予定', '採用予定',
]

const SCORE_FILTERS = [
  { value: 'all',  label: 'ScoreALL', scoreMin: 0,  scoreMax: 100 },
  { value: 'high', label: '高 80+',   scoreMin: 80, scoreMax: 100 },
  { value: 'mid',  label: '中 60-',   scoreMin: 60, scoreMax: 79  },
  { value: 'low',  label: '低 ～39',  scoreMin: 0,  scoreMax: 39  },
]

// 元メール本文 ▼アコーディオン
function OriginalMailAccordion({ body, label = '元メール本文' }: { body: string | null | undefined; label?: string }) {
  const [open, setOpen] = useState(false)
  if (!body || !body.trim()) return null
  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 flex items-center justify-between hover:bg-gray-100 rounded-lg"
      >
        <span>📧 {label}</span>
        <span className="text-gray-400 text-[11px]">{open ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>
      {open && (
        <pre className="m-0 px-3 pb-3 pt-1 text-[11px] leading-relaxed text-gray-600 whitespace-pre-wrap break-words border-t border-gray-200 max-h-60 overflow-y-auto font-sans">
          {body}
        </pre>
      )}
    </div>
  )
}

function scoreRank(score: number) {
  if (score >= 85) return { label: '◎', cls: 'bg-emerald-500 text-white' }
  if (score >= 70) return { label: '○', cls: 'bg-teal-500 text-white' }
  if (score >= 55) return { label: '△', cls: 'bg-yellow-400 text-gray-800' }
  return { label: '×', cls: 'bg-gray-400 text-white' }
}

// ── メインコンポーネント ──────────────────────────────────

export default function EngineerMailsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // 左右ペイン幅（md+ のみ可変。モバイルは一画面切替のため固定）
  const split = useResizableSplit('engineerMails:leftPct')
  // /engineer-mails/manual で手動登録モード (E-3 別枠化 2026-05-29)。
  const sourceMode: 'imap' | 'manual' = pathname?.endsWith('/manual') ? 'manual' : 'imap'
  const [items, setItems] = useState<Paginated | null>(null)
  const [selected, setSelected] = useState<EngineerMail | null>(null)
  // デフォルトは「全て」(ステータス指定なし) で受信日順表示
  const [statusFilter, setStatusFilter] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [search, setSearch] = useState('')               // 入力欄の値 (未確定)
  const [appliedSearch, setAppliedSearch] = useState('') // Enter/🔍 で確定された値
  const [searchBody, setSearchBody] = useState(false)    // 本文も検索
  const [listLoading, setListLoading] = useState(false)  // 一覧取得中
  const [page, setPage] = useState(1)
  const [rescoring, setRescoring] = useState(false)
  const [scoreMsg, setScoreMsg] = useState('')

  // 編集フォーム state
  const [form, setForm] = useState<Partial<EngineerMail>>({})
  const [skillInput, setSkillInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 手動登録モーダル (E-3 営業打ち合わせ 2026-05-25)
  const [showCreate, setShowCreate] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedItem, setExpandedItem] = useState<EngineerMail | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)

  // マッチ案件・提案送信
  const [matchedProjects, setMatchedProjects] = useState<MatchedProject[]>([])
  const [matchLoading, setMatchLoading] = useState(false)
  // 鮮度マッチング: 過去N日の案件メールから候補抽出
  const [freshMode, setFreshMode] = useState(false)
  const [freshDays, setFreshDays] = useState<number>(3)
  const [freshMinScore, setFreshMinScore] = useState<number>(60) // 既定=中(60)。営業打ち合わせ §4.4+§2.2: 情報不足の1点化でスコアが下がるため既定を高(70)→中(60)
  const [freshPms, setFreshPms] = useState<FreshPms[]>([])
  const [freshLoading, setFreshLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [proposalModal, setProposalModal] = useState<ProposalModal | null>(null)
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // スレッド
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadExpanded, setThreadExpanded] = useState<number | null>(null)
  const [replyForm, setReplyForm] = useState<{ name: string; to: string; subject: string; body: string; files: File[] } | null>(null)
  const [replyDropOver, setReplyDropOver] = useState(false)
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  // 返信添付ヘルパー（E-2 2026-05-27 追加）
  const addReplyFiles = (filesList: FileList | File[] | null) => {
    if (!filesList) return
    const arr = Array.from(filesList)
    setReplyForm(f => f ? { ...f, files: [...f.files, ...arr] } : f)
  }
  const removeReplyFile = (index: number) => {
    setReplyForm(f => f ? { ...f, files: f.files.filter((_, i) => i !== index) } : f)
  }
  const formatFileSize = (n: number): string => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
    return `${(n / 1024 / 1024).toFixed(1)} MB`
  }
  const [replySending, setReplySending] = useState(false)

  useEffect(() => {
    axios.get('/api/v1/email-body-templates/me').then(res => {
      if (res.data) setEmailTemplate(res.data)
    }).catch(() => {})
  }, [])

  const fetchList = useCallback(async () => {
    const sf = SCORE_FILTERS.find(f => f.value === scoreFilter) ?? SCORE_FILTERS[0]
    setListLoading(true)
    try {
      const res = await axios.get('/api/v1/engineer-mails', {
        params: {
          status:      statusFilter,
          search:      appliedSearch || undefined,
          search_body: appliedSearch && searchBody ? 1 : undefined,
          page,
          per_page:    30,
          score_min:   sf.scoreMin,
          score_max:   sf.scoreMax,
          source:      sourceMode,
        }
      })
      setItems(res.data)
    } finally {
      setListLoading(false)
    }
  }, [statusFilter, scoreFilter, appliedSearch, searchBody, page, sourceMode])

  useEffect(() => { fetchList() }, [fetchList])

  // URLパラメータ select={id} でメール自動選択
  useEffect(() => {
    const selectId = searchParams.get('select')
    if (!selectId) return
    const id = parseInt(selectId)
    if (isNaN(id)) return
    setStatusFilter('')
    axios.get(`/api/v1/engineer-mails/${id}`).then(res => {
      setSelected(res.data)
      setForm(res.data)
      setSkillInput('')
      setSaveMsg(null)
      setShowBody(false)
      // マッチ案件��得
      setMatchLoading(true)
      axios.get(`/api/v1/engineer-mails/${id}/matched-projects`).then(mres => {
        setMatchedProjects(mres.data.data ?? [])
      }).catch(() => {}).finally(() => setMatchLoading(false))
      // スレッド取得
      setThreadLoading(true)
      axios.get(`/api/v1/engineer-mails/${id}/thread`).then(tres => {
        setThreadItems(tres.data.thread ?? [])
      }).catch(() => setThreadItems([])).finally(() => setThreadLoading(false))
    }).catch(() => {})
    router.replace('/engineer-mails')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 連続クリック時の async race 対策 (docs/730 §High #5):
  // 古いレスポンスが新しい選択を上書きしないよう、選択 id を hook で保持し
  // 各 await 後に isStale チェックで古いレスポンスを破棄する。
  const selectGuard = useStaleResponseGuard<number>()

  // 選択時に詳細取得
  const handleSelect = async (item: EngineerMail) => {
    selectGuard.mark(item.id)
    setDetailLoading(true)
    setSelected(null)
    setMatchedProjects([])
    setProposalModal(null)
    setThreadItems([])
    setReplyForm(null)
    try {
      const res = await axios.get(`/api/v1/engineer-mails/${item.id}`)
      if (selectGuard.isStale(item.id)) return
      setSelected(res.data)
      setForm(res.data)
      setSkillInput('')
      setSaveMsg(null)
      setShowBody(false)
    } finally {
      if (selectGuard.isCurrent(item.id)) setDetailLoading(false)
    }
    // マッチ案件とスレッドは互いに独立なので Promise.all で並列化 (docs/730 §Low #36)
    setMatchLoading(true)
    setThreadLoading(true)
    const [mres, tres] = await Promise.all([
      axios.get(`/api/v1/engineer-mails/${item.id}/matched-projects`).catch(() => null),
      axios.get(`/api/v1/engineer-mails/${item.id}/thread`).catch(() => null),
    ])
    if (selectGuard.isStale(item.id)) return
    setMatchedProjects(mres?.data?.data ?? [])
    setThreadItems(tres?.data?.thread ?? [])
    setMatchLoading(false)
    setThreadLoading(false)
  }

  // スレッド再取得
  const fetchThread = async (id: number) => {
    setThreadLoading(true)
    try {
      const tres = await axios.get(`/api/v1/engineer-mails/${id}/thread`)
      setThreadItems(tres.data.thread ?? [])
    } catch { /* silent */ }
    finally { setThreadLoading(false) }
  }

  // 返信送信（添付ありの場合 multipart/form-data, なければ JSON）
  const handleReply = async () => {
    if (!selected || !replyForm) return
    setReplySending(true)
    try {
      if (replyForm.files.length > 0) {
        const fd = new FormData()
        fd.append('to', replyForm.to)
        if (replyForm.name) fd.append('to_name', replyForm.name)
        fd.append('subject', replyForm.subject)
        fd.append('body', replyForm.body)
        for (const file of replyForm.files) fd.append('attachments[]', file)
        await axios.post(`/api/v1/engineer-mails/${selected.id}/send-proposal`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await axios.post(`/api/v1/engineer-mails/${selected.id}/send-proposal`, {
          to: replyForm.to,
          to_name: replyForm.name || undefined,
          subject: replyForm.subject,
          body: replyForm.body,
        })
      }
      setReplyForm(null)
      fetchThread(selected.id)
    } catch { /* silent */ }
    finally { setReplySending(false) }
  }

  // 鮮度マッチング: モード切替/日数変更/選択EMS変更時に過去N日のPMSを取得
  useEffect(() => {
    if (!selected || !freshMode) return
    setFreshLoading(true)
    axios.get(`/api/v1/engineer-mails/${selected.id}/fresh-project-mails`, { params: { days: freshDays, min_score: freshMinScore } })
      .then(res => setFreshPms(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setFreshPms([]))
      .finally(() => setFreshLoading(false))
  }, [selected, freshMode, freshDays, freshMinScore])

  // 鮮度マッチング: PMS から提案メール草稿を生成
  const handleGenerateFromPms = (item: FreshPms) => {
    if (!selected) return
    const toName = item.sales_contact ?? item.email_from_name ?? ''
    const greeting = toName ? `${toName} 様` : '●● 様'
    const skillLine = (item.required_skills || []).slice(0, 5).join('／') || '—'
    const priceLine = item.unit_price_min || item.unit_price_max
      ? `${item.unit_price_min ?? ''}〜${item.unit_price_max ?? ''}万円`
      : '—'
    const mainContent = `先日いただいた案件メール（件名: ${item.email_subject ?? '—'}）について、弊社にて対応可能な技術者がおりますのでご紹介させていただきます。\n\n【貴社案件】\n${item.title ?? ''}\n必須スキル：${skillLine}\n単価レンジ：${priceLine}\n\n【ご紹介エンジニア】\n・${selected.name ?? '（氏名未取得）'}（${selected.age ? `${selected.age}歳` : ''}${selected.affiliation_type ? `／${selected.affiliation_type}` : ''}）\n　スキル：${(selected.skills || []).slice(0, 5).join('／') || '—'}\n\nスキルシート送付・面談調整可能でございます。お気軽にご返信ください。`
    const wrappedBody = buildEmailBody(greeting, mainContent, emailTemplate)
    // ProposalModal を PMS 起点モードで開く（projectMailId 保持）
    // project フィールドは表示互換のためダミーで埋める
    setProposalModal({
      project: {
        project_id: 0,
        project_title: item.title ?? '',
        match_score: item.score,
        matched_count: 0,
        total_skills: 0,
        required_skills: (item.required_skills || []).map(n => ({ name: n, is_required: true, matched: false })),
        unit_price_min: item.unit_price_min,
        unit_price_max: item.unit_price_max,
        work_style: item.work_location,
        to_email: item.email_from_address ?? '',
        sales_contact: toName,
      },
      to: item.email_from_address ?? '',
      toName,
      subject: `【技術者ご紹介】${item.title ?? ''}`,
      body: wrappedBody,
      attachments: [],
      generating: false,
      sending: false,
      sent: false,
      error: '',
      projectMailId: item.project_mail_id,
      originalMailBody: item.email_body,
    })
  }

  // 提案文生成
  const handleGenerate = async (project: MatchedProject) => {
    const toName = project.sales_contact ?? ''
    setProposalModal({ project, to: project.to_email, toName, subject: '', body: '', attachments: [], generating: true, sending: false, sent: false, error: '' })
    try {
      const res = await axios.post(`/api/v1/engineer-mails/${selected!.id}/generate-proposal`, { project_id: project.project_id })
      const greeting = toName ? `${toName} 様` : '●● 様'
      const wrappedBody = buildEmailBody(greeting, res.data.body, emailTemplate)
      setProposalModal(m => m ? { ...m, subject: res.data.subject, body: wrappedBody, generating: false } : m)
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      const msg = status === 503
        ? 'Claude API が混雑中です。少し待ってから再試行してください。'
        : '文章生成に失敗しました'
      setProposalModal(m => m ? { ...m, generating: false, error: msg } : m)
    }
  }

  // 担当者名変更 → 本文冒頭の宛名を書き換え
  const handleToNameChange = (newName: string) => {
    setProposalModal(m => {
      if (!m) return m
      const newGreeting = newName ? `${newName} 様` : '●● 様'
      const newBody = newGreeting + m.body.substring(m.body.indexOf('\n'))
      return { ...m, toName: newName, body: newBody }
    })
  }

  // 提案メール送信
  const handleSendProposal = async () => {
    if (!proposalModal || !selected) return
    setProposalModal(m => m ? { ...m, sending: true, error: '' } : m)
    try {
      const formData = new FormData()
      formData.append('to',         proposalModal.to)
      formData.append('to_name',    proposalModal.toName ?? '')
      formData.append('subject',    proposalModal.subject)
      formData.append('body',       proposalModal.body)
      proposalModal.attachments.forEach(f => formData.append('attachments[]', f))
      // 鮮度マッチング(PMS起点) の場合は project_mail_id を送って別エンドポイントへ
      const endpoint = proposalModal.projectMailId
        ? `/api/v1/engineer-mails/${selected.id}/send-proposal-from-pms`
        : `/api/v1/engineer-mails/${selected.id}/send-proposal`
      if (proposalModal.projectMailId) {
        formData.append('project_mail_id', String(proposalModal.projectMailId))
      } else {
        formData.append('project_id', String(proposalModal.project.project_id))
      }
      await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProposalModal(m => m ? { ...m, sending: false, sent: true } : m)
      // 鮮度モード表示中なら一覧をリフレッシュして badge を更新
      if (proposalModal.projectMailId && freshMode) {
        axios.get(`/api/v1/engineer-mails/${selected.id}/fresh-project-mails`, { params: { days: freshDays, min_score: freshMinScore } })
          .then(res => setFreshPms(Array.isArray(res.data?.data) ? res.data.data : []))
          .catch(() => {})
      }
      setTimeout(() => setProposalModal(null), 1500)
    } catch {
      setProposalModal(m => m ? { ...m, sending: false, error: '送信に失敗しました' } : m)
    }
  }

  // 要確認モード: アコーディオン展開
  const handleExpand = async (item: EngineerMail) => {
    if (expandedId === item.id) { setExpandedId(null); setExpandedItem(null); return }
    setExpandedId(item.id)
    setExpandLoading(true)
    try {
      const res = await axios.get(`/api/v1/engineer-mails/${item.id}`)
      setExpandedItem(res.data)
    } finally { setExpandLoading(false) }
  }

  // 要確認モード: インラインステータス変更
  const handleQuickStatus = async (id: number, status: string) => {
    try {
      await axios.put(`/api/v1/engineer-mails/${id}/status`, { status })
      fetchList()
      if (expandedId === id) { setExpandedId(null); setExpandedItem(null) }
    } catch { /* ignore */ }
  }

  // 全件再スコアは誤操作で数千件処理が走る/本番DB一斉更新のリスクがあるため、
  // 管理者(tenant_admin/super_admin)のみに表示する（営業=tenant_user には非表示）。
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'tenant_admin' || currentUser?.role === 'super_admin'

  // 全件再スコアリング（非同期ジョブ。バックエンドの Schedule tick が処理し進捗をポーリング）。
  // mountedRef で unmount 後の setTimeout 再発を防ぐ (docs/730 §Medium #16)。
  const pollRescoreMountedRef = useRef(true)
  useEffect(() => () => { pollRescoreMountedRef.current = false }, [])
  const pollRescoreStatus = () => {
    axios.get('/api/v1/engineer-mails/rescore-status').then(res => {
      if (!pollRescoreMountedRef.current) return
      const job = res.data.job
      if (job && (job.status === 'pending' || job.status === 'processing')) {
        setRescoring(true)
        setScoreMsg(`再スコア中: ${job.processed_count ?? 0} / ${job.total_count ?? 0}件`)
        setTimeout(() => { if (pollRescoreMountedRef.current) pollRescoreStatus() }, 3000)
      } else if (job && job.status === 'completed') {
        setRescoring(false)
        setScoreMsg(`完了: ${job.total_count}件を再スコアリングしました`)
        fetchList()
      } else if (job && job.status === 'failed') {
        setRescoring(false)
        setScoreMsg(`再スコアリングに失敗しました${job.error_message ? ': ' + job.error_message : ''}`)
      } else {
        setRescoring(false)
      }
    }).catch(() => { if (pollRescoreMountedRef.current) setRescoring(false) })
  }

  const handleRescoreAll = async () => {
    if (!confirm('全件を再スコアリングします。よろしいですか？')) return
    setRescoring(true); setScoreMsg('再スコアリングを開始しています...')
    try {
      await axios.post('/api/v1/engineer-mails/rescore-all', {})
      pollRescoreStatus()
    } catch {
      setScoreMsg('再スコアリングの開始に失敗しました')
      setRescoring(false)
    }
  }

  // ページ表示時、進行中の再スコアジョブがあれば進捗表示を復帰（ブラウザを閉じても継続するため）
  useEffect(() => {
    axios.get('/api/v1/engineer-mails/rescore-status').then(res => {
      if (!pollRescoreMountedRef.current) return
      const job = res.data.job
      if (job && (job.status === 'pending' || job.status === 'processing')) {
        setRescoring(true)
        setScoreMsg(`再スコア中: ${job.processed_count ?? 0} / ${job.total_count ?? 0}件`)
        setTimeout(() => { if (pollRescoreMountedRef.current) pollRescoreStatus() }, 3000)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 保存
  const handleSave = async () => {
    if (!selected) return
    setSaving(true); setSaveMsg(null)
    try {
      const res = await axios.put(`/api/v1/engineer-mails/${selected.id}`, {
        name:             form.name,
        affiliation_type: form.affiliation_type,
        available_from:   form.available_from,
        nearest_station:  form.nearest_station,
        skills:           form.skills ?? [],
        unit_price_min:   form.unit_price_min ?? null,
        unit_price_max:   form.unit_price_max ?? null,
      })
      setSelected(res.data)
      setForm(res.data)
      setSaveMsg({ type: 'ok', text: '保存しました' })
      fetchList()
    } catch { setSaveMsg({ type: 'err', text: '保存に失敗しました' }) }
    finally { setSaving(false) }
  }

  // ステータス変更
  const handleStatus = async (nextStatus: string) => {
    if (!selected) return
    try {
      const res = await axios.put(`/api/v1/engineer-mails/${selected.id}/status`, { status: nextStatus })
      setSelected(res.data)
      setForm(res.data)
      fetchList()
    } catch { setSaveMsg({ type: 'err', text: 'ステータス変更に失敗しました' }) }
  }

  // 削除（論理削除・一覧から除外）
  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`「${selected.name || `技術者メール #${selected.id}`}」を削除します。よろしいですか？`)) return
    try {
      await axios.delete(`/api/v1/engineer-mails/${selected.id}`)
      setSelected(null)
      setForm({})
      fetchList()
    } catch { setSaveMsg({ type: 'err', text: '削除に失敗しました' }) }
  }

  // スキルタグ追加
  const handleAddSkill = () => {
    const skill = skillInput.trim()
    if (!skill) return
    const current = form.skills ?? []
    if (!current.includes(skill)) {
      setForm(f => ({ ...f, skills: [...current, skill] }))
    }
    setSkillInput('')
  }

  const handleRemoveSkill = (skill: string) => {
    setForm(f => ({ ...f, skills: (f.skills ?? []).filter(s => s !== skill) }))
  }

  // 添付ファイルダウンロード
  const handleDownload = async (att: EmailAttachment) => {
    if (!selected) return
    try {
      const res = await axios.get(
        `/api/v1/engineer-mails/${selected.id}/attachment/${att.id}`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('ダウンロードに失敗しました')
    }
  }

  // 技術者として登録ボタン
  const handleRegister = () => {
    if (!selected) return
    const params = new URLSearchParams()
    // 基本情報
    if (selected.name)                params.set('name', selected.name)
    if (selected.nearest_station)     params.set('nearest_station', selected.nearest_station)
    if (selected.affiliation_type)    params.set('affiliation_type', selected.affiliation_type)
    if (selected.email?.from_name)    params.set('affiliation', selected.email.from_name)
    if (selected.email?.from_address) params.set('email_address', selected.email.from_address)
    // スキル
    if (selected.skills?.length)      params.set('skills', selected.skills.join(','))
    // 希望条件
    if (selected.available_from)      params.set('available_from', selected.available_from)
    params.set('from', '/engineer-mails')
    params.set('engineer_mail_id', String(selected.id))
    router.push(`/engineers/create?${params.toString()}`)
  }

  const set = (key: keyof EngineerMail, val: unknown) => setForm(f => ({ ...f, [key]: val }))

  // ── 要確認モード ──────────────────────────────────────────
  if (statusFilter === 'review') {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-semibold text-gray-900">
              {sourceMode === 'manual' ? '手動登録 技術者' : '要確認技術者メール'}
            </h1>
            {items && (
              <span className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-300 px-2.5 py-0.5 rounded-full font-medium">
                {items.total}件
              </span>
            )}
            {sourceMode === 'manual' ? (
              <>
                <Link href="/engineer-mails"
                  className="ml-auto text-xs bg-white text-gray-600 border border-gray-300 px-2.5 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                  title="通常の技術者メール一覧へ">
                  ← 通常メール
                </Link>
                <button onClick={() => setShowCreate(true)}
                  className="text-xs bg-green-600 text-white border border-green-600 px-2.5 py-1.5 rounded-md hover:bg-green-700 flex items-center gap-1.5">
                  <span className="text-sm leading-none">+</span> 新規登録
                </button>
              </>
            ) : (
              <Link href="/engineer-mails/manual"
                className="ml-auto text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-md hover:bg-green-100 flex items-center gap-1.5"
                title="手動登録した技術者の一覧 (LINE/個別メールから登録)">
                🗂 手動登録一覧
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map(tab => (
                <button key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setScoreFilter('all'); setPage(1); setExpandedId(null); setSelected(null) }}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    statusFilter === tab.value ? tab.color + ' font-semibold' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {SCORE_FILTERS.map(sf => (
                <button key={sf.value}
                  onClick={() => { setScoreFilter(sf.value); setPage(1); setExpandedId(null); setSelected(null) }}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    scoreFilter === sf.value
                      ? sf.value === 'all'
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {sf.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); setPage(1) }}
              className="flex gap-1.5 items-center"
            >
              <input type="text"
                placeholder={searchBody ? '検索 (本文含む)' : '検索'}
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  if (!e.target.value) { setAppliedSearch(''); setPage(1); setSelected(null); setForm({}); setMatchedProjects([]) }
                }}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48" />
              <button type="submit" disabled={listLoading} title="検索 (Enter)"
                className="px-2.5 py-1.5 bg-teal-600 text-white text-xs rounded-md hover:bg-teal-700 disabled:opacity-50 min-w-[36px] flex items-center justify-center">
                {listLoading
                  ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : '🔍'}
              </button>
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={searchBody}
                  onChange={e => { setSearchBody(e.target.checked); setPage(1) }} className="rounded" />
                本文も
              </label>
            </form>
            {isAdmin && (
            <button onClick={handleRescoreAll} disabled={rescoring}
              className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-md hover:bg-orange-100 disabled:opacity-50 flex items-center gap-1.5">
              {rescoring && <Spinner size={11} />}
              {rescoring ? '再スコア中...' : '全件再スコア'}
            </button>
            )}
          </div>
          <ProcessingBar
            active={rescoring}
            label={rescoring ? '全件再スコア中...' : undefined}
          />
          {scoreMsg && <p className="text-xs text-teal-700 mt-2 font-medium">{scoreMsg}</p>}
        </div>

        {/* リスト (flex-1 でスクロール) */}
        <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 md:px-6 py-3 md:py-4 space-y-2">
          {items?.data.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm">要確認の技術者メールはありません</p>
            </div>
          )}
          {items?.data.map(item => (
            <ReviewRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              expandedDetail={expandedId === item.id ? expandedItem : null}
              expandLoading={expandedId === item.id && expandLoading}
              appliedSearch={appliedSearch}
              onExpand={() => handleExpand(item)}
              onQuickStatus={handleQuickStatus}
            />
          ))}
          {items && items.last_page > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="text-sm text-teal-600 disabled:text-gray-300">← 前へ</button>
              <span className="text-sm text-gray-500">{page} / {items.last_page}</span>
              <button disabled={page === items.last_page} onClick={() => setPage(p => p + 1)}
                className="text-sm text-teal-600 disabled:text-gray-300">次へ →</button>
            </div>
          )}
        </div>
        {showCreate && (
          <ManualEngineerModal
            onClose={() => setShowCreate(false)}
            onCreated={(ems) => {
              setShowCreate(false)
              fetchList()
              handleSelect(ems)
            }}
          />
        )}
      </div>
    )
  }

  // ── 通常モード（左右2ペイン） ─────────────────────────────
  return (
    <div ref={split.containerRef} className="flex h-screen bg-gray-50">

      {/* 左ペイン (mobile では選択時に非表示) */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-[var(--split-left)] bg-white border-r border-gray-200 flex-col`}
           style={split.leftPaneStyle}>
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">
              {sourceMode === 'manual' ? '手動登録 技術者' : '技術者メール'}
            </h1>
            <div className="flex gap-1.5">
              {sourceMode === 'manual' ? (
                <>
                  <Link href="/engineer-mails"
                    className="text-xs bg-white text-gray-600 border border-gray-300 px-2.5 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                    title="通常の技術者メール一覧へ">
                    ← 通常メール
                  </Link>
                  <button onClick={() => setShowCreate(true)}
                    className="text-xs bg-green-600 text-white border border-green-600 px-2.5 py-1.5 rounded-md hover:bg-green-700 flex items-center gap-1.5">
                    <span className="text-sm leading-none">+</span> 新規登録
                  </button>
                </>
              ) : (
                <>
                  <Link href="/engineer-mails/manual"
                    className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-md hover:bg-green-100 flex items-center gap-1.5"
                    title="手動登録した技術者の一覧 (LINE/個別メールから登録)">
                    🗂 手動登録一覧
                  </Link>
                  {isAdmin && (
                  <button onClick={handleRescoreAll} disabled={rescoring}
                    className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-md hover:bg-orange-100 disabled:opacity-50 flex items-center gap-1.5">
                    {rescoring && <Spinner size={11} />}
                    {rescoring ? '再スコア中...' : '全件再スコア'}
                  </button>
                  )}
                </>
              )}
            </div>
          </div>
          {scoreMsg && <p className="text-xs text-teal-700 font-medium">{scoreMsg}</p>}

          <form
            onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); setPage(1) }}
            className="flex gap-1.5"
          >
            <input type="text"
              placeholder={searchBody ? '氏名・スキル・最寄り駅・本文で検索' : '氏名・スキル・最寄り駅で検索'}
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                if (!e.target.value) { setAppliedSearch(''); setPage(1); setSelected(null); setForm({}); setMatchedProjects([]) }
              }}
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <button type="submit" disabled={listLoading} title="検索 (Enter)"
              className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700 disabled:opacity-50 min-w-[44px] flex items-center justify-center">
              {listLoading
                ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : '🔍'}
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-gray-600 -mt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={searchBody}
                onChange={e => { setSearchBody(e.target.checked); setPage(1) }} className="rounded" />
              本文も検索
            </label>
            {search !== appliedSearch && search.trim() !== '' && (
              <span className="text-amber-600">⏎ Enter または 🔍 で実行</span>
            )}
            {appliedSearch && !listLoading && items && (
              <span className="text-gray-500">
                「<span className="font-semibold text-gray-700">{appliedSearch}</span>」
                <span className="font-semibold text-teal-700"> {items.total.toLocaleString()} 件</span> Hit
              </span>
            )}
          </div>

          <ProcessingBar
            active={rescoring}
            label={rescoring ? '全件再スコア中...' : undefined}
          />

          {/* ステータスタブ */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setScoreFilter('all'); setPage(1); setSelected(null) }}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  statusFilter === tab.value
                    ? tab.color + ' font-semibold'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* スコアフィルター */}
          <div className="flex gap-1">
            {SCORE_FILTERS.map(sf => (
              <button key={sf.value}
                onClick={() => { setScoreFilter(sf.value); setPage(1) }}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  scoreFilter === sf.value
                    ? sf.value === 'all'
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}>
                {sf.label}
              </button>
            ))}
          </div>
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto">
          {items?.data.length === 0 && (
            <p className="text-sm text-gray-400 text-center p-8">該当するメールがありません</p>
          )}
          {items?.data.map(item => {
            const rank = scoreRank(item.score)
            return (
              <div key={item.id} onClick={() => handleSelect(item)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selected?.id === item.id ? 'bg-teal-50 border-l-2 border-l-teal-500' : ''
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rank.cls}`}>
                    {rank.label} {item.score}
                  </span>
                  {item.has_attachment && (
                    <span className="text-xs bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5">📎 シート</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                    {formatDateFull(item.received_at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.name || item.email?.from_name || '(件名なし)'}
                </p>
                {item.email?.subject && (
                  <p className="text-xs text-gray-600 truncate mt-0.5">{item.email.subject}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 truncate flex-1">
                    {item.email?.from_name || item.email?.from_address || '—'}
                  </p>
                  {item.nearest_station && (
                    <span className="text-xs text-gray-400 flex-shrink-0">📍{item.nearest_station}</span>
                  )}
                </div>
                {item.skills && item.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.skills.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs bg-teal-50 text-teal-600 border border-teal-100 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                    {item.skills.length > 3 && (
                      <span className="text-xs text-gray-400">+{item.skills.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {items && items.last_page > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="text-xs text-teal-600 disabled:text-gray-300">前へ</button>
            <span className="text-xs text-gray-500">{page} / {items.last_page}</span>
            <button disabled={page === items.last_page} onClick={() => setPage(p => p + 1)}
              className="text-xs text-teal-600 disabled:text-gray-300">次へ</button>
          </div>
        )}
      </div>

      {/* リサイザー (md+ のみ。ドラッグで左右幅を変更) */}
      <ResizeHandle dragging={split.dragging} onStart={split.startDragging} onReset={split.reset} />

      {/* 右ペイン (mobile では選択時のみ表示) */}
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 overflow-y-auto min-w-0`}>
        {selected ? (
          <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 md:space-y-5 w-full">

            {/* mobile: 戻るボタン */}
            <button
              onClick={() => setSelected(null)}
              className="md:hidden text-sm text-blue-600 hover:underline">
              ← 一覧に戻る
            </button>

            {/* ── ヘッダー ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 技術者名 + スコア */}
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-800 leading-snug mb-1">
                      {selected.name || selected.email?.subject || `技術者メール #${selected.id}`}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>📧 {selected.email?.from_name || '—'}</span>
                      <span className="text-gray-300">|</span>
                      <span>{selected.email?.from_address}</span>
                      <span className="text-gray-300">|</span>
                      <span>{formatDateFull(selected.received_at)}</span>
                    </div>
                    {/* 基本情報 */}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                      {selected.affiliation_type && <span className="bg-gray-100 px-2 py-0.5 rounded">{selected.affiliation_type}</span>}
                      {selected.nearest_station && <span>📍 {selected.nearest_station}</span>}
                      {selected.available_from && <span>📅 {selected.available_from}〜</span>}
                      {(selected.unit_price_min || selected.unit_price_max) && (
                        <span>💰 {selected.unit_price_min ? Math.round(selected.unit_price_min) : '?'}〜{selected.unit_price_max ? Math.round(selected.unit_price_max) : '?'}万円</span>
                      )}
                    </div>
                  </div>
                  {(() => { const r = scoreRank(selected.score); return (
                    <div className={`text-center px-4 py-2 rounded-xl ${r.cls} flex-shrink-0`}>
                      <div className="text-xl font-bold leading-none">{r.label}</div>
                      <div className="text-sm font-semibold mt-0.5">{selected.score}点</div>
                    </div>
                  )})()}
                </div>
                {/* 判定理由 */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {(selected.score_reasons ?? []).map((r, i) => (
                    <ScoreReasonChip key={i} reason={r} />
                  ))}
                </div>
              </div>

              {/* ステータス + アクションボタン */}
              <div className="px-5 py-3 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                {/* ステータス */}
                <div className="flex items-center gap-2">
                  {STATUS_TABS.find(t => t.value === selected.status) && (
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_TABS.find(t => t.value === selected.status)!.color}`}>
                      {STATUS_TABS.find(t => t.value === selected.status)!.label}
                    </span>
                  )}
                  {(STATUS_NEXT[selected.status] ?? []).map(btn => (
                    <button key={btn.value} onClick={() => handleStatus(btn.value)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${btn.cls}`}>
                      {btn.label}
                    </button>
                  ))}
                </div>
                {/* アクション */}
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={handleRegister}
                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-medium">
                    技術者登録
                  </button>
                  <button
                    onClick={() => router.push(`/engineer-mails/${selected.id}`)}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
                    🎯 マッチング
                  </button>
                  <button
                    onClick={() => router.push(`/deliveries?tab=send&delivery_type=engineer&engineer_mail_id=${selected.id}`)}
                    className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 font-medium">
                    📤 一斉配信
                  </button>
                  <button
                    onClick={() => router.push(`/emails?email_id=${selected.email_id}`)}
                    className="text-xs border border-teal-300 text-teal-600 px-3 py-1.5 rounded-lg hover:bg-teal-50">
                    メール詳細
                  </button>
                  {sourceMode === 'manual' && (
                    <button
                      onClick={handleDelete}
                      className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
                      🗑 削除
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 編集フォーム */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-700">抽出情報（編集可）</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* メール件名（読み取り専用） */}
                {selected.email?.subject && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">メール件名</p>
                    <p className="text-sm text-gray-700 font-medium">{selected.email.subject}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="氏名">
                    <input value={form.name ?? ''} onChange={e => set('name', e.target.value || null)}
                      className="form-input" placeholder="田中 太郎" />
                  </FormRow>
                  <FormRow label="所属区分">
                    <select value={form.affiliation_type ?? ''}
                      onChange={e => set('affiliation_type', e.target.value || null)}
                      className="form-input">
                      <option value="">不明</option>
                      {AFFILIATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="稼働開始日">
                    <input value={form.available_from ?? ''} onChange={e => set('available_from', e.target.value || null)}
                      className="form-input" placeholder="即日 / 2026-06-01" />
                  </FormRow>
                  <FormRow label="最寄り駅">
                    <input value={form.nearest_station ?? ''} onChange={e => set('nearest_station', e.target.value || null)}
                      className="form-input" placeholder="渋谷駅" />
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="希望単価（下限）">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={form.unit_price_min ?? ''}
                        onChange={e => set('unit_price_min', e.target.value ? Number(e.target.value) : null)}
                        className="form-input"
                        placeholder="60"
                      />
                      <span className="text-xs text-gray-500 flex-shrink-0">万円</span>
                    </div>
                  </FormRow>
                  <FormRow label="希望単価（上限）">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={form.unit_price_max ?? ''}
                        onChange={e => set('unit_price_max', e.target.value ? Number(e.target.value) : null)}
                        className="form-input"
                        placeholder="80"
                      />
                      <span className="text-xs text-gray-500 flex-shrink-0">万円</span>
                    </div>
                  </FormRow>
                </div>

                <FormRow label="スキル">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1 min-h-[28px]">
                      {(form.skills ?? []).map(skill => (
                        <span key={skill} className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded px-2 py-0.5">
                          {skill}
                          <button onClick={() => handleRemoveSkill(skill)} className="text-teal-400 hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={skillInput}
                        onChange={e => setSkillInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill() } }}
                        className="form-input flex-1"
                        placeholder="スキルを入力してEnter"
                      />
                      <button onClick={handleAddSkill}
                        className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded hover:bg-teal-100">
                        追加
                      </button>
                    </div>
                  </div>
                </FormRow>

                {saveMsg && (
                  <p className={`text-sm ${saveMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMsg.text}
                  </p>
                )}

                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={saving}
                    className="text-sm bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>

            {/* 添付ファイル */}
            {selected?.email?.attachments && selected.email.attachments.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-700">添付ファイル</h2>
                </div>
                <div className="p-4 space-y-2">
                  {selected.email.attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-gray-50">
                      <span className="text-lg">📎</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{att.filename}</p>
                        {att.size && (
                          <p className="text-xs text-gray-400">{Math.round(att.size / 1024)} KB</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDownload(att)}
                        className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 flex-shrink-0"
                      >
                        ダウンロード
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* マッチ案件 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-sm font-semibold text-gray-700">{freshMode ? '受信案件メール候補' : 'マッチ案件'}</span>
                  {(selected.unit_price_min || selected.unit_price_max) && (
                    <span className="ml-2 text-xs text-blue-600 font-medium">
                      技術者希望: {selected.unit_price_min ? Math.round(selected.unit_price_min) : '?'}〜{selected.unit_price_max ? Math.round(selected.unit_price_max) : '?'}万円
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(matchLoading || freshLoading) && <span className="text-xs text-gray-400 animate-pulse">取得中...</span>}
                  {/* モード切替: 登録済案件 ↔ 過去N日メール */}
                  <div className="flex border border-gray-300 rounded-md overflow-hidden text-xs">
                    <button
                      onClick={() => setFreshMode(false)}
                      className={`px-2 py-1 ${!freshMode ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      登録済
                    </button>
                    <button
                      onClick={() => setFreshMode(true)}
                      className={`px-2 py-1 border-l border-gray-300 ${freshMode ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      📨 メール
                    </button>
                  </div>
                  {freshMode && (
                    <>
                      <select
                        value={freshDays}
                        onChange={e => setFreshDays(Number(e.target.value))}
                        className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
                      >
                        <option value={3}>過去3日</option>
                        <option value={7}>過去7日</option>
                        <option value={14}>過去14日</option>
                        <option value={30}>過去30日</option>
                      </select>
                      <select
                        value={freshMinScore}
                        onChange={e => setFreshMinScore(Number(e.target.value))}
                        title="マッチスコアの下限"
                        className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
                      >
                        <option value={70}>高 (70+)</option>
                        <option value={60}>中 (60+)</option>
                        <option value={50}>低 (50+)</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* 登録済案件モード */}
              {!freshMode && (
                <>
                  {!matchLoading && matchedProjects.length === 0 && (
                    <p className="text-sm text-gray-400 px-4 py-3">単価条件に合う案件はありません</p>
                  )}
                  {matchedProjects.map(proj => (
                    <div key={proj.project_id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{proj.project_title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${proj.match_score >= 70 ? 'bg-emerald-100 text-emerald-700' : proj.match_score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                              {proj.match_score}%
                            </span>
                            {proj.unit_price_max != null && (
                              <span className="text-xs text-emerald-600 font-medium">案件: 〜{Math.round(proj.unit_price_max)}万円</span>
                            )}
                            {proj.work_style && <span className="text-xs text-gray-400">{proj.work_style}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {proj.required_skills.slice(0, 5).map((s, i) => (
                              <span key={i} className={`text-xs px-1.5 py-0.5 rounded border ${s.matched ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{s.name}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleGenerate(proj)}
                          className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium flex-shrink-0 whitespace-nowrap">
                          提案送信
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* 鮮度マッチング: 過去N日の案件メール候補 */}
              {freshMode && (
                <>
                  {!freshLoading && freshPms.length === 0 && (
                    <p className="text-sm text-gray-400 px-4 py-3">過去{freshDays}日の受信案件メールに該当する候補はありません</p>
                  )}
                  {freshPms.map(item => {
                    const badgeLabel =
                      item.badge === 'proposed' ? '提案済' :
                      item.badge === 'registered' ? '登録済' : '新規'
                    const badgeCls =
                      item.badge === 'proposed' ? 'bg-red-100 text-red-700' :
                      item.badge === 'registered' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    return (
                      <div key={item.project_mail_id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.score >= 80 ? 'bg-emerald-100 text-emerald-700' : item.score >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {item.score}点
                              </span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeCls}`}>{badgeLabel}</span>
                              {item.received_at && (
                                <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(item.received_at), { addSuffix: true, locale: ja })}</span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-800 truncate mt-1">{item.title ?? '（件名未取得）'}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.customer_name && <span className="text-xs text-gray-500">🏢 {item.customer_name}</span>}
                              {item.unit_price_max != null && (
                                <span className="text-xs text-emerald-600 font-medium">〜{Math.round(item.unit_price_max)}万円</span>
                              )}
                              {item.work_location && <span className="text-xs text-gray-400">📍 {item.work_location}{item.remote_ok ? '(リモート可)' : ''}</span>}
                            </div>
                            {item.required_skills && item.required_skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.required_skills.slice(0, 6).map((s, i) => (
                                  <span key={i} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">{s}</span>
                                ))}
                              </div>
                            )}
                            {item.reasons.length > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1 truncate" title={item.reasons.join(' / ')}>
                                {item.reasons.slice(0, 2).join(' / ')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerateFromPms(item)}
                            disabled={item.badge === 'proposed'}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 whitespace-nowrap ${
                              item.badge === 'proposed'
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                          >
                            {item.badge === 'proposed' ? '提案済' : '提案送信'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* スレッド会話履歴 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">提案・やり取り履歴</h2>
                {threadLoading && <span className="text-xs text-gray-400 animate-pulse">取得中...</span>}
              </div>
              <div className="p-4 space-y-3">
                {!threadLoading && threadItems.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">提案履歴はありません</p>
                )}
                {threadItems.map((ti, idx) => {
                  const isSent = ti.type === 'sent'
                  const datetime = isSent ? ti.sent_at : ti.received_at
                  const isExpanded = threadExpanded === idx
                  return (
                    <div key={idx} className={`rounded-lg border p-3 ${isSent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setThreadExpanded(isExpanded ? null : idx)}>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isSent ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                          {isSent ? '→ 送信' : '← 受信'}
                        </span>
                        {isSent && ti.status === 'replied' && (
                          <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5">返信あり</span>
                        )}
                        <span className="text-xs text-gray-600 truncate flex-1">{ti.subject}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {datetime ? formatDateTime(datetime) : '—'}
                        </span>
                        <span className="text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-500 mb-1">
                            {isSent ? `宛先: ${ti.to_name ?? ''} <${ti.to ?? ''}>` : `差出人: ${ti.from_name ?? ''} <${ti.from ?? ''}>`}
                          </div>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
                            {isSent ? ti.body : ti.body_text}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 返信フォーム */}
                {replyForm ? (
                  <div className="border border-teal-300 rounded-lg p-4 bg-teal-50/50 space-y-3">
                    <p className="text-sm font-semibold text-teal-700">返信を作成</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">宛名</label>
                      <input type="text" value={replyForm.name} onChange={e => setReplyForm(f => f ? { ...f, name: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">宛先</label>
                      <input type="email" value={replyForm.to} onChange={e => setReplyForm(f => f ? { ...f, to: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">件名</label>
                      <input type="text" value={replyForm.subject} onChange={e => setReplyForm(f => f ? { ...f, subject: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">本文</label>
                      <textarea value={replyForm.body} onChange={e => setReplyForm(f => f ? { ...f, body: e.target.value } : f)}
                        rows={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono" />
                    </div>
                    {/* 添付ファイル (E-2 2026-05-27 D&D + 選択) */}
                    <div
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (!replyDropOver) setReplyDropOver(true) }}
                      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setReplyDropOver(true) }}
                      onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setReplyDropOver(false) }}
                      onDrop={e => {
                        e.preventDefault(); e.stopPropagation(); setReplyDropOver(false)
                        if (e.dataTransfer?.files?.length) addReplyFiles(e.dataTransfer.files)
                      }}
                      className={`rounded-lg border-2 border-dashed p-2 transition-colors ${
                        replyDropOver ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          添付ファイル ({replyForm.files.length})
                          <span className="ml-2 text-gray-400">— ここにファイルをドロップ</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          className="text-xs text-teal-600 hover:underline"
                        >
                          + ファイル追加
                        </button>
                        <input
                          ref={replyFileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={e => { addReplyFiles(e.target.files); if (e.target) e.target.value = '' }}
                        />
                      </div>
                      {replyForm.files.length > 0 && (
                        <ul className="space-y-1 mt-1.5">
                          {replyForm.files.map((file, i) => (
                            <li key={i} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1">
                              <span className="truncate">{file.name}（{formatFileSize(file.size)}）</span>
                              <button
                                type="button"
                                onClick={() => removeReplyFile(i)}
                                className="flex-shrink-0 text-red-500 hover:text-red-700 ml-2"
                              >×</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleReply} disabled={replySending || !replyForm.to || !replyForm.subject || !replyForm.body}
                        className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
                        {replySending ? '送信中...' : '送信'}
                      </button>
                      <button onClick={() => setReplyForm(null)}
                        className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50">
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button onClick={() => {
                      const lastReceived = [...threadItems].reverse().find(t => t.type === 'received')
                      const latest = threadItems.length > 0 ? threadItems[threadItems.length - 1] : null
                      const recipientName = lastReceived?.from_name ?? selected.email?.from_name ?? ''
                      const quotedSource = lastReceived?.body_text ?? selected.email?.body_text ?? ''
                      setReplyForm({
                        name: recipientName,
                        to: lastReceived?.from ?? selected.email?.from_address ?? '',
                        subject: `Re: ${latest?.subject ?? selected.email?.subject ?? ''}`,
                        body: buildReplyBody(recipientName, quotedSource, emailTemplate),
                        files: [],
                      })
                    }}
                      className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 font-medium">
                      返信を作成
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 元メール */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setShowBody(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                <span>元メール本文</span>
                <span className="text-gray-400">{showBody ? '▲ 閉じる' : '▼ 開く'}</span>
              </button>
              {showBody && (
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-2">件名: {selected.email?.subject}</p>
                  {selected.email?.body_text ? (
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                      {highlightBody(
                        selected.email.body_text,
                        [
                          ...(appliedSearch ? [appliedSearch] : []),
                          ...(selected.skills ?? []),
                        ].filter(Boolean)
                      )}
                    </pre>
                  ) : selected.email?.body_html ? (
                    <EmailHtmlFrame html={selected.email.body_html} highlight={appliedSearch} />
                  ) : (
                    <p className="text-sm text-gray-400">(本文なし)</p>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">{detailLoading ? '読み込み中...' : '技術者メールを選択してください'}</p>
          </div>
        )}
      </div>

      {/* 提案送信モーダル */}
      {proposalModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">提案メール送信</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{proposalModal.project.project_title}</p>
              </div>
              <button onClick={() => setProposalModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {proposalModal.generating ? (
                <p className="text-sm text-gray-500 text-center py-8 animate-pulse">AIが提案文を生成中...</p>
              ) : proposalModal.sent ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-sm font-medium text-gray-700">送信しました</p>
                </div>
              ) : (
                <>
                  {proposalModal.error && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{proposalModal.error}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">担当者名（宛名）</label>
                      <input
                        type="text"
                        value={proposalModal.toName}
                        onChange={e => handleToNameChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="山田 太郎"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">宛先メール</label>
                      <input
                        type="email"
                        value={proposalModal.to}
                        onChange={e => setProposalModal(m => m ? { ...m, to: e.target.value } : m)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="送信先メールアドレス"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">件名</label>
                    <input
                      type="text"
                      value={proposalModal.subject}
                      onChange={e => setProposalModal(m => m ? { ...m, subject: e.target.value } : m)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <OriginalMailAccordion body={proposalModal.originalMailBody} label="紹介元案件メール 本文" />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">本文</label>
                    <textarea
                      value={proposalModal.body}
                      onChange={e => setProposalModal(m => m ? { ...m, body: e.target.value } : m)}
                      rows={10}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      添付ファイル
                      {proposalModal.attachments.length > 0 && (
                        <span className="ml-1.5 text-purple-600">{proposalModal.attachments.length}件</span>
                      )}
                    </label>
                    <div
                      onDragOver={e => { e.preventDefault(); setDropOver(true) }}
                      onDragLeave={() => setDropOver(false)}
                      onDrop={e => {
                        e.preventDefault()
                        setDropOver(false)
                        const dropped = Array.from(e.dataTransfer.files)
                        if (dropped.length > 0) setProposalModal(m => m ? { ...m, attachments: [...m.attachments, ...dropped] } : m)
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl px-4 py-4 text-center cursor-pointer transition-colors ${dropOver ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'}`}
                    >
                      <p className="text-lg mb-1">📎</p>
                      <p className="text-xs text-gray-400">ドロップ、またはクリックして選択</p>
                      <input ref={fileInputRef} type="file" multiple className="hidden"
                        onChange={e => setProposalModal(m => m ? { ...m, attachments: [...m.attachments, ...Array.from(e.target.files ?? [])] } : m)}
                      />
                    </div>
                    {proposalModal.attachments.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {proposalModal.attachments.map((f, i) => {
                          const ext = f.name.split('.').pop()?.toUpperCase() ?? 'FILE'
                          const kb = f.size ? (f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`) : ''
                          return (
                            <li key={i} className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2">
                              <span className="text-xs font-bold text-white bg-purple-400 rounded px-1.5 py-0.5 flex-shrink-0">{ext}</span>
                              <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
                              {kb && <span className="text-xs text-gray-400 flex-shrink-0">{kb}</span>}
                              <button
                                onClick={e => { e.stopPropagation(); setProposalModal(m => m ? { ...m, attachments: m.attachments.filter((_, j) => j !== i) } : m) }}
                                className="text-gray-300 hover:text-red-400 flex-shrink-0 text-base leading-none">×</button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleSendProposal}
                      disabled={proposalModal.sending || !proposalModal.to || !proposalModal.subject || !proposalModal.body}
                      className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                      {proposalModal.sending ? '送信中...' : '送信する'}
                    </button>
                    <button onClick={() => setProposalModal(null)} className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                      キャンセル
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showCreate && (
        <ManualEngineerModal
          onClose={() => setShowCreate(false)}
          onCreated={(ems) => {
            setShowCreate(false)
            fetchList()
            handleSelect(ems)
          }}
        />
      )}
    </div>
  )
}

// ── サブコンポーネント ────────────────────────────────────

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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

// ── 手動登録モーダル (E-3) ────────────────────────────────
type ManualEngineerForm = {
  name: string
  age: string
  affiliation_type: string
  affiliation: string
  available_from: string
  nearest_station: string
  skills: string
  unit_price_min: string
  unit_price_max: string
  from_address: string
  body_text: string
}

function ManualEngineerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (ems: EngineerMail) => void
}) {
  const [f, setF] = useState<ManualEngineerForm>({
    name: '', age: '', affiliation_type: '', affiliation: '',
    available_from: '', nearest_station: '', skills: '',
    unit_price_min: '', unit_price_max: '', from_address: '', body_text: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dropOver, setDropOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof ManualEngineerForm>(k: K, v: ManualEngineerForm[K]) =>
    setF(p => ({ ...p, [k]: v }))

  const splitSkills = (s: string) =>
    s.split(/[,、，\n]/).map(x => x.trim()).filter(Boolean)

  const ATTACH_EXT = ['pdf', 'xlsx', 'xls', 'xlsm', 'docx']
  const ATTACH_MAX_SIZE = 10 * 1024 * 1024
  const ATTACH_MAX_FILES = 5
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const incoming: File[] = []
    for (const file of Array.from(list)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ATTACH_EXT.includes(ext)) { setError(`対応していない形式です: ${file.name}（PDF / Excel / Word のみ）`); continue }
      if (file.size > ATTACH_MAX_SIZE) { setError(`サイズが大きすぎます: ${file.name}（10MBまで）`); continue }
      incoming.push(file)
    }
    if (incoming.length === 0) return
    setFiles(prev => {
      const merged = [...prev, ...incoming]
      if (merged.length > ATTACH_MAX_FILES) {
        setError(`添付は最大 ${ATTACH_MAX_FILES} 件までです`)
        return merged.slice(0, ATTACH_MAX_FILES)
      }
      setError(null)
      return merged
    })
  }
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name.trim()) {
      setError('氏名は必須です')
      return
    }
    if (!f.unit_price_min && !f.unit_price_max) {
      setError('単価は下限・上限のいずれかが必須です (35万未満は除外扱いになります)')
      return
    }
    setSubmitting(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('name', f.name.trim())
      if (f.age)                     fd.append('age', String(Number(f.age)))
      if (f.affiliation_type)        fd.append('affiliation_type', f.affiliation_type)
      if (f.affiliation.trim())      fd.append('affiliation', f.affiliation.trim())
      if (f.available_from.trim())   fd.append('available_from', f.available_from.trim())
      if (f.nearest_station.trim())  fd.append('nearest_station', f.nearest_station.trim())
      if (f.from_address.trim())     fd.append('from_address', f.from_address.trim())
      if (f.unit_price_min)          fd.append('unit_price_min', String(Number(f.unit_price_min)))
      if (f.unit_price_max)          fd.append('unit_price_max', String(Number(f.unit_price_max)))
      splitSkills(f.skills).forEach(s => fd.append('skills[]', s))
      if (f.body_text.trim())        fd.append('body_text', f.body_text.trim())
      files.forEach(file => fd.append('attachments[]', file))

      const res = await axios.post('/api/v1/engineer-mails/manual', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onCreated(res.data)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg = e.response?.data?.message
                ?? Object.values(e.response?.data?.errors ?? {}).flat()[0]
                ?? '登録に失敗しました'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <h2 className="text-lg font-semibold text-gray-900">技術者メール 新規登録</h2>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-gray-500">
              LINE や個別メールで受け取った技術者情報を登録します。単価が必須です (35万未満は除外扱い)。
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="氏名 *">
                <input type="text" required value={f.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="年齢">
                <input type="number" min={18} max={99} value={f.age}
                  onChange={e => set('age', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="所属区分">
                <select value={f.affiliation_type}
                  onChange={e => set('affiliation_type', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">未指定</option>
                  <option value="自社正社員">自社正社員</option>
                  <option value="一社先正社員">一社先正社員</option>
                  <option value="BP">BP</option>
                  <option value="BP要員">BP要員</option>
                  <option value="契約社員">契約社員</option>
                  <option value="個人事業主">個人事業主 / フリーランス</option>
                  <option value="入社予定">入社予定</option>
                  <option value="採用予定">採用予定</option>
                </select>
              </FormRow>
              <FormRow label="所属会社名">
                <input type="text" value={f.affiliation}
                  onChange={e => set('affiliation', e.target.value)}
                  placeholder="株式会社〇〇"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="稼働開始">
                <input type="text" value={f.available_from}
                  onChange={e => set('available_from', e.target.value)}
                  placeholder="即日 / 2026-06"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="最寄り駅">
                <input type="text" value={f.nearest_station}
                  onChange={e => set('nearest_station', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <FormRow label="スキル (カンマ・改行区切り)">
              <textarea rows={2} value={f.skills}
                onChange={e => set('skills', e.target.value)}
                placeholder="Java, Spring, AWS"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
            </FormRow>

            <div className="grid grid-cols-3 gap-3">
              <FormRow label="希望単価下限 (万円)">
                <input type="number" value={f.unit_price_min}
                  onChange={e => set('unit_price_min', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="希望単価上限 (万円)">
                <input type="number" value={f.unit_price_max}
                  onChange={e => set('unit_price_max', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="紹介元メール">
                <input type="email" value={f.from_address}
                  onChange={e => set('from_address', e.target.value)}
                  placeholder="bp@example.com"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <FormRow label="メモ・備考 (本文に追記されます)">
              <textarea rows={3} value={f.body_text}
                onChange={e => set('body_text', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
            </FormRow>

            <FormRow label="スキルシート添付 (PDF / Excel / Word・最大5件・各10MB)">
              <div
                onDragOver={e => { e.preventDefault(); if (!dropOver) setDropOver(true) }}
                onDragEnter={e => { e.preventDefault(); setDropOver(true) }}
                onDragLeave={e => { e.preventDefault(); setDropOver(false) }}
                onDrop={e => { e.preventDefault(); setDropOver(false); addFiles(e.dataTransfer?.files ?? null) }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded border-2 border-dashed p-4 text-center transition-colors ${
                  dropOver ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}>
                <p className="text-sm text-gray-600">ファイルをドロップ、またはクリックして選択</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF / Excel(xlsx, xls, xlsm) / Word(docx)</p>
                <input ref={fileInputRef} type="file" multiple
                  accept=".pdf,.xlsx,.xls,.xlsm,.docx" className="hidden"
                  onChange={e => { addFiles(e.target.files); if (e.target) e.target.value = '' }} />
              </div>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((file, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded px-2.5 py-1">
                      <span className="truncate">📎 {file.name}
                        <span className="text-xs text-gray-400"> ({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                      </span>
                      <button type="button" onClick={() => removeFile(i)}
                        className="text-red-500 hover:text-red-700 ml-2 leading-none">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </FormRow>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
            <button type="button" onClick={onClose}
              className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
              キャンセル
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
              {submitting && <Spinner size={11} />}
              {submitting ? '登録中...' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 要確認行コンポーネント ────────────────────────────────
function ReviewRow({
  item,
  expanded,
  expandedDetail,
  expandLoading,
  appliedSearch,
  onExpand,
  onQuickStatus,
}: {
  item: EngineerMail
  expanded: boolean
  expandedDetail: EngineerMail | null
  expandLoading: boolean
  appliedSearch: string
  onExpand: () => void
  onQuickStatus: (id: number, status: string) => void
}) {
  const rank = scoreRank(item.score)
  const skills = (item.skills ?? []).slice(0, 6)
  const extraSkills = Math.max(0, (item.skills ?? []).length - 6)

  return (
    <div className={`bg-white rounded-xl border transition-all ${expanded ? 'border-yellow-400 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* サマリー行: mobile は 2 段組 (上=バッジ+アクション / 下=タイトル) */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 px-3 md:px-4 py-3 cursor-pointer select-none" onClick={onExpand}>
        {/* スコアバッジ */}
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg w-14 md:w-16 text-center ${rank.cls}`}>
          {rank.label} {item.score}
        </span>

        {/* 名前・スキル */}
        <div className="flex-1 min-w-0 order-2 md:order-none basis-full md:basis-auto">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800 truncate">
              {item.name || item.email?.from_name || '(件名なし)'}
            </p>
            {item.has_attachment && (
              <span className="text-xs bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5 flex-shrink-0">📎</span>
            )}
          </div>
          {item.email?.subject && (
            <p className="text-xs text-gray-600 truncate mt-0.5">{item.email.subject}</p>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 truncate max-w-[160px]">
              {item.email?.from_name || item.email?.from_address || '—'}
            </span>
            {skills.map((s, i) => (
              <span key={i} className="text-xs bg-teal-50 text-teal-600 border border-teal-100 rounded px-1.5 py-0.5">{s}</span>
            ))}
            {extraSkills > 0 && (
              <span className="text-xs text-gray-400">+{extraSkills}</span>
            )}
          </div>
        </div>

        {/* 所属区分・最寄り駅 */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0 text-xs text-gray-500">
          {item.affiliation_type && <span>{item.affiliation_type}</span>}
          {item.nearest_station && <span>📍 {item.nearest_station}</span>}
          {item.available_from && <span>🗓 {item.available_from}</span>}
        </div>

        {/* 受信日時 */}
        <span className="hidden md:block flex-shrink-0 text-xs text-gray-400 w-16 text-right">
          {formatDateFull(item.received_at)}
        </span>

        {/* アクションボタン (mobile はラップして右上) */}
        <div className="flex gap-1.5 flex-shrink-0 ml-auto md:ml-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onQuickStatus(item.id, 'new')}
            className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 font-medium whitespace-nowrap">
            新着にする
          </button>
          <button
            onClick={() => onQuickStatus(item.id, 'excluded')}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 font-medium">
            非対象
          </button>
          <button
            onClick={onExpand}
            className="text-xs border border-gray-300 text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-50">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* 展開詳細 */}
      {expanded && (
        <div className="border-t border-yellow-200 bg-yellow-50/30 px-4 py-4 space-y-3">
          {expandLoading ? (
            <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
          ) : expandedDetail ? (
            <>
              {/* 判定理由 */}
              {(expandedDetail.score_reasons ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">判定理由</p>
                  <div className="flex flex-wrap gap-1">
                    {expandedDetail.score_reasons.map((r, i) => (
                      <ScoreReasonChip key={i} reason={r} />
                    ))}
                  </div>
                </div>
              )}

              {/* 抽出サマリー */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {expandedDetail.name && (
                  <div><span className="text-gray-400">氏名</span><p className="font-medium text-gray-700">{expandedDetail.name}</p></div>
                )}
                {expandedDetail.affiliation_type && (
                  <div><span className="text-gray-400">所属区分</span><p className="font-medium text-gray-700">{expandedDetail.affiliation_type}</p></div>
                )}
                {expandedDetail.nearest_station && (
                  <div><span className="text-gray-400">最寄り駅</span><p className="font-medium text-gray-700">{expandedDetail.nearest_station}</p></div>
                )}
                {expandedDetail.available_from && (
                  <div><span className="text-gray-400">稼働開始</span><p className="font-medium text-gray-700">{expandedDetail.available_from}</p></div>
                )}
              </div>

              {/* スキル */}
              {expandedDetail.skills && expandedDetail.skills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">スキル</p>
                  <div className="flex flex-wrap gap-1">
                    {expandedDetail.skills.map((s, i) => (
                      <span key={i} className="text-xs bg-teal-50 text-teal-600 border border-teal-100 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 本文（キーワードハイライト） */}
              {(expandedDetail.email?.body_text || expandedDetail.email?.body_html) && (() => {
                const raw = expandedDetail.email!.body_text
                  ?? expandedDetail.email!.body_html!
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi, '\n')
                    .replace(/<\/div>/gi, '\n')
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                const body = raw.slice(0, 1500)
                return (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">メール本文</p>
                    <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
                      {highlightBody(body, [...(appliedSearch ? [appliedSearch] : []), ...(expandedDetail.skills ?? [])].filter(Boolean))}
                      {raw.length > 1500 && <span className="text-gray-400">…（以下省略）</span>}
                    </div>
                  </div>
                )
              })()}

              {/* 判断ボタン */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onQuickStatus(item.id, 'new')}
                  className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 font-medium">
                  ✓ 新着にする
                </button>
                <button
                  onClick={() => onQuickStatus(item.id, 'excluded')}
                  className="text-sm bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
                  ✗ 非対象
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ProcessingBar({ active, label }: { active: boolean; label?: string }) {
  if (!active) return null
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-teal-600 animate-pulse">{label ?? '処理中...'}</span>
      </div>
      <div className="w-full h-1.5 bg-teal-100 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full"
          style={{ animation: 'indeterminate 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`
        @keyframes indeterminate {
          0%   { transform: translateX(-100%) scaleX(0.3); }
          50%  { transform: translateX(50%)   scaleX(0.5); }
          100% { transform: translateX(300%)  scaleX(0.3); }
        }
      `}</style>
    </div>
  )
}

function ScoreReasonChip({ reason }: { reason: string }) {
  return (
    <span className="text-xs px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-100 rounded-full">{reason}</span>
  )
}

function highlightBody(text: string, keywords: string[]): React.ReactNode {
  const kws = keywords.filter(k => k.length >= 2)
  if (!kws.length) return text

  const urlPattern = /https?:\/\/[^\s\u3000"'<>「」【】）)]+/g
  const segments: { text: string; isUrl: boolean }[] = []
  let lastIndex = 0
  let urlMatch: RegExpExecArray | null
  while ((urlMatch = urlPattern.exec(text)) !== null) {
    if (urlMatch.index > lastIndex) segments.push({ text: text.slice(lastIndex, urlMatch.index), isUrl: false })
    segments.push({ text: urlMatch[0], isUrl: true })
    lastIndex = urlMatch.index + urlMatch[0].length
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isUrl: false })

  const kwPattern = new RegExp(
    `(?<![a-zA-Z0-9/.])(${kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-zA-Z0-9/.])`,
    'gi'
  )

  return segments.flatMap((seg, si) => {
    if (seg.isUrl) return [seg.text]
    const parts = seg.text.split(kwPattern)
    return parts.map((part, pi) =>
      kws.some(k => k.toLowerCase() === part.toLowerCase())
        ? <mark key={`${si}-${pi}`} style={{ background: '#ccfbf1', borderRadius: 2, padding: '0 1px', color: '#0f766e' }}>{part}</mark>
        : part
    )
  })
}

// /emails 右ペインと表示を揃えるための絶対日時フォーマット（例: 2026/6/2 14:30:45）
function formatDateFull(raw: string): string {
  try {
    const s = raw.replace(' ', 'T') + (raw.endsWith('Z') ? '' : 'Z')
    return new Date(s).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  } catch { return raw }
}

function formatDateTime(raw: string): string {
  try {
    if (!raw) return '—'
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
