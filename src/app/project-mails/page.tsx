'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import axios from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import { useStaleResponseGuard } from '@/hooks/useStaleResponseGuard'
import EmailHtmlFrame from '@/components/EmailHtmlFrame'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useResizableSplit } from '@/hooks/useResizableSplit'

// ── 型定義 ─────────────────────────────────────────────────

type Email = {
  id: number
  subject: string
  from_name: string | null
  from_address: string
  body_text: string | null
  body_html: string | null
  received_at: string
  arrived_at: string | null
  attachments: { id: number; filename: string; mime_type: string | null; size: number | null }[]
}

type ProjectMail = {
  id: number
  email_id: number
  score: number
  score_reasons: string[]
  engine: string
  customer_name: string | null
  sales_contact: string | null
  phone: string | null
  title: string | null
  required_skills: string[] | null
  preferred_skills: string[] | null
  process: string[] | null
  work_location: string | null
  remote_ok: boolean | null
  unit_price_min: number | null
  unit_price_max: number | null
  age_limit: string | null
  nationality_ok: boolean | null
  contract_type: string | null
  start_date: string | null
  supply_chain: number | null
  status: string
  lost_reason: string | null
  received_at: string
  arrived_at: string | null
  email?: Email
}

type Paginated = {
  data: ProjectMail[]
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

type EmailBodyTemplate = {
  name: string
  name_en: string | null
  department: string | null
  position: string | null
  email: string | null
  mobile: string | null
  body_text?: string | null
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
  { value: '',       label: '全て',     color: 'text-white bg-gray-700 border-gray-700' },
  { value: 'review', label: '要確認', color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  { value: 'new',    label: '新着',     color: 'text-blue-700 bg-blue-50 border-blue-300' },
  { value: 'proposed',  label: '提案済', color: 'text-purple-700 bg-purple-50 border-purple-300' },
  { value: 'interview', label: '面談',   color: 'text-indigo-700 bg-indigo-50 border-indigo-300' },
  { value: 'won',       label: '成約',   color: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'lost',      label: '失注',   color: 'text-red-700 bg-red-50 border-red-300' },
  { value: 'excluded',  label: '除外',   color: 'text-gray-500 bg-gray-50 border-gray-300' },
]

const STATUS_NEXT: Record<string, { label: string; value: string; cls: string }[]> = {
  review:   [
    { label: '新着にする', value: 'new',      cls: 'bg-blue-600 text-white hover:bg-blue-700' },
    { label: '除外',     value: 'excluded', cls: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
  ],
  new:      [
    { label: '提案済にする', value: 'proposed', cls: 'bg-purple-600 text-white hover:bg-purple-700' },
    { label: '除外',         value: 'excluded', cls: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
  ],
  proposed: [
    { label: '面談へ',   value: 'interview', cls: 'bg-indigo-600 text-white hover:bg-indigo-700' },
    { label: '失注',     value: 'lost',      cls: 'bg-red-500 text-white hover:bg-red-600' },
  ],
  interview:[
    { label: '成約',     value: 'won',  cls: 'bg-green-600 text-white hover:bg-green-700' },
    { label: '失注',     value: 'lost', cls: 'bg-red-500 text-white hover:bg-red-600' },
  ],
  won:      [],
  lost:     [
    { label: '再開',     value: 'new', cls: 'bg-blue-600 text-white hover:bg-blue-700' },
  ],
  excluded: [
    { label: '案件に戻す', value: 'new', cls: 'bg-blue-600 text-white hover:bg-blue-700' },
  ],
}

const SCORE_FILTERS = [
  { value: 'all',  label: 'ScoreALL', scoreMin: 0,  scoreMax: 100 },
  { value: 'high', label: '高 80+',   scoreMin: 80, scoreMax: 100 },
  { value: 'mid',  label: '中 60-',   scoreMin: 60, scoreMax: 79  },
  { value: 'low',  label: '低 ～39',  scoreMin: 0,  scoreMax: 39  },
]

function scoreRank(score: number) {
  if (score >= 85) return { label: '◎', cls: 'bg-green-500 text-white' }
  if (score >= 70) return { label: '○', cls: 'bg-blue-500 text-white' }
  if (score >= 55) return { label: '△', cls: 'bg-yellow-400 text-gray-800' }
  return { label: '×', cls: 'bg-gray-400 text-white' }
}

// ── メインコンポーネント ──────────────────────────────────

export default function ProjectMailsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // 左右ペイン幅（md+ のみ可変。モバイルは一画面切替のため固定）
  const split = useResizableSplit('projectMails:leftPct')
  // /project-mails/manual で手動登録モード (E-3 別枠化 2026-05-29)。
  // 既定 (/project-mails) は通常メール取込のみ表示。
  const sourceMode: 'imap' | 'manual' = pathname?.endsWith('/manual') ? 'manual' : 'imap'
  const [items, setItems] = useState<Paginated | null>(null)
  const [selected, setSelected] = useState<ProjectMail | null>(null)
  // デフォルトは「全て」(ステータス指定なし) で受信日順表示
  const [statusFilter, setStatusFilter] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [search, setSearch] = useState('')             // 入力欄の値 (未確定)
  const [appliedSearch, setAppliedSearch] = useState('') // Enter/🔍 で確定された検索値
  const [searchBody, setSearchBody] = useState(false)  // 本文も検索
  const [listLoading, setListLoading] = useState(false) // 一覧取得中
  const [page, setPage] = useState(1)
  const [rescoring, setRescoring] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [scoreMsg, setScoreMsg] = useState('')

  // 編集フォーム state
  const [form, setForm] = useState<Partial<ProjectMail>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 手動登録モーダル (E-3 営業打ち合わせ 2026-05-25)
  const [showCreate, setShowCreate] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedItem, setExpandedItem] = useState<ProjectMail | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // スレッド
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadExpanded, setThreadExpanded] = useState<number | null>(null)
  const [replyForm, setReplyForm] = useState<{ name: string; to: string; subject: string; body: string; files: File[] } | null>(null)
  const [replySending, setReplySending] = useState(false)
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)
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

  useEffect(() => {
    axios.get('/api/v1/email-body-templates/me').then(res => {
      if (res.data) setEmailTemplate(res.data)
    }).catch(() => {})
  }, [])

  const fetchList = useCallback(async () => {
    const sf = SCORE_FILTERS.find(f => f.value === scoreFilter) ?? SCORE_FILTERS[0]
    setListLoading(true)
    try {
      const res = await axios.get('/api/v1/project-mails', {
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

  // URLパラメータ select={id} でメール自動選��
  useEffect(() => {
    const selectId = searchParams.get('select')
    if (!selectId) return
    const id = parseInt(selectId)
    if (isNaN(id)) return
    // ステータスフィルタを解除して全件から探す
    setStatusFilter('')
    axios.get(`/api/v1/project-mails/${id}`).then(res => {
      setSelected(res.data)
      setForm(res.data)
      setSaveMsg(null)
      setShowBody(false)
      // スレッド取得
      setThreadLoading(true)
      axios.get(`/api/v1/project-mails/${id}/thread`).then(tres => {
        setThreadItems(tres.data.thread ?? [])
      }).catch(() => setThreadItems([])).finally(() => setThreadLoading(false))
    }).catch(() => {})
    // URLパラメータをクリア
    router.replace('/project-mails')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 連続クリック時の async race 対策 (docs/730 §High #5):
  // 古いレスポンスが新しい選択を上書きしないよう、選択 id を hook で追跡。
  const selectGuard = useStaleResponseGuard<number>()

  // 選択時に詳細取得。detail と thread は互いに独立なので Promise.all で並列化
  // (docs/730 §Low #36)。
  const handleSelect = async (item: ProjectMail) => {
    selectGuard.mark(item.id)
    setDetailLoading(true)
    setThreadLoading(true)
    setSelected(null)
    setThreadItems([])
    setReplyForm(null)
    const [res, tres] = await Promise.all([
      axios.get(`/api/v1/project-mails/${item.id}`).catch(() => null),
      axios.get(`/api/v1/project-mails/${item.id}/thread`).catch(() => null),
    ])
    if (selectGuard.isStale(item.id)) return
    if (res) {
      setSelected(res.data)
      setForm(res.data)
      setSaveMsg(null)
      setShowBody(false)
    }
    setThreadItems(tres?.data?.thread ?? [])
    setDetailLoading(false)
    setThreadLoading(false)
  }

  // スレッド再取得
  const fetchThread = async (id: number) => {
    setThreadLoading(true)
    try {
      const tres = await axios.get(`/api/v1/project-mails/${id}/thread`)
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
        await axios.post(`/api/v1/project-mails/${selected.id}/send-proposal`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        await axios.post(`/api/v1/project-mails/${selected.id}/send-proposal`, {
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

  // 要確認モード: アコーディオン展開
  const handleExpand = async (item: ProjectMail) => {
    if (expandedId === item.id) { setExpandedId(null); setExpandedItem(null); return }
    setExpandedId(item.id)
    setExpandLoading(true)
    try {
      const res = await axios.get(`/api/v1/project-mails/${item.id}`)
      setExpandedItem(res.data)
    } finally { setExpandLoading(false) }
  }

  // 要確認モード: インラインステータス変更
  const handleQuickStatus = async (id: number, status: string) => {
    try {
      await axios.patch(`/api/v1/project-mails/${id}/status`, { status })
      fetchList()
      if (expandedId === id) { setExpandedId(null); setExpandedItem(null) }
    } catch { /* ignore */ }
  }

  // 全件再スコア / 全件再抽出は誤操作で数千件処理が走る/本番DB一斉更新のリスクがあるため、
  // 管理者(tenant_admin/super_admin)のみに表示する（営業=tenant_user には非表示）。
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'tenant_admin' || currentUser?.role === 'super_admin'

  // 全件再スコアリング（非同期ジョブ。バックエンドの Schedule tick が処理し進捗をポーリング）。
  // mountedRef で unmount 後の setTimeout 再発を防ぐ (docs/730 §Medium #16)。
  const pollRescoreMountedRef = useRef(true)
  useEffect(() => () => { pollRescoreMountedRef.current = false }, [])
  const pollRescoreStatus = () => {
    axios.get('/api/v1/project-mails/rescore-status').then(res => {
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
    if (!confirm('全件を再スコアリングします。ステータスが自動変更されますがよろしいですか？')) return
    setRescoring(true); setScoreMsg('再スコアリングを開始しています...')
    try {
      await axios.post('/api/v1/project-mails/rescore-all', {})
      pollRescoreStatus()
    } catch {
      setScoreMsg('再スコアリングの開始に失敗しました')
      setRescoring(false)
    }
  }

  // ページ表示時、進行中の再スコアジョブがあれば進捗表示を復帰（ブラウザを閉じても継続するため）
  useEffect(() => {
    axios.get('/api/v1/project-mails/rescore-status').then(res => {
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

  // 抽出情報を全件再計算（バッチ処理で進捗表示）。
  // 手動編集が上書きされるため確認ダイアログを表示 (docs/730 §Medium #22)。
  const handleReextractAll = async () => {
    if (!confirm('情報抽出を全件再実行します。手動で編集した抽出情報が上書きされます。よろしいですか？')) return
    setExtracting(true); setScoreMsg('')
    try {
      let total = 0, offset = 0
      while (true) {
        const res = await axios.post('/api/v1/project-mails/reextract-all', { offset })
        total += res.data.count ?? 0
        const remaining = res.data.remaining ?? 0
        setScoreMsg(`抽出: ${total}件完了 / 残り: ${remaining}件`)
        if (remaining === 0 || res.data.count === 0) break
        offset = res.data.offset ?? (offset + (res.data.count ?? 0))
      }
      setScoreMsg(`完了: ${total}件の抽出情報を更新しました`)
      fetchList()
      if (selected) {
        const refreshed = await axios.get(`/api/v1/project-mails/${selected.id}`)
        setSelected(refreshed.data)
        setForm(refreshed.data)
      }
    } catch { setScoreMsg('抽出情報の更新に失敗しました') }
    finally { setExtracting(false) }
  }

  // 再スコアリング (連打防止 / docs/730 §Low #38)
  const [rescoringOne, setRescoringOne] = useState(false)
  const handleRescore = async () => {
    if (!selected || rescoringOne) return
    setRescoringOne(true)
    try {
      const res = await axios.post(`/api/v1/project-mails/${selected.id}/rescore`)
      setSelected(res.data)
      setForm(res.data)
      fetchList()
    } catch {
      setSaveMsg({ type: 'err', text: '再スコアリングに失敗しました' })
    } finally {
      setRescoringOne(false)
    }
  }

  // 保存
  const handleSave = async () => {
    if (!selected) return
    setSaving(true); setSaveMsg(null)
    try {
      const payload = {
        customer_name:   form.customer_name,
        sales_contact:   form.sales_contact,
        phone:           form.phone,
        title:           form.title,
        required_skills: typeof form.required_skills === 'string'
          ? (form.required_skills as string).split(',').map(s => s.trim()).filter(Boolean)
          : form.required_skills,
        preferred_skills: typeof form.preferred_skills === 'string'
          ? (form.preferred_skills as string).split(',').map(s => s.trim()).filter(Boolean)
          : form.preferred_skills,
        process: typeof form.process === 'string'
          ? (form.process as string).split(',').map(s => s.trim()).filter(Boolean)
          : form.process,
        work_location:  form.work_location,
        remote_ok:      form.remote_ok,
        unit_price_min: form.unit_price_min,
        unit_price_max: form.unit_price_max,
        age_limit:      form.age_limit,
        nationality_ok: form.nationality_ok,
        contract_type:  form.contract_type,
        start_date:     form.start_date,
        supply_chain:   form.supply_chain,
      }
      const res = await axios.patch(`/api/v1/project-mails/${selected.id}`, payload)
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
      const res = await axios.patch(`/api/v1/project-mails/${selected.id}/status`, { status: nextStatus })
      setSelected(res.data)
      setForm(res.data)
      fetchList()
    } catch { setSaveMsg({ type: 'err', text: 'ステータス変更に失敗しました' }) }
  }

  // 削除（論理削除・一覧から除外）
  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`「${selected.title || `案件メール #${selected.id}`}」を削除します。よろしいですか？`)) return
    try {
      await axios.delete(`/api/v1/project-mails/${selected.id}`)
      setSelected(null)
      setForm({})
      fetchList()
    } catch { setSaveMsg({ type: 'err', text: '削除に失敗しました' }) }
  }

  const set = (key: keyof ProjectMail, val: unknown) => setForm(f => ({ ...f, [key]: val }))
  const arrToStr = (v: string[] | null | undefined) => (v ?? []).join(', ')

  // ── 要確認モード（全幅1行1判断） ──────────────────────────
  if (statusFilter === 'review') {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-semibold text-gray-900">要確認案件メール</h1>
            {items && (
              <span className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-300 px-2.5 py-0.5 rounded-full font-medium">
                {items.total}件
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* タブ切り替え */}
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map(tab => (
                <button key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setScoreFilter('all'); setPage(1); setExpandedId(null) }}
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
                  onClick={() => { setScoreFilter(sf.value); setPage(1); setExpandedId(null) }}
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
                  if (!e.target.value) { setAppliedSearch(''); setPage(1); setSelected(null); setForm({}) }
                }}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
              <button type="submit" disabled={listLoading} title="検索 (Enter)"
                className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[36px] flex items-center justify-center">
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
            {isAdmin && (<>
            <button onClick={handleRescoreAll} disabled={rescoring || extracting}
              className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-md hover:bg-orange-100 disabled:opacity-50 flex items-center gap-1.5">
              {rescoring && <Spinner size={11} />}
              {rescoring ? '再スコア中...' : '全件再スコア'}
            </button>
            <button onClick={handleReextractAll} disabled={extracting || rescoring}
              className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-md hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
              {extracting && <Spinner size={11} />}
              {extracting ? '抽出中...' : '情報抽出'}
            </button>
            </>)}
          </div>
          <ProcessingBar
            active={rescoring}
            label={rescoring ? '全件再スコア中...' : undefined}
          />
          {scoreMsg && <p className="text-xs text-blue-700 mt-2 font-medium">{scoreMsg}</p>}
        </div>

        {/* リスト (flex-1 でスクロール) */}
        <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 md:px-6 py-3 md:py-4 space-y-2">
          {items?.data.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm">要確認案件メールはありません</p>
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
                className="text-sm text-blue-600 disabled:text-gray-300">← 前へ</button>
              <span className="text-sm text-gray-500">{page} / {items.last_page}</span>
              <button disabled={page === items.last_page} onClick={() => setPage(p => p + 1)}
                className="text-sm text-blue-600 disabled:text-gray-300">次へ →</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={split.containerRef} className="flex h-screen bg-gray-50">

      {/* 左ペイン (mobile では選択時に非表示) */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-[var(--split-left)] bg-white border-r border-gray-200 flex-col`}
           style={split.leftPaneStyle}>
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">
              {sourceMode === 'manual' ? '手動登録 案件' : '案件メール'}
            </h1>
            <div className="flex gap-1.5">
              {sourceMode === 'manual' ? (
                <>
                  <Link href="/project-mails"
                    className="text-xs bg-white text-gray-600 border border-gray-300 px-2.5 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                    title="通常の案件メール一覧へ">
                    ← 通常メール
                  </Link>
                  <button onClick={() => setShowCreate(true)}
                    className="text-xs bg-green-600 text-white border border-green-600 px-2.5 py-1.5 rounded-md hover:bg-green-700 flex items-center gap-1.5"
                    title="LINE や個別メールから受け取った案件を手動登録">
                    <span className="text-sm leading-none">+</span> 新規登録
                  </button>
                </>
              ) : (
                <>
                  <Link href="/project-mails/manual"
                    className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-md hover:bg-green-100 flex items-center gap-1.5"
                    title="手動登録した案件の一覧 (LINE/個別メールから登録)">
                    🗂 手動登録一覧
                  </Link>
                  {isAdmin && (<>
                  <button onClick={handleRescoreAll} disabled={rescoring || extracting}
                    className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-md hover:bg-orange-100 disabled:opacity-50 flex items-center gap-1.5">
                    {rescoring && <Spinner size={11} />}
                    {rescoring ? '再スコア中...' : '全件再スコア'}
                  </button>
                  <button onClick={handleReextractAll} disabled={extracting || rescoring}
                    className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-md hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
                    {extracting && <Spinner size={11} />}
                    {extracting ? '抽出中...' : '情報抽出'}
                  </button>
                  </>)}
                </>
              )}
            </div>
          </div>
          {scoreMsg && <p className="text-xs text-blue-700 font-medium">{scoreMsg}</p>}

          <form
            onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); setPage(1) }}
            className="flex gap-1.5"
          >
            <input type="text"
              placeholder={searchBody ? '件名・顧客名・勤務地・本文で検索' : '件名・顧客名・勤務地で検索'}
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                if (!e.target.value) { setAppliedSearch(''); setPage(1); setSelected(null); setForm({}) }
              }}
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={listLoading} title="検索 (Enter)"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[44px] flex items-center justify-center">
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
                <span className="font-semibold text-blue-700"> {items.total.toLocaleString()} 件</span> Hit
              </span>
            )}
          </div>

          <ProcessingBar
            active={rescoring || extracting}
            label={rescoring ? '全件再スコア中...' : extracting ? '情報抽出中...' : undefined}
          />

          {/* ステータスタブ */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setScoreFilter('all'); setPage(1) }}
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
                  selected?.id === item.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rank.cls}`}>
                    {rank.label} {item.score}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0"
                    title={`受信(着信) ${formatDateFull(item.arrived_at ?? item.received_at)} / 送信 ${formatDateFull(item.received_at)}`}>
                    {formatDateFull(item.arrived_at ?? item.received_at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.title || item.email?.subject || '(タイトル未抽出)'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 truncate flex-1">
                    {item.customer_name || item.email?.from_name || item.email?.from_address || '—'}
                  </p>
                  {item.unit_price_min && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {item.unit_price_min}〜{item.unit_price_max ?? '?'}万
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {items && items.last_page > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="text-xs text-blue-600 disabled:text-gray-300">前へ</button>
            <span className="text-xs text-gray-500">{page} / {items.last_page}</span>
            <button disabled={page === items.last_page} onClick={() => setPage(p => p + 1)}
              className="text-xs text-blue-600 disabled:text-gray-300">次へ</button>
          </div>
        )}
      </div>

      {/* リサイザー (md+ のみ。ドラッグで左右幅を変更) */}
      <ResizeHandle dragging={split.dragging} onStart={split.startDragging} onReset={split.reset} />

      {/* 右ペイン */}
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
              {/* 案件タイトル + スコア */}
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-800 leading-snug mb-1">
                      {selected.title || selected.email?.subject || `案件メール #${selected.id}`}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>📧 {selected.email?.from_name || selected.customer_name || '—'}</span>
                      <span className="text-gray-300">|</span>
                      <span>{selected.email?.from_address}</span>
                      <span className="text-gray-300">|</span>
                      <span title={`送信 ${formatDateFull(selected.received_at)}`}>
                        受信 {formatDateFull(selected.arrived_at ?? selected.received_at)}
                      </span>
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
                    onClick={() => router.push(`/matching/${selected.id}`)}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium">
                    マッチング
                  </button>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams()
                      if (selected.title) params.set('title', selected.title)
                      if (selected.work_location) params.set('work_location', selected.work_location)
                      if (selected.unit_price_min) params.set('unit_price_min', String(selected.unit_price_min))
                      if (selected.unit_price_max) params.set('unit_price_max', String(selected.unit_price_max))
                      if (selected.start_date) params.set('start_date', selected.start_date)
                      if (selected.remote_ok != null) params.set('remote_ok', String(selected.remote_ok))
                      if (selected.required_skills?.length) params.set('required_skills', selected.required_skills.join(','))
                      if (selected.preferred_skills?.length) params.set('preferred_skills', selected.preferred_skills.join(','))
                      if (selected.email?.from_name) params.set('customer_name', selected.email.from_name)
                      params.set('from', '/project-mails')
                      params.set('project_mail_id', String(selected.id))
                      if (selected.email?.body_text) {
                        sessionStorage.setItem('project_mail_body', selected.email.body_text)
                      }
                      router.push(`/public-projects/create?${params.toString()}`)
                    }}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">
                    案件登録
                  </button>
                  <button
                    onClick={() => router.push(`/deliveries?tab=send&project_mail_id=${selected.id}`)}
                    className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 font-medium">
                    📤 一斉配信
                  </button>
                  <button
                    onClick={() => router.push(`/emails?email_id=${selected.email_id}`)}
                    className="text-xs border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                    メール詳細
                  </button>
                  <button onClick={handleRescore}
                    disabled={rescoringOne}
                    className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    {rescoringOne ? '再スコア中…' : '再スコア'}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="顧客会社名">
                    <input value={form.customer_name ?? ''} onChange={e => set('customer_name', e.target.value)}
                      className="form-input" placeholder="株式会社〇〇" />
                  </FormRow>
                  <FormRow label="案件タイトル">
                    <input value={form.title ?? ''} onChange={e => set('title', e.target.value)}
                      className="form-input" placeholder="Javaバックエンド開発" />
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="営業担当者">
                    <input value={form.sales_contact ?? ''} onChange={e => set('sales_contact', e.target.value || null)}
                      className="form-input" placeholder="山田 太郎" />
                  </FormRow>
                  <FormRow label="電話番号">
                    <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value || null)}
                      className="form-input" placeholder="090-1234-5678" />
                  </FormRow>
                </div>

                <FormRow label="必須スキル（カンマ区切り）">
                  <input value={arrToStr(form.required_skills)} onChange={e => set('required_skills', e.target.value as unknown)}
                    className="form-input" placeholder="Java, Spring, AWS" />
                </FormRow>

                <FormRow label="尚可スキル（カンマ区切り）">
                  <input value={arrToStr(form.preferred_skills)} onChange={e => set('preferred_skills', e.target.value as unknown)}
                    className="form-input" placeholder="Docker, Kubernetes" />
                </FormRow>

                <FormRow label="工程（カンマ区切り）">
                  <input value={arrToStr(form.process)} onChange={e => set('process', e.target.value as unknown)}
                    className="form-input" placeholder="要件定義, 基本設計, 開発" />
                </FormRow>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="勤務地">
                    <input value={form.work_location ?? ''} onChange={e => set('work_location', e.target.value)}
                      className="form-input" placeholder="東京都品川区" />
                  </FormRow>
                  <FormRow label="リモート">
                    <select value={form.remote_ok === null ? '' : String(form.remote_ok)}
                      onChange={e => set('remote_ok', e.target.value === '' ? null : e.target.value === 'true')}
                      className="form-input">
                      <option value="">不明</option>
                      <option value="true">可</option>
                      <option value="false">不可</option>
                    </select>
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <FormRow label="単価下限（万円）">
                    <input type="number" value={form.unit_price_min ?? ''} onChange={e => set('unit_price_min', e.target.value ? Number(e.target.value) : null)}
                      className="form-input" placeholder="60" />
                  </FormRow>
                  <FormRow label="単価上限（万円）">
                    <input type="number" value={form.unit_price_max ?? ''} onChange={e => set('unit_price_max', e.target.value ? Number(e.target.value) : null)}
                      className="form-input" placeholder="80" />
                  </FormRow>
                  <FormRow label="開始時期">
                    <input value={form.start_date ?? ''} onChange={e => set('start_date', e.target.value)}
                      className="form-input" placeholder="即日 / 2026-06" />
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <FormRow label="契約形態">
                    <select value={form.contract_type ?? ''} onChange={e => set('contract_type', e.target.value || null)} className="form-input">
                      <option value="">不明</option>
                      <option>準委任</option>
                      <option>派遣</option>
                      <option>請負</option>
                    </select>
                  </FormRow>
                  <FormRow label="年齢制限">
                    <input value={form.age_limit ?? ''} onChange={e => set('age_limit', e.target.value || null)}
                      className="form-input" placeholder="〜45歳" />
                  </FormRow>
                  <FormRow label="外国籍">
                    <select value={form.nationality_ok === null ? '' : String(form.nationality_ok)}
                      onChange={e => set('nationality_ok', e.target.value === '' ? null : e.target.value === 'true')}
                      className="form-input">
                      <option value="">不明</option>
                      <option value="true">可</option>
                      <option value="false">不可</option>
                    </select>
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormRow label="商流（何次請け）">
                    <input type="number" min={1} max={9} value={form.supply_chain ?? ''}
                      onChange={e => set('supply_chain', e.target.value ? Number(e.target.value) : null)}
                      className="form-input" placeholder="1" />
                  </FormRow>
                </div>

                {saveMsg && (
                  <p className={`text-sm ${saveMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMsg.text}
                  </p>
                )}

                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={saving}
                    className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
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
                  <div className="border border-blue-300 rounded-lg p-4 bg-blue-50/50 space-y-3">
                    <p className="text-sm font-semibold text-blue-700">返信を作成</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">宛名</label>
                      <input type="text" value={replyForm.name} onChange={e => setReplyForm(f => f ? { ...f, name: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">宛先</label>
                      <input type="email" value={replyForm.to} onChange={e => setReplyForm(f => f ? { ...f, to: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">件名</label>
                      <input type="text" value={replyForm.subject} onChange={e => setReplyForm(f => f ? { ...f, subject: e.target.value } : f)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">本文</label>
                      <textarea value={replyForm.body} onChange={e => setReplyForm(f => f ? { ...f, body: e.target.value } : f)}
                        rows={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
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
                        replyDropOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
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
                          className="text-xs text-blue-600 hover:underline"
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
                        className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
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
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
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
                          ...extractKeywordsFromReasons(selected.score_reasons ?? []),
                          ...(selected.required_skills ?? []),
                          ...(selected.preferred_skills ?? []),
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
            <p className="text-sm">{detailLoading ? '読み込み中...' : '案件メールを選択してください'}</p>
          </div>
        )}
      </div>

      {showCreate && (
        <ManualProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(pms) => {
            setShowCreate(false)
            fetchList()
            handleSelect(pms)
          }}
        />
      )}
    </div>
  )
}

// ── サブコンポーネント ────────────────────────────────────

function ProcessingBar({ active, label }: { active: boolean; label?: string }) {
  if (!active) return null
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-blue-600 animate-pulse">{label ?? '処理中...'}</span>
      </div>
      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full animate-[progress_1.5s_ease-in-out_infinite]"
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
type ManualProjectForm = {
  customer_name: string
  title: string
  sales_contact: string
  phone: string
  from_address: string
  required_skills: string
  preferred_skills: string
  work_location: string
  unit_price_min: string
  unit_price_max: string
  start_date: string
  contract_type: string
  remote_ok: '' | 'true' | 'false'
  age_limit: string
  supply_chain: string
  body_text: string
}

function ManualProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (pms: ProjectMail) => void
}) {
  const [f, setF] = useState<ManualProjectForm>({
    customer_name: '', title: '', sales_contact: '', phone: '', from_address: '',
    required_skills: '', preferred_skills: '', work_location: '',
    unit_price_min: '', unit_price_max: '', start_date: '', contract_type: '',
    remote_ok: '', age_limit: '', supply_chain: '', body_text: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof ManualProjectForm>(k: K, v: ManualProjectForm[K]) =>
    setF(p => ({ ...p, [k]: v }))

  const splitSkills = (s: string) =>
    s.split(/[,、，\n]/).map(x => x.trim()).filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.customer_name.trim() || !f.title.trim()) {
      setError('顧客名とタイトルは必須です')
      return
    }
    setSubmitting(true); setError(null)
    try {
      const payload: Record<string, unknown> = {
        customer_name: f.customer_name.trim(),
        title:         f.title.trim(),
      }
      if (f.sales_contact.trim()) payload.sales_contact = f.sales_contact.trim()
      if (f.phone.trim())         payload.phone         = f.phone.trim()
      if (f.from_address.trim())  payload.from_address  = f.from_address.trim()
      if (f.work_location.trim()) payload.work_location = f.work_location.trim()
      if (f.start_date.trim())    payload.start_date    = f.start_date.trim()
      if (f.contract_type)        payload.contract_type = f.contract_type
      if (f.age_limit.trim())     payload.age_limit     = f.age_limit.trim()
      const req = splitSkills(f.required_skills);  if (req.length) payload.required_skills  = req
      const pref = splitSkills(f.preferred_skills); if (pref.length) payload.preferred_skills = pref
      if (f.unit_price_min) payload.unit_price_min = Number(f.unit_price_min)
      if (f.unit_price_max) payload.unit_price_max = Number(f.unit_price_max)
      if (f.remote_ok)      payload.remote_ok      = f.remote_ok === 'true'
      if (f.supply_chain)   payload.supply_chain   = Number(f.supply_chain)
      if (f.body_text.trim()) payload.body_text    = f.body_text.trim()

      const res = await axios.post('/api/v1/project-mails/manual', payload)
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
            <h2 className="text-lg font-semibold text-gray-900">案件メール 新規登録</h2>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-gray-500">
              LINE や個別メールで受け取った案件情報を登録します。スコアは入力内容から自動計算されます。
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="顧客名 *">
                <input type="text" required value={f.customer_name}
                  onChange={e => set('customer_name', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="担当者">
                <input type="text" value={f.sales_contact}
                  onChange={e => set('sales_contact', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <FormRow label="タイトル / 件名 *">
              <input type="text" required value={f.title}
                onChange={e => set('title', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
            </FormRow>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="送信元メール">
                <input type="email" value={f.from_address}
                  onChange={e => set('from_address', e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="電話番号">
                <input type="text" value={f.phone}
                  onChange={e => set('phone', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <FormRow label="必須スキル (カンマ・改行区切り)">
              <textarea rows={2} value={f.required_skills}
                onChange={e => set('required_skills', e.target.value)}
                placeholder="Java, Spring, MySQL"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
            </FormRow>

            <FormRow label="尚可スキル">
              <textarea rows={2} value={f.preferred_skills}
                onChange={e => set('preferred_skills', e.target.value)}
                placeholder="AWS, Docker"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
            </FormRow>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="勤務地">
                <input type="text" value={f.work_location}
                  onChange={e => set('work_location', e.target.value)}
                  placeholder="東京 / 大阪 / リモート"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="リモート可否">
                <select value={f.remote_ok}
                  onChange={e => set('remote_ok', e.target.value as ManualProjectForm['remote_ok'])}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">不明</option>
                  <option value="true">可</option>
                  <option value="false">不可</option>
                </select>
              </FormRow>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormRow label="単価下限 (万円)">
                <input type="number" value={f.unit_price_min}
                  onChange={e => set('unit_price_min', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="単価上限 (万円)">
                <input type="number" value={f.unit_price_max}
                  onChange={e => set('unit_price_max', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="商流 (n次)">
                <select value={f.supply_chain}
                  onChange={e => set('supply_chain', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">不明</option>
                  <option value="1">1次</option>
                  <option value="2">2次</option>
                  <option value="3">3次</option>
                </select>
              </FormRow>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormRow label="開始時期">
                <input type="text" value={f.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  placeholder="即日 / 2026-06"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
              <FormRow label="契約形態">
                <select value={f.contract_type}
                  onChange={e => set('contract_type', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">未指定</option>
                  <option value="準委任">準委任</option>
                  <option value="派遣">派遣</option>
                  <option value="請負">請負</option>
                </select>
              </FormRow>
              <FormRow label="年齢制限">
                <input type="text" value={f.age_limit}
                  onChange={e => set('age_limit', e.target.value)}
                  placeholder="〜45歳"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
              </FormRow>
            </div>

            <FormRow label="メモ・備考 (本文に追記されます)">
              <textarea rows={3} value={f.body_text}
                onChange={e => set('body_text', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
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
  item: ProjectMail
  expanded: boolean
  expandedDetail: ProjectMail | null
  expandLoading: boolean
  appliedSearch: string
  onExpand: () => void
  onQuickStatus: (id: number, status: string) => void
}) {
  const rank = scoreRank(item.score)
  const skills = [...(item.required_skills ?? []), ...(item.preferred_skills ?? [])].slice(0, 4)

  return (
    <div className={`bg-white rounded-xl border transition-all ${expanded ? 'border-yellow-400 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* サマリー行: mobile は 2 段組 (上=タイトル系 / 下=アクション) で件名を広く確保 */}
      <div
        className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 px-3 md:px-4 py-3 cursor-pointer select-none"
        onClick={onExpand}
      >
        {/* スコアバッジ */}
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg w-14 md:w-16 text-center ${rank.cls}`}>
          {rank.label} {item.score}
        </span>

        {/* タイトル・スキル */}
        <div className="flex-1 min-w-0 order-2 md:order-none basis-full md:basis-auto">
          <p className="text-sm font-medium text-gray-800 truncate">
            {item.title || item.email?.subject || '(タイトル未抽出)'}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 truncate max-w-[160px]">
              {item.customer_name || item.email?.from_name || item.email?.from_address || '—'}
            </span>
            {skills.map((s, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5">{s}</span>
            ))}
          </div>
        </div>

        {/* 単価・場所 */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0 text-xs text-gray-500">
          {item.unit_price_min
            ? <span>💴 {item.unit_price_min}〜{item.unit_price_max ?? '?'}万</span>
            : <span className="text-gray-300">単価なし</span>
          }
          {item.work_location && <span>📍 {item.work_location}</span>}
        </div>

        {/* 受信(着信)日時 */}
        <span className="hidden md:block flex-shrink-0 text-xs text-gray-400 w-16 text-right"
          title={`受信(着信) ${formatDateFull(item.arrived_at ?? item.received_at)} / 送信 ${formatDateFull(item.received_at)}`}>
          {formatDateFull(item.arrived_at ?? item.received_at)}
        </span>

        {/* アクションボタン (mobile はタイトルの右、ラップ後は右上) */}
        <div className="flex gap-1.5 flex-shrink-0 ml-auto md:ml-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onQuickStatus(item.id, 'new')}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap">
            新着にする
          </button>
          <button
            onClick={() => onQuickStatus(item.id, 'excluded')}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 font-medium">
            非案件
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
                {expandedDetail.required_skills && expandedDetail.required_skills.length > 0 && (
                  <div><span className="text-gray-400">必須スキル</span><p className="font-medium text-gray-700">{expandedDetail.required_skills.join(', ')}</p></div>
                )}
                {expandedDetail.work_location && (
                  <div><span className="text-gray-400">勤務地</span><p className="font-medium text-gray-700">{expandedDetail.work_location}{expandedDetail.remote_ok ? ' (リモート可)' : ''}</p></div>
                )}
                {(expandedDetail.unit_price_min || expandedDetail.unit_price_max) && (
                  <div><span className="text-gray-400">単価</span><p className="font-medium text-gray-700">{expandedDetail.unit_price_min ?? '?'}〜{expandedDetail.unit_price_max ?? '?'}万</p></div>
                )}
                {expandedDetail.start_date && (
                  <div><span className="text-gray-400">開始</span><p className="font-medium text-gray-700">{expandedDetail.start_date}</p></div>
                )}
              </div>

              {/* 本文（キーワードハイライト） */}
              {expandedDetail.email?.body_text && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">メール本文</p>
                  <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
                    {highlightBody(
                      expandedDetail.email.body_text.slice(0, 1500),
                      [
                        ...(appliedSearch ? [appliedSearch] : []),
                        ...(expandedDetail.required_skills ?? []),
                        ...(expandedDetail.preferred_skills ?? []),
                      ].filter(Boolean)
                    )}
                    {expandedDetail.email.body_text.length > 1500 && <span className="text-gray-400">…（以下省略）</span>}
                  </div>
                </div>
              )}

              {/* 詳細・判断ボタン */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onQuickStatus(item.id, 'new')}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                  ✓ 新着にする
                </button>
                <button
                  onClick={() => onQuickStatus(item.id, 'excluded')}
                  className="text-sm bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
                  ✗ 非案件
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ドメイン補正理由チップの色分けと表示テキスト変換
function ScoreReasonChip({ reason }: { reason: string }) {
  if (reason.startsWith('domain:')) {
    // "domain:example.com:+20(85%/12件)"
    const parts = reason.replace('domain:', '').split(':')
    const domain = parts[0]
    const detail = parts[1] ?? ''
    const isPositive = detail.startsWith('+')
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
        isPositive
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-red-50 border-red-300 text-red-700'
      }`}>
        🏢 {domain} {detail}
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{reason}</span>
  )
}

function extractKeywordsFromReasons(reasons: string[]): string[] {
  return reasons
    .filter(r =>
      !r.startsWith('domain:') &&
      !r.startsWith('location:') &&  // 都市名は住所にも出るため除外（work_locationで代替）
      r !== 'excluded' &&
      r !== 'price_concrete'
    )
    .flatMap(r => {
      const colonIdx = r.indexOf(':')
      if (colonIdx < 0) return []
      const kw = r.slice(colonIdx + 1)
      return kw.length >= 2 ? [kw] : []
    })
}

function highlightBody(text: string, keywords: string[]): React.ReactNode {
  const kws = keywords.filter(k => k.length >= 2)
  if (!kws.length) return text

  // URL部分はハイライト対象外（cc.php → PHP 等の誤マッチを防ぐ）
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

  // 前後がアルファベット・数字・スラッシュ・ドットに隣接する場合はマッチしない
  // （例: .go.jp / go.php のような URL 断片・パスへの誤マッチを防ぐ）
  const kwPattern = new RegExp(
    `(?<![a-zA-Z0-9/.])(${kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-zA-Z0-9/.])`,
    'gi'
  )

  return segments.flatMap((seg, si) => {
    if (seg.isUrl) return [seg.text]
    const parts = seg.text.split(kwPattern)
    return parts.map((part, pi) =>
      kws.some(k => k.toLowerCase() === part.toLowerCase())
        ? <mark key={`${si}-${pi}`} style={{ background: '#fef08a', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
        : part
    )
  })
}

// ── ユーティリティ ────────────────────────────────────────

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
