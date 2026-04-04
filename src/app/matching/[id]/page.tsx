'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from '@/lib/axios'

// ── 型定義 ────────────────────────────────────────────────

type ProjectMail = {
  id: number
  title: string | null
  customer_name: string | null
  required_skills: string[] | null
  preferred_skills: string[] | null
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
  email?: { subject: string; from_name: string | null; from_address: string }
}

type Breakdown = {
  requirements: number
  skills: number
  conditions: number
  availability: number
  track_record: number
}

type MatchedEngineer = {
  engineer_id: number
  engineer_name: string
  affiliation: string | null
  affiliation_type: 'self' | 'bp' | null
  age: number | null
  score: number
  breakdown: Breakdown
  reasons: string[]
  availability_status: string | null
  available_from: string | null
  work_style: string | null
  desired_unit_price_min: number | null
  desired_unit_price_max: number | null
  skills: { name: string; experience_years: number }[]
}

type EngineerAction = 'proposed' | 'excluded' | null

// ── 定数 ─────────────────────────────────────────────────

const RANK_GROUPS = [
  { key: 'top',  label: '◎ 即提案', min: 85, max: 100, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', limit: 3 },
  { key: 'good', label: '○ 有力',   min: 70, max:  84, color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  limit: 5 },
  { key: 'ok',   label: '△ 検討',   min: 55, max:  69, color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',  limit: 99 },
]

const WORK_STYLE_LABEL: Record<string, string> = {
  remote: 'リモート',
  office: '出社',
  hybrid: 'ハイブリッド',
}

const AVAIL_LABEL: Record<string, string> = {
  available: '即日',
  scheduled: '稼働予定',
  working:   '稼働中',
}

const AVAIL_BADGE: Record<string, { label: string; cls: string }> = {
  available: { label: '稼働可',  cls: 'bg-green-100 text-green-700' },
  scheduled: { label: '稼働予定', cls: 'bg-yellow-100 text-yellow-700' },
  working:   { label: '稼働中',  cls: 'bg-blue-100 text-blue-700' },
}

const BAR_COLORS: Record<string, string> = {
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-400',
  gray:   'bg-gray-400',
}

// ── メインコンポーネント ────────────────────────────────

export default function MatchingPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [mail, setMail] = useState<ProjectMail | null>(null)
  const [engineers, setEngineers] = useState<MatchedEngineer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actions, setActions] = useState<Record<number, EngineerAction>>({})
  const [modal, setModal] = useState<MatchedEngineer | null>(null)
  const [collapsed, setCollapsed] = useState<string[]>(['ok'])
  const [proposedCount, setProposedCount] = useState(0)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [mailRes, matchRes] = await Promise.all([
          axios.get(`/api/v1/project-mails/${id}`),
          axios.get(`/api/v1/project-mails/${id}/matched-engineers`),
        ])
        setMail(mailRes.data ?? null)
        const data = matchRes.data?.data
        setEngineers(Array.isArray(data) ? data : [])
      } catch (e: unknown) {
        console.error('[matching] load error:', e)
        const status = (e as { response?: { status?: number } })?.response?.status
        setError(`データ取得に失敗しました (${status ?? 'error'})`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    setProposedCount(Object.values(actions).filter(a => a === 'proposed').length)
  }, [actions])

  const handleAction = (engId: number, action: EngineerAction) => {
    setActions(prev => ({ ...prev, [engId]: action }))
  }

  const handleDone = async () => {
    if (proposedCount > 0 && mail) {
      try {
        await axios.patch(`/api/v1/project-mails/${mail.id}/status`, { status: 'proposed' })
      } catch { /* ignore */ }
    }
    router.push('/project-mails')
  }

  const toggleCollapse = (key: string) => {
    setCollapsed(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const visibleEngineers = (min: number, max: number, limit: number) =>
    engineers
      .filter(e => e.score >= min && e.score <= max)
      .filter(e => actions[e.engineer_id] !== 'excluded')
      .slice(0, limit)

  // ── ローディング
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner size={32} />
          <p className="text-sm text-gray-500 mt-3">マッチング計算中...</p>
        </div>
      </div>
    )
  }

  // ── エラー
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">戻る</button>
      </div>
    )
  }

  // ── 案件なし
  if (!mail) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-gray-500 text-sm">案件が見つかりません</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 underline">戻る</button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50">

      {/* ── 案件サマリー（固定ヘッダー）── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
                  ← 戻る
                </button>
                <h1 className="text-sm font-semibold text-gray-900 truncate">
                  {mail.title || mail.email?.subject || '(タイトル未抽出)'}
                </h1>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {(mail.required_skills ?? []).slice(0, 5).map((s, i) => (
                  <span key={i} className="text-xs font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{s}</span>
                ))}
                {(mail.preferred_skills ?? []).slice(0, 3).map((s, i) => (
                  <span key={i} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{s}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-gray-600">
                {mail.unit_price_min != null && (
                  <span className="font-medium text-gray-800">{mail.unit_price_min}〜{mail.unit_price_max ?? '?'}万円</span>
                )}
                {mail.work_location && <span>{mail.work_location}</span>}
                {mail.remote_ok === true  && <span className="text-green-600">リモート可</span>}
                {mail.remote_ok === false && <span className="text-orange-600">出社必須</span>}
                {mail.start_date && <span>{mail.start_date}〜</span>}
                {mail.nationality_ok === false && <span className="text-red-600">外国籍不可</span>}
                {mail.age_limit && <span className="text-orange-600">{mail.age_limit}</span>}
                {mail.contract_type && <span>{mail.contract_type}</span>}
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <button
                onClick={handleDone}
                disabled={proposedCount === 0}
                className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                提案確定{proposedCount > 0 ? `（${proposedCount}名）` : ''}
              </button>
              {proposedCount === 0 && (
                <span className="text-xs text-gray-400">技術者を提案すると有効</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── マッチング結果 ── */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {engineers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-base">マッチする技術者が見つかりません</p>
            <p className="text-sm mt-1">技術者情報（スキル・稼働状況）を充実させると精度が上がります</p>
          </div>
        )}

        {RANK_GROUPS.map(group => {
          const list = visibleEngineers(group.min, group.max, group.limit)
          if (list.length === 0) return null
          const isCollapsed = collapsed.includes(group.key)

          return (
            <div key={group.key} className={`rounded-xl border ${group.border} overflow-hidden`}>
              <button
                onClick={() => toggleCollapse(group.key)}
                className={`w-full flex items-center justify-between px-4 py-3 ${group.bg} border-b ${group.border}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${group.color}`}>{group.label}</span>
                  <span className="text-xs text-gray-500">{list.length}名</span>
                </div>
                <span className="text-gray-400 text-xs">{isCollapsed ? '▼ 開く' : '▲ 閉じる'}</span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100 bg-white">
                  {list.map(eng => {
                    const acted = actions[eng.engineer_id]
                    return (
                      <div key={eng.engineer_id}
                        className={`p-4 ${acted === 'proposed' ? 'bg-green-50' : ''}`}>
                        <div className="flex items-start gap-3">

                          {/* スコア円 */}
                          <button
                            onClick={() => setModal(eng)}
                            title="スコア内訳"
                            className={`flex-shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center border-2 hover:opacity-80 ${
                              eng.score >= 85 ? 'bg-green-500 border-green-600 text-white' :
                              eng.score >= 70 ? 'bg-blue-500 border-blue-600 text-white' :
                              'bg-gray-300 border-gray-400 text-white'
                            }`}>
                            <span className="text-sm font-bold leading-none">{eng.score}</span>
                            <span className="text-xs opacity-75">点</span>
                          </button>

                          {/* 情報 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{eng.engineer_name}</span>
                              {eng.affiliation && <span className="text-xs text-gray-500">{eng.affiliation}</span>}
                              {eng.age != null && <span className="text-xs text-gray-400">{eng.age}歳</span>}
                              {eng.availability_status && AVAIL_BADGE[eng.availability_status] && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${AVAIL_BADGE[eng.availability_status].cls}`}>
                                  {AVAIL_BADGE[eng.availability_status].label}
                                </span>
                              )}
                              {acted === 'proposed' && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✔ 提案済</span>
                              )}
                            </div>

                            {/* スキル */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(eng.skills ?? []).slice(0, 5).map((s, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                  {s.name}{s.experience_years > 0 ? `${s.experience_years}年` : ''}
                                </span>
                              ))}
                              {(eng.skills ?? []).length > 5 && (
                                <span className="text-xs text-gray-400">+{eng.skills.length - 5}</span>
                              )}
                            </div>

                            {/* 条件 */}
                            <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-gray-500">
                              {eng.available_from && (
                                <span>
                                  {eng.availability_status ? (AVAIL_LABEL[eng.availability_status] ?? '') : ''}
                                  {' '}{eng.available_from}
                                </span>
                              )}
                              {eng.desired_unit_price_min != null && (
                                <span>希望{eng.desired_unit_price_min}〜{eng.desired_unit_price_max ?? '?'}万</span>
                              )}
                              {eng.work_style && (
                                <span>{WORK_STYLE_LABEL[eng.work_style] ?? eng.work_style}</span>
                              )}
                            </div>

                            {/* 理由 */}
                            {(eng.reasons ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {eng.reasons.map((r, i) => (
                                  <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{r}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 提案/除外 */}
                          <div className="flex-shrink-0 flex flex-col gap-2">
                            <button
                              onClick={() => handleAction(eng.engineer_id, acted === 'proposed' ? null : 'proposed')}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium w-16 ${
                                acted === 'proposed'
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                              }`}>
                              {acted === 'proposed' ? '✔提案' : '提案'}
                            </button>
                            <button
                              onClick={() => handleAction(eng.engineer_id, 'excluded')}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium w-16 bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200">
                              除外
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── スコア内訳モーダル ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{modal.engineer_name}</p>
                {modal.affiliation && <p className="text-xs text-gray-500 mt-0.5">{modal.affiliation}</p>}
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg ${
                modal.score >= 85 ? 'bg-green-500' : modal.score >= 70 ? 'bg-blue-500' : 'bg-gray-400'
              }`}>
                {modal.score}
              </div>
            </div>
            <div className="p-5 space-y-3">
              <ModalBar label="① 必須条件" score={modal.breakdown?.requirements ?? 0} max={40} color="green" />
              <ModalBar label="② スキル"   score={modal.breakdown?.skills       ?? 0} max={25} color="blue" />
              <ModalBar label="③ 条件"     score={modal.breakdown?.conditions   ?? 0} max={20} color="purple" />
              <ModalBar label="④ 稼働"     score={modal.breakdown?.availability ?? 0} max={10} color="orange" />
              <ModalBar label="⑤ 実績"     score={modal.breakdown?.track_record ?? 0} max={5}  color="gray" />
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">合計</span>
                <span className={`text-xl font-bold ${
                  modal.score >= 85 ? 'text-green-600' : modal.score >= 70 ? 'text-blue-600' : 'text-gray-600'
                }`}>{modal.score}点</span>
              </div>
              {(modal.reasons ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {modal.reasons.map((r, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{r}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 pb-4 flex justify-end">
              <button onClick={() => setModal(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100">
                閉じる
              </button>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin mx-auto">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ModalBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100)
  const barColor = BAR_COLORS[color] ?? 'bg-gray-400'
  const isLow = pct < 50
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${isLow ? 'text-orange-600' : 'text-gray-700'}`}>{label}</span>
        <span className={`text-xs font-bold ${isLow ? 'text-orange-600' : 'text-gray-800'}`}>{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
