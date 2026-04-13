'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from '@/lib/axios'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

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

// ── 定数 ─────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'review',     label: '要確認',  color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  { value: 'new',        label: '新着',    color: 'text-teal-700 bg-teal-50 border-teal-300' },
  { value: 'registered', label: '登録済',  color: 'text-blue-700 bg-blue-50 border-blue-300' },
  { value: 'proposing',  label: '提案中',  color: 'text-purple-700 bg-purple-50 border-purple-300' },
  { value: 'working',    label: '稼働中',  color: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'excluded',   label: '除外',    color: 'text-gray-500 bg-gray-50 border-gray-300' },
]

const STATUS_NEXT: Record<string, { label: string; value: string; cls: string }[]> = {
  review:     [
    { label: '技術者確定', value: 'new',      cls: 'bg-teal-600 text-white hover:bg-teal-700' },
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

function scoreRank(score: number) {
  if (score >= 85) return { label: '◎', cls: 'bg-emerald-500 text-white' }
  if (score >= 70) return { label: '○', cls: 'bg-teal-500 text-white' }
  if (score >= 55) return { label: '△', cls: 'bg-yellow-400 text-gray-800' }
  return { label: '×', cls: 'bg-gray-400 text-white' }
}

// ── メインコンポーネント ──────────────────────────────────

export default function EngineerMailsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Paginated | null>(null)
  const [selected, setSelected] = useState<EngineerMail | null>(null)
  const [statusFilter, setStatusFilter] = useState('review')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [scoring, setScoring] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [scoreMsg, setScoreMsg] = useState('')

  // 編集フォーム state
  const [form, setForm] = useState<Partial<EngineerMail>>({})
  const [skillInput, setSkillInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showBody, setShowBody] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedItem, setExpandedItem] = useState<EngineerMail | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)

  // マッチ案件・提案送信
  const [matchedProjects, setMatchedProjects] = useState<MatchedProject[]>([])
  const [matchLoading, setMatchLoading] = useState(false)
  const [proposalModal, setProposalModal] = useState<ProposalModal | null>(null)
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)

  useEffect(() => {
    axios.get('/api/v1/email-body-templates/me').then(res => {
      if (res.data) setEmailTemplate(res.data)
    }).catch(() => {})
  }, [])

  const fetchList = useCallback(async () => {
    const res = await axios.get('/api/v1/engineer-mails', {
      params: {
        status:   statusFilter,
        search:   search || undefined,
        page,
        per_page: 30,
      }
    })
    setItems(res.data)
  }, [statusFilter, search, page])

  useEffect(() => { fetchList() }, [fetchList])

  // 選択時に詳細取得
  const handleSelect = async (item: EngineerMail) => {
    const res = await axios.get(`/api/v1/engineer-mails/${item.id}`)
    setSelected(res.data)
    setForm(res.data)
    setSkillInput('')
    setSaveMsg(null)
    setShowBody(false)
    setMatchedProjects([])
    setProposalModal(null)
    // マッチ案件を非同期取得
    setMatchLoading(true)
    try {
      const mres = await axios.get(`/api/v1/engineer-mails/${item.id}/matched-projects`)
      setMatchedProjects(mres.data.data ?? [])
    } catch { /* silent */ } finally {
      setMatchLoading(false)
    }
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
    } catch {
      setProposalModal(m => m ? { ...m, generating: false, error: '文章生成に失敗しました' } : m)
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
      formData.append('project_id', String(proposalModal.project.project_id))
      formData.append('to',         proposalModal.to)
      formData.append('subject',    proposalModal.subject)
      formData.append('body',       proposalModal.body)
      proposalModal.attachments.forEach(f => formData.append('attachments[]', f))
      await axios.post(`/api/v1/engineer-mails/${selected.id}/send-proposal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProposalModal(m => m ? { ...m, sending: false, sent: true } : m)
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

  // 一括スコアリング
  const handleScoreAll = async () => {
    setScoring(true); setScoreMsg('')
    try {
      let total = 0
      while (true) {
        const res = await axios.post('/api/v1/engineer-mails/score-all')
        total += res.data.count ?? 0
        const remaining = res.data.remaining ?? 0
        // バッチごとにUIを更新するためにmicrotaskを挟む
        await new Promise(resolve => setTimeout(resolve, 0))
        setScoreMsg(`処理済: ${total}件 / 残り: ${remaining}件`)
        if (remaining === 0 || res.data.count === 0) break
      }
      await new Promise(resolve => setTimeout(resolve, 0))
      setScoreMsg(`完了: ${total}件をスコアリングしました`)
      fetchList()
    } catch { setScoreMsg('スコアリングに失敗しました') }
    finally { setScoring(false) }
  }

  // 全件再スコアリング
  const handleRescoreAll = async () => {
    if (!confirm('全件を再スコアリングします。よろしいですか？')) return
    setRescoring(true); setScoreMsg('')
    try {
      const res = await axios.post('/api/v1/engineer-mails/rescore-all')
      setScoreMsg(res.data.message)
      fetchList()
      if (selected) {
        const refreshed = await axios.get(`/api/v1/engineer-mails/${selected.id}`)
        setSelected(refreshed.data)
        setForm(refreshed.data)
      }
    } catch { setScoreMsg('再スコアリングに失敗しました') }
    finally { setRescoring(false) }
  }

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
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900">要確認技術者メール</h1>
              {items && (
                <span className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-300 px-2.5 py-0.5 rounded-full font-medium">
                  {items.total}件
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button onClick={handleScoreAll} disabled={scoring}
                className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50">
                {scoring ? '処理中...' : '新着取込'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map(tab => (
                <button key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setPage(1); setExpandedId(null); setSelected(null) }}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    statusFilter === tab.value ? tab.color + ' font-semibold' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <input type="text" placeholder="検索"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 w-48" />
          </div>
          <ProcessingBar
            active={scoring || rescoring}
            label={scoring ? (scoreMsg || '新着取込中...') : rescoring ? '全件再スコア中...' : undefined}
          />
          {!scoring && scoreMsg && <p className="text-xs text-green-600 mt-2">{scoreMsg}</p>}
        </div>

        {/* リスト */}
        <div className="max-w-4xl mx-auto px-6 py-4 space-y-2">
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
      </div>
    )
  }

  // ── 通常モード（左右2ペイン） ─────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50">

      {/* 左ペイン */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">技術者メール</h1>
            <div className="flex gap-1.5">
              <button onClick={handleScoreAll} disabled={scoring}
                className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50">
                {scoring ? '処理中...' : '新着取込'}
              </button>
              <button onClick={handleRescoreAll} disabled={rescoring}
                className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-md hover:bg-orange-100 disabled:opacity-50 flex items-center gap-1.5">
                {rescoring && <Spinner size={11} />}
                {rescoring ? '再スコア中...' : '全件再スコア'}
              </button>
            </div>
          </div>
          {!scoring && scoreMsg && <p className="text-xs text-green-600">{scoreMsg}</p>}

          <input type="text" placeholder="氏名・スキル・最寄り駅で検索"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500" />

          <ProcessingBar
            active={scoring || rescoring}
            label={scoring ? (scoreMsg || '新着取込中...') : rescoring ? '全件再スコア中...' : undefined}
          />

          {/* ステータスタブ */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1); setSelected(null) }}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  statusFilter === tab.value
                    ? tab.color + ' font-semibold'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}>
                {tab.label}
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
                    {formatReceivedAt(item.received_at)}
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

      {/* 右ペイン */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 max-w-3xl mx-auto space-y-5">

            {/* ヘッダー */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {(() => { const r = scoreRank(selected.score); return (
                    <span className={`text-lg font-bold px-3 py-1 rounded-lg ${r.cls}`}>
                      {r.label} {selected.score}点
                    </span>
                  )})()}
                  <span className="text-sm text-gray-500">
                    {selected.email?.from_name || selected.email?.from_address}
                  </span>
                  <span className="text-xs text-gray-400">{formatReceivedAt(selected.received_at)}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(selected.score_reasons ?? []).map((r, i) => (
                    <ScoreReasonChip key={i} reason={r} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleRegister}
                  className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-medium">
                  技術者として登録 →
                </button>
                <button
                  onClick={() => router.push(`/emails?email_id=${selected.email_id}`)}
                  className="text-xs border border-teal-300 text-teal-600 px-3 py-1.5 rounded-lg hover:bg-teal-50">
                  メール詳細 →
                </button>
              </div>
            </div>

            {/* ステータス操作 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">ステータス:</span>
              {STATUS_TABS.find(t => t.value === selected.status) && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_TABS.find(t => t.value === selected.status)!.color}`}>
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <FormRow label="稼働開始日">
                    <input value={form.available_from ?? ''} onChange={e => set('available_from', e.target.value || null)}
                      className="form-input" placeholder="即日 / 2026-06-01" />
                  </FormRow>
                  <FormRow label="最寄り駅">
                    <input value={form.nearest_station ?? ''} onChange={e => set('nearest_station', e.target.value || null)}
                      className="form-input" placeholder="渋谷駅" />
                  </FormRow>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-700">マッチ案件</span>
                  {(selected.unit_price_min || selected.unit_price_max) && (
                    <span className="ml-2 text-xs text-blue-600 font-medium">
                      技術者希望: {selected.unit_price_min ? Math.round(selected.unit_price_min) : '?'}〜{selected.unit_price_max ? Math.round(selected.unit_price_max) : '?'}万円
                    </span>
                  )}
                </div>
                {matchLoading && <span className="text-xs text-gray-400 animate-pulse">取得中...</span>}
              </div>
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
                        selected.skills ?? []
                      )}
                    </pre>
                  ) : selected.email?.body_html ? (
                    <div className="prose prose-sm max-w-none text-gray-800 text-sm"
                      dangerouslySetInnerHTML={{ __html: selected.email.body_html }} />
                  ) : (
                    <p className="text-sm text-gray-400">(本文なし)</p>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">技術者メールを選択してください</p>
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
                  <button onClick={() => setProposalModal(null)} className="mt-4 text-sm text-teal-600 hover:underline">閉じる</button>
                </div>
              ) : (
                <>
                  {proposalModal.error && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{proposalModal.error}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">添付ファイル</label>
                    <input
                      type="file"
                      multiple
                      onChange={e => setProposalModal(m => m ? { ...m, attachments: Array.from(e.target.files ?? []) } : m)}
                      className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                    />
                    {proposalModal.attachments.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{proposalModal.attachments.length}件選択中: {proposalModal.attachments.map(f => f.name).join(', ')}</p>
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

// ── 要確認行コンポーネント ────────────────────────────────
function ReviewRow({
  item,
  expanded,
  expandedDetail,
  expandLoading,
  onExpand,
  onQuickStatus,
}: {
  item: EngineerMail
  expanded: boolean
  expandedDetail: EngineerMail | null
  expandLoading: boolean
  onExpand: () => void
  onQuickStatus: (id: number, status: string) => void
}) {
  const rank = scoreRank(item.score)
  const skills = (item.skills ?? []).slice(0, 6)
  const extraSkills = Math.max(0, (item.skills ?? []).length - 6)

  return (
    <div className={`bg-white rounded-xl border transition-all ${expanded ? 'border-yellow-400 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* サマリー行 */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={onExpand}>
        {/* スコアバッジ */}
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg w-16 text-center ${rank.cls}`}>
          {rank.label} {item.score}
        </span>

        {/* 名前・スキル */}
        <div className="flex-1 min-w-0">
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
          {formatReceivedAt(item.received_at)}
        </span>

        {/* アクションボタン */}
        <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onQuickStatus(item.id, 'new')}
            className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 font-medium whitespace-nowrap">
            技術者確定
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
                      {highlightBody(body, expandedDetail.skills ?? [])}
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
                  ✓ 技術者確定
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

function formatReceivedAt(raw: string): string {
  try {
    if (!raw) return '—'
    const s = raw.endsWith('Z') ? raw : raw.includes('T') ? raw + 'Z' : raw.replace(' ', 'T') + 'Z'
    const d = new Date(s)
    if (isNaN(d.getTime())) return '—'
    return formatDistanceToNow(d, { locale: ja, addSuffix: true })
  } catch { return '—' }
}
