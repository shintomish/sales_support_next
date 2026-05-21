'use client'

import { useState } from 'react'
import {
  categoryLabel,
  isSkillCategory,
  judgmentMark,
  judgmentBg,
  judgmentColor,
  confidenceLabel,
  type Judgment,
} from '@/lib/requirementCategoryLabel'

export type Requirement = {
  type: 'must' | 'want' | string
  label: string
  condition: string
  category: string
}

export type Match = {
  label: string
  judgment: string
  evidence: string | null
  confidence?: string
  manual_override?: boolean
}

type Props = {
  requirements: Requirement[]
  matches: Match[]
  editable?: boolean
  /** 営業手動上書き保存ハンドラ。null なら read-only */
  onSave?: (matches: Match[]) => Promise<void> | void
  /** 編集中の保存待ち表示 */
  saving?: boolean
}

// docs/480 §15.3: スキル対照表 と 契約条件チェック の 2 グループ表示
export default function RequirementMatchTable({
  requirements,
  matches,
  editable = false,
  onSave,
  saving = false,
}: Props) {
  const [draft, setDraft] = useState<Match[]>(matches)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const reqByLabel = new Map(requirements.map(r => [r.label, r]))
  const skillItems = draft.filter(m => isSkillCategory(reqByLabel.get(m.label)?.category))
  const contractItems = draft.filter(m => !isSkillCategory(reqByLabel.get(m.label)?.category))

  const setJudgment = (label: string, j: Judgment) => {
    setDraft(prev => prev.map(m => m.label === label
      ? { ...m, judgment: j, manual_override: true }
      : m
    ))
    setDirty(true)
    setEditingLabel(null)
  }

  const handleSave = async () => {
    if (!onSave) return
    await onSave(draft)
    setDirty(false)
  }

  const handleReset = () => {
    setDraft(matches)
    setDirty(false)
    setEditingLabel(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {skillItems.length > 0 && (
        <Section
          title="スキル対照表"
          items={skillItems}
          requirements={reqByLabel}
          editable={editable}
          editingLabel={editingLabel}
          onStartEdit={setEditingLabel}
          onSetJudgment={setJudgment}
        />
      )}
      {contractItems.length > 0 && (
        <Section
          title="契約条件チェック"
          items={contractItems}
          requirements={reqByLabel}
          editable={editable}
          editingLabel={editingLabel}
          onStartEdit={setEditingLabel}
          onSetJudgment={setJudgment}
        />
      )}

      {editable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          {dirty && (
            <button
              onClick={handleReset}
              disabled={saving}
              style={btnSecondary}
            >
              元に戻す
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{ ...btnPrimary, opacity: !dirty || saving ? 0.5 : 1 }}
          >
            {saving ? '保存中...' : '上書きを保存'}
          </button>
        </div>
      )}
    </div>
  )
}

function Section({
  title, items, requirements, editable, editingLabel, onStartEdit, onSetJudgment,
}: {
  title: string
  items: Match[]
  requirements: Map<string, Requirement>
  editable: boolean
  editingLabel: string | null
  onStartEdit: (label: string | null) => void
  onSetJudgment: (label: string, j: Judgment) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{title}</div>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={th}>要件</th>
            <th style={{ ...th, width: 56, textAlign: 'center' }}>必須/尚可</th>
            <th style={{ ...th, width: 50, textAlign: 'center' }}>判定</th>
            <th style={th}>根拠</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const req = requirements.get(m.label)
            const mustWant = req?.type === 'must' ? '必須' : '尚可'
            const mustWantColor = req?.type === 'must' ? '#dc2626' : '#6b7280'
            return (
              <tr key={m.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', padding: '1px 6px', background: '#f3f4f6', borderRadius: 4 }}>
                      {categoryLabel(req?.category)}
                    </span>
                    <span>{m.label}</span>
                    {m.manual_override && (
                      <span title="営業手動上書き" style={{ fontSize: 10, color: '#0891b2', padding: '0 4px', background: '#cffafe', borderRadius: 3 }}>
                        手動
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...td, textAlign: 'center', color: mustWantColor, fontWeight: 600 }}>{mustWant}</td>
                <td style={{ ...td, textAlign: 'center', padding: 0 }}>
                  <JudgmentCell
                    judgment={m.judgment}
                    confidence={m.confidence}
                    editable={editable}
                    editing={editingLabel === m.label}
                    onStartEdit={() => onStartEdit(m.label)}
                    onCancelEdit={() => onStartEdit(null)}
                    onSelect={(j) => onSetJudgment(m.label, j)}
                  />
                </td>
                <td style={{ ...td, color: '#6b7280' }}>
                  {m.evidence ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function JudgmentCell({
  judgment, confidence, editable, editing, onStartEdit, onCancelEdit, onSelect,
}: {
  judgment: string
  confidence?: string
  editable: boolean
  editing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSelect: (j: Judgment) => void
}) {
  if (editing) {
    return (
      <div style={{ display: 'inline-flex', gap: 4, padding: '4px 8px' }} onMouseLeave={onCancelEdit}>
        {(['circle', 'triangle', 'cross', 'unknown'] as Judgment[]).map(j => (
          <button
            key={j}
            onClick={() => onSelect(j)}
            style={{
              width: 26, height: 26, borderRadius: 4, border: 'none',
              background: judgmentBg(j), color: judgmentColor(j), fontWeight: 700,
              cursor: 'pointer', fontSize: 14,
            }}
            title={j}
          >
            {judgmentMark(j)}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={editable ? onStartEdit : undefined}
      title={confidence ? `信頼度: ${confidenceLabel(confidence)}` : undefined}
      disabled={!editable}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 26, borderRadius: 4, border: 'none',
        background: judgmentBg(judgment), color: judgmentColor(judgment),
        fontWeight: 700, fontSize: 14,
        cursor: editable ? 'pointer' : 'default',
      }}
    >
      {judgmentMark(judgment)}
    </button>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  borderBottom: '1px solid #e5e7eb',
}
const td: React.CSSProperties = {
  padding: '6px 8px',
  verticalAlign: 'top',
}
const btnPrimary: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12,
  background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
}
