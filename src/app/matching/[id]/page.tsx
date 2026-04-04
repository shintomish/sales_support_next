'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'

// ── 型定義 ──────────────────────────────────────────
interface ProjectMail {
  id: number
  title: string | null
  customer_name: string | null
  required_skills: string[]
  preferred_skills: string[]
  work_location: string | null
  remote_ok: boolean | null
  unit_price_min: number | null
  unit_price_max: number | null
  start_date: string | null
  age_limit: string | null
  supply_chain: number | null
}

interface MatchedEngineer {
  engineer_id: number
  engineer_name: string
  affiliation: string | null
  affiliation_type: string | null
  age: number | null
  score: number
  breakdown: {
    requirements: number
    skills: number
    conditions: number
    availability: number
    track_record: number
  }
  reasons: string[]
  availability_status: string | null
  available_from: string | null
  work_style: string | null
  desired_unit_price_min: number | null
  desired_unit_price_max: number | null
  skills: { name: string; experience_years: number | null }[]
}

// ── ユーティリティ ────────────────────────────────────
function rankLabel(score: number): '◎' | '○' | '△' {
  if (score >= 80) return '◎'
  if (score >= 60) return '○'
  return '△'
}

function rankColor(score: number) {
  if (score >= 80) return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' }
  if (score >= 60) return { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8' }
  return { bg: '#fef9c3', border: '#ca8a04', text: '#854d0e' }
}

const AVAILABILITY_LABEL: Record<string, string> = {
  available:  '稼働可',
  scheduled:  '稼働予定',
  working:    '稼働中',
  unavailable:'稼働不可',
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function priceStr(min: number | null, max: number | null) {
  if (!min && !max) return null
  if (min && max) return `${min}〜${max}万`
  if (min) return `${min}万〜`
  return `〜${max}万`
}

// ── スコアバー ────────────────────────────────────────
function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span style={{ color: '#374151' }}>{label}</span>
        <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ── スコア内訳モーダル ────────────────────────────────
function BreakdownModal({ eng, onClose }: { eng: MatchedEngineer; onClose: () => void }) {
  const b = eng.breakdown
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{eng.engineer_name}</h3>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8' }}>{eng.score}点</span>
        </div>
        <ScoreBar label="必須条件 (国籍・年齢・稼働形態)" value={b.requirements} max={40} />
        <ScoreBar label="スキルマッチ" value={b.skills} max={25} />
        <ScoreBar label="条件一致 (単価・場所・契約)" value={b.conditions} max={20} />
        <ScoreBar label="稼働可否・時期" value={b.availability} max={10} />
        <ScoreBar label="実績" value={b.track_record} max={5} />
        {eng.reasons.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>評価コメント</p>
            {eng.reasons.map((r, i) => (
              <p key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>• {r}</p>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          style={{ marginTop: 16, width: '100%', padding: '8px 0', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

// ── 技術者カード ──────────────────────────────────────
function EngineerCard({
  eng,
  proposed,
  excluded,
  onPropose,
  onExclude,
  onDetail,
}: {
  eng: MatchedEngineer
  proposed: boolean
  excluded: boolean
  onPropose: () => void
  onExclude: () => void
  onDetail: () => void
}) {
  const color = rankColor(eng.score)
  const topSkills = eng.skills.slice(0, 5)

  return (
    <div style={{
      background: excluded ? '#f9fafb' : '#fff',
      borderRadius: 12,
      border: `1px solid ${excluded ? '#e5e7eb' : color.border}`,
      boxShadow: excluded ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
      opacity: excluded ? 0.55 : 1,
      transition: 'opacity 0.2s, box-shadow 0.2s',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* カードヘッダー: スコアバッジ + 名前 */}
      <div style={{ background: color.bg, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onDetail}
          title="スコア内訳を見る"
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: 10,
            border: `2px solid ${color.border}`,
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: color.text, lineHeight: 1 }}>{rankLabel(eng.score)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: color.text, lineHeight: 1.4 }}>{eng.score}</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {eng.engineer_name}
          </p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
            {eng.age ? `${eng.age}歳` : ''}
            {eng.age && eng.affiliation ? '　' : ''}
            {eng.affiliation ? (
              <>
                {eng.affiliation_type === 'partner' ? '協力/' : eng.affiliation_type === 'freelance' ? 'FL/' : ''}
                {eng.affiliation}
              </>
            ) : ''}
          </p>
        </div>
      </div>

      {/* カードボディ */}
      <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 稼働状況 */}
        {eng.availability_status && (
          <p style={{ fontSize: 12, margin: 0, color: eng.availability_status === 'available' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
            ● {AVAILABILITY_LABEL[eng.availability_status] ?? eng.availability_status}
            {eng.available_from ? <span style={{ fontWeight: 400, color: '#6b7280' }}> {formatDate(eng.available_from)}〜</span> : ''}
          </p>
        )}

        {/* 単価・勤務形態 */}
        {(priceStr(eng.desired_unit_price_min, eng.desired_unit_price_max) || eng.work_style) && (
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#6b7280' }}>
            {priceStr(eng.desired_unit_price_min, eng.desired_unit_price_max) && (
              <span>💴 {priceStr(eng.desired_unit_price_min, eng.desired_unit_price_max)}</span>
            )}
            {eng.work_style && <span>🏠 {eng.work_style}</span>}
          </div>
        )}

        {/* スキルタグ */}
        {topSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {topSkills.map((s, i) => (
              <span key={i} style={{
                fontSize: 10,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: 4,
                padding: '1px 5px',
              }}>
                {s.name}{s.experience_years ? ` ${s.experience_years}y` : ''}
              </span>
            ))}
            {eng.skills.length > 5 && (
              <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>+{eng.skills.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* カードフッター: ボタン */}
      <div style={{ display: 'flex', borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={onPropose}
          style={{
            flex: 1,
            padding: '8px 0',
            border: 'none',
            borderRight: '1px solid #f3f4f6',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: proposed ? '#16a34a' : '#fff',
            color: proposed ? '#fff' : '#16a34a',
            transition: 'all 0.15s',
            borderRadius: '0 0 0 12px',
          }}
        >
          {proposed ? '✓ 提案済み' : '提案する'}
        </button>
        <button
          onClick={onExclude}
          style={{
            flex: 1,
            padding: '8px 0',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: excluded ? '#6b7280' : '#fff',
            color: excluded ? '#fff' : '#9ca3af',
            transition: 'all 0.15s',
            borderRadius: '0 0 12px 0',
          }}
        >
          {excluded ? '除外済み' : '除外'}
        </button>
      </div>
    </div>
  )
}

// ── ランクグループ ────────────────────────────────────
function RankGroup({
  rank,
  engineers,
  proposed,
  excluded,
  onPropose,
  onExclude,
  onDetail,
}: {
  rank: '◎' | '○' | '△'
  engineers: MatchedEngineer[]
  proposed: Set<number>
  excluded: Set<number>
  onPropose: (id: number) => void
  onExclude: (id: number) => void
  onDetail: (eng: MatchedEngineer) => void
}) {
  const [open, setOpen] = useState(true)
  if (engineers.length === 0) return null

  const labelMap = { '◎': '最有力候補', '○': '候補', '△': '参考候補' }
  const colorMap = { '◎': '#16a34a', '○': '#2563eb', '△': '#d97706' }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 800, color: colorMap[rank] }}>{rank}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{labelMap[rank]}</span>
        <span
          style={{
            fontSize: 12,
            background: colorMap[rank],
            color: '#fff',
            borderRadius: 99,
            padding: '1px 8px',
          }}
        >
          {engineers.length}名
        </span>
        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {engineers.map(eng => (
            <EngineerCard
              key={eng.engineer_id}
              eng={eng}
              proposed={proposed.has(eng.engineer_id)}
              excluded={excluded.has(eng.engineer_id)}
              onPropose={() => onPropose(eng.engineer_id)}
              onExclude={() => onExclude(eng.engineer_id)}
              onDetail={() => onDetail(eng)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── メインページ ──────────────────────────────────────
export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mail, setMail] = useState<ProjectMail | null>(null)
  const [engineers, setEngineers] = useState<MatchedEngineer[]>([])
  const [proposed, setProposed] = useState<Set<number>>(new Set())
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [detailEng, setDetailEng] = useState<MatchedEngineer | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      axios.get(`/api/v1/project-mails/${id}`),
      axios.get(`/api/v1/project-mails/${id}/matched-engineers`),
    ]).then(([mailRes, matchRes]) => {
      setMail(mailRes.data)
      setEngineers(Array.isArray(matchRes.data?.data) ? matchRes.data.data : [])
    }).catch((e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      setError(`エラー ${status}`)
    }).finally(() => {
      setLoading(false)
    })
  }, [id])

  const togglePropose = (engId: number) => {
    setProposed(prev => {
      const next = new Set(prev)
      if (next.has(engId)) { next.delete(engId) } else { next.add(engId); setExcluded(ex => { const e2 = new Set(ex); e2.delete(engId); return e2 }) }
      return next
    })
  }

  const toggleExclude = (engId: number) => {
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(engId)) { next.delete(engId) } else { next.add(engId); setProposed(pr => { const p2 = new Set(pr); p2.delete(engId); return p2 }) }
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <p style={{ color: '#6b7280' }}>マッチング計算中...</p>
        </div>
      </div>
    )
  }

  if (error || !mail) {
    return (
      <div style={{ padding: 32, color: '#dc2626' }}>
        <p>{error ?? 'データを取得できませんでした'}</p>
        <button onClick={() => router.back()} style={{ marginTop: 12, color: '#2563eb' }}>← 戻る</button>
      </div>
    )
  }

  const s = '◎', o = '○', t = '△'
  const grouped = {
    [s]: engineers.filter(e => e.score >= 80),
    [o]: engineers.filter(e => e.score >= 60 && e.score < 80),
    [t]: engineers.filter(e => e.score < 60),
  }

  const proposedCount = proposed.size
  const visibleCount = engineers.filter(e => !excluded.has(e.engineer_id)).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* スコア内訳モーダル */}
      {detailEng && <BreakdownModal eng={detailEng} onClose={() => setDetailEng(null)} />}

      {/* 案件サマリーヘッダー */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#1e3a5f',
        color: '#fff',
        padding: '12px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}
          >
            ← 戻る
          </button>
          <h1 style={{ fontSize: 15, fontWeight: 700, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {mail.title ?? `案件 #${id}`}
          </h1>
          <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 10px', flexShrink: 0 }}>
            候補 {visibleCount}名
            {proposedCount > 0 && <span style={{ marginLeft: 6, color: '#86efac' }}>提案 {proposedCount}名</span>}
          </span>
        </div>

        {/* サマリー情報チップ */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mail.customer_name && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 8px' }}>
              🏢 {mail.customer_name}
            </span>
          )}
          {mail.required_skills.slice(0, 5).map((s, i) => (
            <span key={i} style={{ fontSize: 11, background: '#1d4ed8', borderRadius: 4, padding: '2px 8px' }}>
              {s}
            </span>
          ))}
          {mail.work_location && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 8px' }}>
              📍 {mail.work_location}
              {mail.remote_ok && ' (リモート可)'}
            </span>
          )}
          {priceStr(mail.unit_price_min, mail.unit_price_max) && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 8px' }}>
              💴 {priceStr(mail.unit_price_min, mail.unit_price_max)}
            </span>
          )}
          {mail.start_date && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 8px' }}>
              📅 {mail.start_date}〜
            </span>
          )}
          {mail.age_limit && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 8px' }}>
              👤 {mail.age_limit}
            </span>
          )}
        </div>
      </div>

      {/* 技術者リスト */}
      <div style={{ padding: '20px 20px 40px' }}>
        {engineers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🤔</p>
            <p>マッチする技術者が見つかりませんでした</p>
          </div>
        ) : (
          <>
            {(['◎', '○', '△'] as const).map(rank => (
              <RankGroup
                key={rank}
                rank={rank}
                engineers={grouped[rank]}
                proposed={proposed}
                excluded={excluded}
                onPropose={togglePropose}
                onExclude={toggleExclude}
                onDetail={setDetailEng}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
