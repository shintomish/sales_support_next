'use client'

import { useState } from 'react'
import axios from '@/lib/axios'
import RequirementMatchTable, { type Match, type Requirement } from './RequirementMatchTable'

type ApiResponse = {
  id: number
  requirements_json: Requirement[]
  matches_json: Match[]
  cache_read_tokens?: number
  cache_write_tokens?: number
}

type Props = {
  projectMailId: number
  /** EMS または Engineer のどちらか一方を指定 */
  emsId?: number
  engineerId?: number
  /** ボタン横に表示するラベル (例: "対照表") */
  label?: string
  /** デフォルト閉じた状態 */
  initialOpen?: boolean
  /** 一括生成等で DB に対照表が用意済の場合 true → ボタンを緑色で強調 */
  prefetched?: boolean
  /** 対照表結果の通知 (必須要件×が含まれるかを親で除外判定に使う) */
  onResult?: (result: { hasMustCross: boolean; mustCrossLabels: string[] }) => void
}

function detectMustCross(requirements: Requirement[], matches: Match[]): { hasMustCross: boolean; mustCrossLabels: string[] } {
  const mustLabels = new Set(requirements.filter(r => r.type === 'must').map(r => r.label))
  const mustCrossLabels = matches.filter(m => m.judgment === 'cross' && mustLabels.has(m.label)).map(m => m.label)
  return { hasMustCross: mustCrossLabels.length > 0, mustCrossLabels }
}

// docs/480 §6.1 案件側マッチング画面に組み込む対照表アコーディオン。
// 「対照表」ボタンクリックで GET /v1/project-mails/{id}/requirement-match を呼び、
// 結果を RequirementMatchTable で表示。ボタン押下時のみ Claude API が走る (コスト制御)。
export default function RequirementMatchAccordion({
  projectMailId, emsId, engineerId, label = '対照表', initialOpen = false, prefetched = false, onResult,
}: Props) {
  const [open, setOpen] = useState(initialOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchMatch = async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (emsId != null) params.set('ems_id', String(emsId))
      if (engineerId != null) params.set('engineer_id', String(engineerId))

      const url = force
        ? `/api/v1/project-mails/${projectMailId}/requirement-match/regenerate`
        : `/api/v1/project-mails/${projectMailId}/requirement-match?${params.toString()}`
      const res = force
        ? await axios.post(url, Object.fromEntries(params))
        : await axios.get(url)
      setData(res.data)
      onResult?.(detectMustCross(res.data.requirements_json, res.data.matches_json))
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } }
      if (err.response?.status === 403) {
        setError('要件マッチング機能はこのテナントで無効です')
      } else {
        setError(err.response?.data?.message ?? '対照表の取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (!data) await fetchMatch(false)
  }

  const handleRegenerate = async () => {
    if (!confirm('Claude を再呼出して対照表を再生成します (営業の手動上書きは消えます)。よろしいですか?')) return
    await fetchMatch(true)
  }

  const handleSave = async (next: Match[]) => {
    if (!data) return
    setSaving(true)
    try {
      await axios.patch(`/api/v1/requirement-match-results/${data.id}`, {
        matches: next.map(m => ({
          label: m.label,
          judgment: m.judgment,
          evidence: m.evidence,
          confidence: m.confidence,
        })),
      })
      const nextMatches = next.map(m => ({ ...m, manual_override: true }))
      setData(prev => prev ? { ...prev, matches_json: nextMatches } : prev)
      if (data) onResult?.(detectMustCross(data.requirements_json, nextMatches))
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        style={{
          fontSize: 11, padding: '4px 10px', borderRadius: 6,
          border: `1px solid ${loading ? '#2563eb' : (prefetched ? '#16a34a' : '#d1d5db')}`,
          background: loading ? '#dbeafe' : (open ? '#dbeafe' : (prefetched ? '#dcfce7' : '#fff')),
          color: loading ? '#1d4ed8' : (prefetched ? '#15803d' : '#2563eb'),
          cursor: loading ? 'wait' : 'pointer', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
        title={loading ? 'Claude API で対照表生成中…' : (prefetched ? '対照表生成済 (クリックで展開)' : '案件要件と技術者スキルの ◯/△/× 対照表')}
      >
        {loading ? (
          <>
            <span className="rm-spinner" style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              border: '2px solid #93c5fd', borderTopColor: '#1d4ed8',
              animation: 'rm-spin 0.7s linear infinite',
            }} />
            生成中…
          </>
        ) : (
          <>{open ? '▼ ' : '▶ '} {label}{prefetched && ' ✓'}</>
        )}
        <style>{`
          @keyframes rm-spin { to { transform: rotate(360deg); } }
        `}</style>
      </button>

      {open && (
        <div style={{ marginTop: 8, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {loading && (
            <div style={{ fontSize: 12, color: '#1d4ed8', padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                border: '2px solid #93c5fd', borderTopColor: '#1d4ed8',
                animation: 'rm-spin 0.7s linear infinite',
              }} />
              対照表を生成中… (Claude API、最大2分程度)
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', padding: 12, background: '#fee2e2', borderRadius: 6 }}>
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  ※ AI 自動判定 (参考情報)。最終判断は営業側で
                  {data.cache_read_tokens && data.cache_read_tokens > 0 && (
                    <span style={{ marginLeft: 8, color: '#16a34a' }}>(キャッシュ利用)</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
                  title="Claude を再呼出して対照表を再生成 (営業上書きは消失)"
                >
                  🔄 再生成
                </button>
              </div>
              <RequirementMatchTable
                requirements={data.requirements_json}
                matches={data.matches_json}
                editable={true}
                onSave={handleSave}
                saving={saving}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
