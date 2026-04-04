'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'

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
  status: string
  email?: { subject: string; from_name: string | null; from_address: string }
}

type MatchedEngineer = {
  engineer_id: number
  engineer_name: string
  affiliation: string | null
  age: number | null
  score: number
  breakdown: { requirements: number; skills: number; conditions: number; availability: number; track_record: number }
  reasons: string[]
  availability_status: string | null
  available_from: string | null
  work_style: string | null
  desired_unit_price_min: number | null
  desired_unit_price_max: number | null
  skills: { name: string; experience_years: number }[]
}

const RANK_GROUPS = [
  { key: 'top',  label: '◎ 即提案', min: 85, max: 100, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', limit: 3 },
  { key: 'good', label: '○ 有力',   min: 70, max:  84, color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  limit: 5 },
  { key: 'ok',   label: '△ 検討',   min: 55, max:  69, color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',  limit: 99 },
]

const AVAIL_BADGE: Record<string, { label: string; cls: string }> = {
  available: { label: '稼働可',   cls: 'bg-green-100 text-green-700' },
  scheduled: { label: '稼働予定', cls: 'bg-yellow-100 text-yellow-700' },
  working:   { label: '稼働中',   cls: 'bg-blue-100 text-blue-700' },
}

const WORK_STYLE_LABEL: Record<string, string> = {
  remote: 'リモート', office: '出社', hybrid: 'ハイブリッド',
}

const BAR_COLOR: Record<string, string> = {
  green: 'bg-green-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
  orange: 'bg-orange-400', gray: 'bg-gray-400',
}

export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [mail, setMail]         = useState<ProjectMail | null>(null)
  const [engineers, setEngineers] = useState<MatchedEngineer[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [actions, setActions]   = useState<Record<number, 'proposed' | 'excluded' | null>>({})
  const [modal, setModal]       = useState<MatchedEngineer | null>(null)
  const [collapsed, setCollapsed] = useState<string[]>(['ok'])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    Promise.all([
      axios.get(`/api/v1/project-mails/${id}`),
      axios.get(`/api/v1/project-mails/${id}/matched-engineers`),
    ]).then(([mailRes, matchRes]) => {
      setMail(mailRes.data ?? null)
      setEngineers(Array.isArray(matchRes.data?.data) ? matchRes.data.data : [])
    }).catch((e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      setError(`取得失敗 (${status ?? 'error'})`)
    }).finally(() => {
      setLoading(false)
    })
  }, [id])

  const proposedCount = Object.values(actions).filter(a => a === 'proposed').length

  const handleDone = () => {
    if (proposedCount > 0 && mail) {
      axios.patch(`/api/v1/project-mails/${mail.id}/status`, { status: 'proposed' }).catch(() => {})
    }
    router.push('/project-mails')
  }

  const visible = (min: number, max: number, limit: number) =>
    engineers.filter(e => e.score >= min && e.score <= max && actions[e.engineer_id] !== 'excluded').slice(0, limit)

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const setAction = (id: number, action: 'proposed' | 'excluded' | null) =>
    setActions(prev => ({ ...prev, [id]: action }))

  if (loading) return (
    <div className="p-12 text-center text-sm text-gray-500">マッチング計算中...</div>
  )
  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 text-sm mb-3">{error}</p>
      <button onClick={() => router.back()} className="text-sm text-blue-600 underline">戻る</button>
    </div>
  )
  if (!mail) return (
    <div className="p-8 text-center">
      <p className="text-gray-500 text-sm mb-3">案件が見つかりません</p>
      <button onClick={() => router.back()} className="text-sm text-blue-600 underline">戻る</button>
    </div>
  )

  return (
    <div className="bg-gray-50 pb-8">

      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 mb-4">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600">← 戻る</button>
              <h1 className="text-sm font-semibold text-gray-900 truncate">
                {mail.title || mail.email?.subject || '(タイトル未抽出)'}
              </h1>
            </div>
            <div className="flex flex-wrap gap-1 mb-1">
              {(mail.required_skills ?? []).map((s, i) => (
                <span key={i} className="text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{s}</span>
              ))}
              {(mail.preferred_skills ?? []).map((s, i) => (
                <span key={i} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-gray-600">
              {mail.unit_price_min != null && <span className="font-medium">{mail.unit_price_min}〜{mail.unit_price_max ?? '?'}万円</span>}
              {mail.work_location && <span>{mail.work_location}</span>}
              {mail.remote_ok === true  && <span className="text-green-600">リモート可</span>}
              {mail.remote_ok === false && <span className="text-orange-600">出社必須</span>}
              {mail.start_date && <span>{mail.start_date}〜</span>}
              {mail.nationality_ok === false && <span className="text-red-600">外国籍不可</span>}
              {mail.age_limit && <span className="text-orange-600">{mail.age_limit}</span>}
            </div>
          </div>
          <button onClick={handleDone} disabled={proposedCount === 0}
            className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex-shrink-0">
            提案確定{proposedCount > 0 ? `（${proposedCount}名）` : ''}
          </button>
        </div>
      </div>

      {/* エンジニア一覧 */}
      <div className="max-w-3xl mx-auto px-4 space-y-4">

        {engineers.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">マッチする技術者が見つかりません</p>
        )}

        {RANK_GROUPS.map(g => {
          const list = visible(g.min, g.max, g.limit)
          if (list.length === 0) return null
          const isCollapsed = collapsed.includes(g.key)
          return (
            <div key={g.key} className={`rounded-xl border ${g.border} overflow-hidden`}>
              <button onClick={() => toggleCollapse(g.key)}
                className={`w-full flex items-center justify-between px-4 py-3 ${g.bg} border-b ${g.border}`}>
                <span className={`text-sm font-bold ${g.color}`}>
                  {g.label} <span className="text-xs text-gray-500 font-normal">{list.length}名</span>
                </span>
                <span className="text-xs text-gray-400">{isCollapsed ? '▼ 開く' : '▲ 閉じる'}</span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100 bg-white">
                  {list.map(eng => {
                    const acted = actions[eng.engineer_id]
                    const badge = eng.availability_status ? AVAIL_BADGE[eng.availability_status] : null
                    return (
                      <div key={eng.engineer_id} className={`p-4 ${acted === 'proposed' ? 'bg-green-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <button onClick={() => setModal(eng)}
                            className={`flex-shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center border-2 text-white hover:opacity-80 ${
                              eng.score >= 85 ? 'bg-green-500 border-green-600' :
                              eng.score >= 70 ? 'bg-blue-500 border-blue-600' :
                              'bg-gray-300 border-gray-400'
                            }`}>
                            <span className="text-sm font-bold leading-none">{eng.score}</span>
                            <span className="text-xs opacity-75">点</span>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{eng.engineer_name}</span>
                              {eng.affiliation && <span className="text-xs text-gray-500">{eng.affiliation}</span>}
                              {eng.age != null && <span className="text-xs text-gray-400">{eng.age}歳</span>}
                              {badge && <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
                              {acted === 'proposed' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✔ 提案済</span>}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(eng.skills ?? []).slice(0, 5).map((s, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                  {s.name}{s.experience_years > 0 ? `${s.experience_years}年` : ''}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-gray-500">
                              {eng.desired_unit_price_min != null && <span>希望{eng.desired_unit_price_min}〜{eng.desired_unit_price_max ?? '?'}万</span>}
                              {eng.work_style && <span>{WORK_STYLE_LABEL[eng.work_style] ?? eng.work_style}</span>}
                              {eng.available_from && <span>{eng.available_from}</span>}
                            </div>
                            {(eng.reasons ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {eng.reasons.map((r, i) => (
                                  <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{r}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex-shrink-0 flex flex-col gap-2">
                            <button onClick={() => setAction(eng.engineer_id, acted === 'proposed' ? null : 'proposed')}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium w-16 ${
                                acted === 'proposed'
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                              }`}>
                              {acted === 'proposed' ? '✔提案' : '提案'}
                            </button>
                            <button onClick={() => setAction(eng.engineer_id, 'excluded')}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium w-16 bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200">
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

      {/* スコア内訳モーダル */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 border-b px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{modal.engineer_name}</p>
                {modal.affiliation && <p className="text-xs text-gray-500">{modal.affiliation}</p>}
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${
                modal.score >= 85 ? 'bg-green-500' : modal.score >= 70 ? 'bg-blue-500' : 'bg-gray-400'
              }`}>
                {modal.score}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {([
                { label: '① 必須条件', val: modal.breakdown?.requirements ?? 0, max: 40, color: 'green' },
                { label: '② スキル',   val: modal.breakdown?.skills ?? 0,        max: 25, color: 'blue' },
                { label: '③ 条件',     val: modal.breakdown?.conditions ?? 0,    max: 20, color: 'purple' },
                { label: '④ 稼働',     val: modal.breakdown?.availability ?? 0,  max: 10, color: 'orange' },
                { label: '⑤ 実績',     val: modal.breakdown?.track_record ?? 0,  max:  5, color: 'gray' },
              ] as const).map(row => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-medium ${row.val / row.max < 0.5 ? 'text-orange-600' : 'text-gray-700'}`}>{row.label}</span>
                    <span className={`text-xs font-bold ${row.val / row.max < 0.5 ? 'text-orange-600' : 'text-gray-800'}`}>{row.val}/{row.max}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${BAR_COLOR[row.color]}`}
                      style={{ width: `${Math.round(row.val / row.max * 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">合計</span>
                <span className={`text-xl font-bold ${
                  modal.score >= 85 ? 'text-green-600' : modal.score >= 70 ? 'text-blue-600' : 'text-gray-600'
                }`}>{modal.score}点</span>
              </div>
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
