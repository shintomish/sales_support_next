'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from '@/lib/axios'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

// ── 型定義 ─────────────────────────────────────────────────

type Email = {
  id: number
  subject: string
  from_name: string | null
  from_address: string
  body_text: string | null
  body_html: string | null
  received_at: string
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
  email?: Email
}

type Paginated = {
  data: ProjectMail[]
  current_page: number
  last_page: number
  total: number
}

// ── 定数 ─────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'review', label: '要確認', color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  { value: 'new',    label: '新着案件', color: 'text-blue-700 bg-blue-50 border-blue-300' },
  { value: 'proposed',  label: '提案済', color: 'text-purple-700 bg-purple-50 border-purple-300' },
  { value: 'interview', label: '面談',   color: 'text-indigo-700 bg-indigo-50 border-indigo-300' },
  { value: 'won',       label: '成約',   color: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'lost',      label: '失注',   color: 'text-red-700 bg-red-50 border-red-300' },
  { value: 'excluded',  label: '除外',   color: 'text-gray-500 bg-gray-50 border-gray-300' },
]

const STATUS_NEXT: Record<string, { label: string; value: string; cls: string }[]> = {
  review:   [
    { label: '案件確定', value: 'new',      cls: 'bg-blue-600 text-white hover:bg-blue-700' },
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
  { value: 'all', label: '全て',    scoreMin: 0,  scoreMax: 100 },
  { value: 'high', label: '高 60+', scoreMin: 60, scoreMax: 100 },
  { value: 'mid',  label: '中 40-', scoreMin: 40, scoreMax: 59  },
  { value: 'low',  label: '低 ～39',scoreMin: 0,  scoreMax: 39  },
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
  const [items, setItems] = useState<Paginated | null>(null)
  const [selected, setSelected] = useState<ProjectMail | null>(null)
  const [statusFilter, setStatusFilter] = useState('review')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [scoring, setScoring] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [scoreMsg, setScoreMsg] = useState('')

  // 編集フォーム state
  const [form, setForm] = useState<Partial<ProjectMail>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showBody, setShowBody] = useState(false)

  const fetchList = useCallback(async () => {
    const sf = SCORE_FILTERS.find(f => f.value === scoreFilter) ?? SCORE_FILTERS[0]
    const res = await axios.get('/api/v1/project-mails', {
      params: {
        status:    statusFilter,
        search:    search || undefined,
        page,
        per_page:  30,
        score_min: sf.scoreMin,
        score_max: sf.scoreMax,
      }
    })
    setItems(res.data)
  }, [statusFilter, scoreFilter, search, page])

  useEffect(() => { fetchList() }, [fetchList])

  // 選択時に詳細取得
  const handleSelect = async (item: ProjectMail) => {
    const res = await axios.get(`/api/v1/project-mails/${item.id}`)
    setSelected(res.data)
    setForm(res.data)
    setSaveMsg(null)
    setShowBody(false)
  }

  // 一括スコアリング（新着未処理のみ）
  const handleScoreAll = async () => {
    setScoring(true); setScoreMsg('')
    try {
      const res = await axios.post('/api/v1/project-mails/score-all')
      setScoreMsg(res.data.message)
      fetchList()
    } catch { setScoreMsg('スコアリングに失敗しました') }
    finally { setScoring(false) }
  }

  // 既存レコードを全件再スコアリング
  const handleRescoreAll = async () => {
    if (!confirm('全件を再スコアリングします。ステータスが自動変更されますがよろしいですか？')) return
    setRescoring(true); setScoreMsg('')
    try {
      const res = await axios.post('/api/v1/project-mails/rescore-all')
      setScoreMsg(res.data.message)
      fetchList()
      if (selected) {
        const refreshed = await axios.get(`/api/v1/project-mails/${selected.id}`)
        setSelected(refreshed.data)
        setForm(refreshed.data)
      }
    } catch { setScoreMsg('再スコアリングに失敗しました') }
    finally { setRescoring(false) }
  }

  // 既存レコードの抽出情報を一括更新
  const handleReextractAll = async () => {
    setExtracting(true); setScoreMsg('')
    try {
      const res = await axios.post('/api/v1/project-mails/reextract-all')
      setScoreMsg(res.data.message)
      fetchList()
      if (selected) {
        const refreshed = await axios.get(`/api/v1/project-mails/${selected.id}`)
        setSelected(refreshed.data)
        setForm(refreshed.data)
      }
    } catch { setScoreMsg('抽出情報の更新に失敗しました') }
    finally { setExtracting(false) }
  }

  // 再スコアリング
  const handleRescore = async () => {
    if (!selected) return
    try {
      const res = await axios.post(`/api/v1/project-mails/${selected.id}/rescore`)
      setSelected(res.data)
      setForm(res.data)
      fetchList()
    } catch { setSaveMsg({ type: 'err', text: '再スコアリングに失敗しました' }) }
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

  const set = (key: keyof ProjectMail, val: unknown) => setForm(f => ({ ...f, [key]: val }))
  const arrToStr = (v: string[] | null | undefined) => (v ?? []).join(', ')

  return (
    <div className="flex h-screen bg-gray-50">

      {/* 左ペイン */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">案件メール</h1>
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
              <button onClick={handleReextractAll} disabled={extracting}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-md hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
                {extracting && <Spinner size={11} />}
                {extracting ? '抽出中...' : '情報抽出'}
              </button>
            </div>
          </div>
          {scoreMsg && <p className="text-xs text-green-600">{scoreMsg}</p>}

          <input type="text" placeholder="件名・顧客名・勤務地で検索"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />

          {/* ステータスタブ */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1) }}
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
                    ? 'bg-indigo-600 text-white border-indigo-600'
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
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                    {formatReceivedAt(item.received_at)}
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

      {/* 右ペイン */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 max-w-3xl mx-auto space-y-5">

            {/* スコアヘッダー */}
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
                {/* 判定理由 */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {(selected.score_reasons ?? []).map((r, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{r}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => router.push(`/emails?email_id=${selected.email_id}`)}
                  className="text-xs border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                  メール詳細 →
                </button>
                <button onClick={handleRescore}
                  className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  再スコアリング
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
                <div className="grid grid-cols-2 gap-4">
                  <FormRow label="顧客会社名">
                    <input value={form.customer_name ?? ''} onChange={e => set('customer_name', e.target.value)}
                      className="form-input" placeholder="株式会社〇〇" />
                  </FormRow>
                  <FormRow label="案件タイトル">
                    <input value={form.title ?? ''} onChange={e => set('title', e.target.value)}
                      className="form-input" placeholder="Javaバックエンド開発" />
                  </FormRow>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                  {selected.email?.body_html ? (
                    <div className="prose prose-sm max-w-none text-gray-800 text-sm"
                      dangerouslySetInnerHTML={{ __html: selected.email.body_html }} />
                  ) : (
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                      {selected.email?.body_text || '(本文なし)'}
                    </pre>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">案件メールを選択してください</p>
          </div>
        )}
      </div>
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
