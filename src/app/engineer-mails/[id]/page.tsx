'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'
import OriginalMailAccordion from '@/components/OriginalMailAccordion'
import RequirementMatchAccordion from '@/components/RequirementMatchAccordion'
import { pickMailBody, buildEmailBody, extractRecipientName, type EmailBodyTemplate } from '@/lib/mailBody'
import { isSameDomain, extractDomain } from '@/lib/mailDomain'
import { formatMatchTableMarkdown, insertMatchTableIntoBody, removeMatchTableFromBody } from '@/lib/requirementCategoryLabel'
import { mapLimit } from '@/lib/mapLimit'
import { useAuthStore } from '@/store/authStore'

// ── 型定義 ──────────────────────────────────────────
interface EmailAttachment {
  id: number
  filename: string
  mime_type: string | null
  size: number | null
}

interface EngineerMail {
  id: number
  email_id: number
  name: string | null
  age: number | null
  affiliation: string | null
  affiliation_type: string | null
  unit_price_min: number | null
  unit_price_max: number | null
  available_from: string | null
  nearest_station: string | null
  skills: string[] | null
  email: { from_address: string | null; from_name: string | null; body_text: string | null; body_html: string | null; attachments?: EmailAttachment[] } | null
}

function formatBytes(b: number | null | undefined): string {
  if (!b) return '—'
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)}KB`
  return `${(b / 1024 / 1024).toFixed(1)}MB`
}

async function downloadEngineerAttachment(engineerMailId: number, att: EmailAttachment) {
  try {
    const res = await axios.get(
      `/api/v1/engineer-mails/${engineerMailId}/attachment/${att.id}`,
      { responseType: 'blob' }
    )
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = att.filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert(`ダウンロードに失敗しました: ${att.filename}`)
  }
}

interface MatchedProject {
  project_id: number
  project_title: string | null
  status: string | null
  work_style: string | null
  nearest_station: string | null
  unit_price_min: number | null
  unit_price_max: number | null
  match_score: number
  matched_count: number
  total_skills: number
  required_skills: { name: string | null; is_required: boolean; matched: boolean }[]
  to_email: string
  sales_contact: string
  // 元 PMS (個別提案モーダル ▼元メール本文 用)
  pms_id: number | null
  pms_email_subject: string | null
  pms_email_from_address: string | null
  pms_email_body: string | null
}

// 鮮度マッチング: 過去N日のPMS候補
interface FreshPms {
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
  arrived_at: string | null
  email_from_address: string | null
  email_subject: string | null
  email_body: string | null
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

interface ProposalDraft {
  subject: string
  body: string
  to_address: string
  to_name: string
  project_id?: number
  // 鮮度マッチング(PMS起点) の場合
  project_mail_id?: number
  // ▼アコーディオン表示用
  original_mail_body?: string | null
  original_mail_label?: string
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

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  try { return new Date(iso).toLocaleDateString('ja-JP') } catch { return iso }
}

function priceStr(min: number | null, max: number | null): string {
  if (!min && !max) return '—'
  if (min && max && min !== max) return `${(min / 10000).toFixed(0)}〜${(max / 10000).toFixed(0)}万`
  return `${((max ?? min ?? 0) / 10000).toFixed(0)}万`
}

// EMS の構造化フィールドから「【技術者情報】◇〜」ブロックを組み立てる
// 個別提案/まとめて提案の両モードで同一フォーマット
function buildEngineerInfoBlock(ems: EngineerMail | null): string {
  if (!ems) return ''
  const lines: string[] = []
  if (ems.name) lines.push(`◇氏名：${ems.name}`)
  if (ems.age) lines.push(`◇年齢：${ems.age}歳`)
  if (ems.affiliation) lines.push(`◇所属：${ems.affiliation}`)
  const skills = Array.isArray(ems.skills) ? ems.skills.filter(Boolean) : []
  if (skills.length > 0) lines.push(`◇スキル：${skills.slice(0, 8).join('／')}`)
  const price = priceStr(ems.unit_price_min, ems.unit_price_max)
  if (price !== '—') lines.push(`◇希望単価：${price}/月`)
  if (ems.available_from) lines.push(`◇稼働開始：${ems.available_from}`)
  if (ems.nearest_station) lines.push(`◇最寄駅：${ems.nearest_station}`)
  if (lines.length === 0) return ''
  return `\n\n【技術者情報】\n${lines.join('\n')}`
}

// ── 提案メールモーダル ────────────────────────────────
function ProposalModal({ draft, engineerMailId, onClose, engineerAttachments }: { draft: ProposalDraft; engineerMailId: number; onClose: () => void; engineerAttachments?: EmailAttachment[] }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [toName, setToName] = useState(draft.to_name ? draft.to_name + ' 様' : '')
  const [toAddress, setToAddress] = useState(draft.to_address)
  const [body, setBody] = useState(draft.body)
  const [subject, setSubject] = useState(draft.subject)
  const [attachments, setAttachments] = useState<File[]>([])
  const [includingEngineerAttachments, setIncludingEngineerAttachments] = useState(false)
  const [addedEngineerAttIds, setAddedEngineerAttIds] = useState<Set<number>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const includeEngineerAttachments = async () => {
    if (!engineerAttachments || engineerAttachments.length === 0) return
    const targets = engineerAttachments.filter(a => !addedEngineerAttIds.has(a.id))
    if (targets.length === 0) return
    setIncludingEngineerAttachments(true)
    try {
      const files = await Promise.all(targets.map(async att => {
        const res = await axios.get(
          `/api/v1/engineer-mails/${engineerMailId}/attachment/${att.id}`,
          { responseType: 'blob' }
        )
        return new File([res.data], att.filename, { type: att.mime_type ?? 'application/octet-stream' })
      }))
      setAttachments(prev => [...prev, ...files])
      setAddedEngineerAttIds(prev => {
        const n = new Set(prev); targets.forEach(t => n.add(t.id)); return n
      })
    } catch {
      alert('技術者スキルシートの取得に失敗しました')
    } finally {
      setIncludingEngineerAttachments(false)
    }
  }

  // 対照表 自動挿入 (docs/480 Phase 3)
  const matchUser = useAuthStore(s => s.user)
  const matchEnabled = !!matchUser?.tenant?.feature_requirement_matching && !!draft.project_mail_id
  const [includeMatchTable, setIncludeMatchTable] = useState(false)
  const [matchTableMd, setMatchTableMd] = useState<string | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  const fetchMatchTable = async () => {
    if (!draft.project_mail_id) return null
    setMatchLoading(true)
    setMatchError(null)
    try {
      const res = await axios.get(`/api/v1/project-mails/${draft.project_mail_id}/requirement-match`, {
        params: { ems_id: engineerMailId },
      })
      const md = formatMatchTableMarkdown(res.data.requirements_json, res.data.matches_json)
      setMatchTableMd(md)
      return md
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      setMatchError(err.response?.status === 403 ? '機能無効' : '対照表取得失敗')
      return null
    } finally {
      setMatchLoading(false)
    }
  }

  // 対照表 toggle: 現在の本文をベースに挿入/除去 (toggle 再現性 + 編集保持)
  // 連続クリックや fetch 中の OFF を考慮し、最新の checked 状態を ref で追跡
  const includeMatchRef = useRef(includeMatchTable)
  includeMatchRef.current = includeMatchTable
  const handleToggleMatchTable = async (checked: boolean) => {
    setIncludeMatchTable(checked)
    if (!checked) {
      setBody(prev => removeMatchTableFromBody(prev))
      return
    }
    const md = matchTableMd ?? (await fetchMatchTable())
    // fetch 完了時に user が既に OFF にしていたらスキップ
    if (!includeMatchRef.current) return
    if (!md) {
      setIncludeMatchTable(false)
      return
    }
    setBody(prev => insertMatchTableIntoBody(removeMatchTableFromBody(prev), md))
  }

  const handleToNameChange = (name: string) => {
    setToName(name)
    setBody(prev => {
      const lines = prev.split('\n')
      lines[0] = name ? `${name} 様` : '●● 様'
      return lines.join('\n')
    })
  }

  const handleSend = async () => {
    if (!confirm(`${toName || toAddress} に送信しますか？`)) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('to', toAddress)
      formData.append('to_name', toName)
      formData.append('subject', subject)
      formData.append('body', body)
      attachments.forEach(f => formData.append('attachments[]', f))
      // 鮮度モード = send-proposal-from-pms / 登録済モード = send-proposal
      const endpoint = draft.project_mail_id
        ? `/api/v1/engineer-mails/${engineerMailId}/send-proposal-from-pms`
        : `/api/v1/engineer-mails/${engineerMailId}/send-proposal`
      if (draft.project_mail_id) {
        formData.append('project_mail_id', String(draft.project_mail_id))
      } else if (draft.project_id) {
        formData.append('project_id', String(draft.project_id))
      }
      await axios.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSent(true)
      setTimeout(() => onClose(), 1500)
    } catch {
      alert('送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>送信しました</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>{toName || toAddress}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 24px' }}>{subject}</p>
          <button onClick={onClose} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>閉じる</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>📧 提案メール草稿</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>宛先名</span>
            <input type="text" value={toName} onChange={e => handleToNameChange(e.target.value)} placeholder="担当者名" style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>送信先</span>
            <input type="email" value={toAddress} onChange={e => setToAddress(e.target.value)} placeholder="example@example.com" style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>件名</span>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OriginalMailAccordion body={draft.original_mail_body} label={draft.original_mail_label ?? '元メール本文'} />
          {matchEnabled && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', background: '#eff6ff', padding: '6px 10px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
              <input
                type="checkbox"
                checked={includeMatchTable}
                onChange={e => handleToggleMatchTable(e.target.checked)}
                disabled={matchLoading}
              />
              <span>📊 対照表を本文に含める</span>
              {matchLoading && <span style={{ color: '#6b7280', fontSize: 11 }}>(取得中...)</span>}
              {matchError && <span style={{ color: '#dc2626', fontSize: 11 }}>({matchError})</span>}
            </label>
          )}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ width: '100%', fontSize: 13, color: '#374151', lineHeight: 1.7, fontFamily: 'sans-serif', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px', resize: 'vertical', minHeight: 280, boxSizing: 'border-box' }}
          />
          {engineerAttachments && engineerAttachments.length > 0 && (() => {
            const allAdded = engineerAttachments.every(a => addedEngineerAttIds.has(a.id))
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={includeEngineerAttachments}
                  disabled={includingEngineerAttachments || allAdded}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, fontSize: 12, padding: '8px 12px', borderRadius: 6,
                    border: `1px solid ${allAdded ? '#86efac' : '#bfdbfe'}`,
                    background: allAdded ? '#dcfce7' : '#eff6ff',
                    color: allAdded ? '#15803d' : '#1d4ed8',
                    cursor: includingEngineerAttachments || allAdded ? 'default' : 'pointer',
                    fontWeight: 600,
                  }}
                  title="技術者のスキルシート等を提案メールの添付に追加します"
                >
                  <span>
                    {allAdded ? '✓ 技術者のスキルシートを送信添付に含めました' : `📎 技術者のスキルシート (${engineerAttachments.length}件) を送信添付に追加`}
                  </span>
                  {includingEngineerAttachments && <span style={{ fontSize: 11, fontWeight: 400 }}>取得中…</span>}
                </button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontSize: 11, color: '#6b7280', alignItems: 'center' }}>
                  <span>確認DL:</span>
                  {engineerAttachments.map(att => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => downloadEngineerAttachment(engineerMailId, att)}
                      title={`${att.mime_type ?? ''} / ${formatBytes(att.size)} (クリックでブラウザ保存)`}
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: '#fff', border: '1px solid #d1d5db', color: '#374151',
                        cursor: 'pointer', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      📎 {att.filename}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false) }}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const files = Array.from(e.dataTransfer.files); setAttachments(prev => [...prev, ...files]) }}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? '#2563eb' : '#d1d5db'}`, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: 'pointer', background: isDragging ? '#eff6ff' : '#f9fafb', fontSize: 12, color: '#6b7280' }}>
            📎 添付ファイル (クリックまたはドラッグ)
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => { const files = Array.from(e.target.files ?? []); setAttachments(prev => [...prev, ...files]) }} />
          </div>
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              {attachments.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#f3f4f6', borderRadius: 4 }}>
                  <span style={{ color: '#374151' }}>📄 {f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                  <button
                    onClick={() => {
                      const removed = attachments[i]
                      setAttachments(prev => prev.filter((_, idx) => idx !== i))
                      // 技術者添付由来のファイルなら「追加済」マークも外す
                      const eng = engineerAttachments?.find(a => a.filename === removed.name)
                      if (eng) {
                        setAddedEngineerAttIds(prev => {
                          const n = new Set(prev); n.delete(eng.id); return n
                        })
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={sending} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSend} disabled={sending} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: sending ? '#93c5fd' : '#2563eb', color: '#fff', cursor: sending ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {sending ? '送信中...' : '📤 送信'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── まとめて提案モーダル (BP=EMS送信者 宛て) ────────────
function BulkSendModalToBp({
  engineerMailId, initialToName, initialTo, initialSubject, initialBody, projectCount, projectIds, projectMailIds, originalMailBody, onClose,
}: {
  engineerMailId: number
  initialToName: string
  initialTo: string
  initialSubject: string
  initialBody: string
  projectCount: number
  projectIds?: number[]
  projectMailIds?: number[]
  originalMailBody?: string | null
  onClose: () => void
}) {
  const [toName, setToName] = useState(initialToName)
  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [domainWarn, setDomainWarn] = useState(false)

  const execSend = async () => {
    setSending(true)
    try {
      const payload: Record<string, unknown> = {
        recipients: [{ to, name: toName }],
        subject,
        body,
      }
      if (projectIds && projectIds.length > 0) payload.project_ids = projectIds
      if (projectMailIds && projectMailIds.length > 0) payload.project_mail_ids = projectMailIds
      await axios.post(`/api/v1/engineer-mails/${engineerMailId}/send-bulk-to-bp`, payload)
      setSent(true)
      setTimeout(() => onClose(), 1500)
    } catch {
      alert('送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const handleSend = async () => {
    if (!to.trim()) { alert('送信先メールアドレスを入力してください'); return }
    if (!subject.trim()) { alert('件名を入力してください'); return }
    if (!body.trim()) { alert('本文を入力してください'); return }
    // 編集された送信先がまだ元 BP と同一ドメインの場合は確認
    const edited = to.trim() !== initialTo.trim()
    if (edited && isSameDomain(to, initialTo)) {
      setDomainWarn(true)
      return
    }
    if (!confirm(`${toName || to} に送信しますか？`)) return
    await execSend()
  }

  if (sent) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>送信しました</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>{toName || to}</p>
          <button onClick={onClose} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>閉じる</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* ドメイン一致警告 */}
      {domainWarn && (
        <div onClick={() => setDomainWarn(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', padding: '12px 20px', borderBottom: '1px solid #fecaca', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>⚠️ 元 BP ドメインと一致しています</div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0 }}>配信先 <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{to}</span> のドメイン (<span style={{ fontFamily: 'monospace' }}>{extractDomain(to)}</span>) が、技術者ご紹介元 <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{initialTo}</span> と一致しています。</p>
              <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>同一技術者を同 BP に提示すると重複/抜き額露呈の恐れがあります。</p>
              <p style={{ margin: 0 }}>本当に送信しますか？</p>
            </div>
            <div style={{ padding: '12px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDomainWarn(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: 'none', fontSize: 13, cursor: 'pointer' }}>キャンセル</button>
              <button onClick={async () => { setDomainWarn(false); await execSend() }} style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>送信する</button>
            </div>
          </div>
        </div>
      )}

      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>📧 まとめて提案（BP宛て）</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>選択案件 {projectCount}件を提示</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>宛先名</span>
            <input type="text" value={toName} onChange={e => setToName(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>送信先</span>
            <input type="email" value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>件名</span>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OriginalMailAccordion body={originalMailBody} label="技術者ご紹介メール 本文" />
          <textarea value={body} onChange={e => setBody(e.target.value)} style={{ width: '100%', fontSize: 13, color: '#374151', lineHeight: 1.7, fontFamily: 'sans-serif', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px', resize: 'vertical', minHeight: 320, boxSizing: 'border-box' }} />
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={sending} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSend} disabled={sending} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: sending ? '#93c5fd' : '#2563eb', color: '#fff', cursor: sending ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {sending ? '送信中...' : `📤 送信 (${projectCount}件)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 案件カード ────────────────────────────────────────
function ProjectCard({ project, onPropose, generating, checked, onCheck }: {
  project: MatchedProject
  onPropose: (p: MatchedProject) => void
  generating: boolean
  checked: boolean
  onCheck: (id: number) => void
}) {
  const color = rankColor(project.match_score)
  const topSkills = project.required_skills.slice(0, 5)
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${color.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* カードヘッダー: チェックボックス + スコアバッジ + タイトル */}
      <div style={{ background: color.bg, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onCheck(project.project_id)}
          onClick={e => e.stopPropagation()}
          style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, accentColor: color.border }}
        />
        <div
          title={`${project.matched_count}/${project.total_skills} スキル一致`}
          style={{
            flexShrink: 0, width: 52, height: 52, borderRadius: 10,
            border: `2px solid ${color.border}`, background: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: color.text, lineHeight: 1 }}>{rankLabel(project.match_score)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: color.text, lineHeight: 1.4 }}>{project.match_score}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.project_title ?? '（案件名未設定）'}
          </p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
            {project.matched_count}/{project.total_skills} スキル一致
          </p>
        </div>
      </div>

      {/* カードボディ */}
      <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 単価・勤務形態・最寄駅 */}
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
          <span>💴 {priceStr(project.unit_price_min, project.unit_price_max)}</span>
          {project.work_style && <span>🏠 {project.work_style}</span>}
          {project.nearest_station && <span>🚉 {project.nearest_station}</span>}
        </div>
        {/* スキルタグ */}
        {topSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {topSkills.map((s, i) => (
              <span key={i} style={{
                fontSize: 10,
                background: s.matched ? '#dcfce7' : '#eff6ff',
                color: s.matched ? '#15803d' : '#1d4ed8',
                border: `1px solid ${s.matched ? '#86efac' : '#bfdbfe'}`,
                borderRadius: 4, padding: '1px 5px',
                fontWeight: s.is_required ? 700 : 400,
              }}>
                {s.matched ? '✓ ' : ''}{s.name}{s.is_required ? '*' : ''}
              </span>
            ))}
            {project.required_skills.length > 5 && (
              <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>+{project.required_skills.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* カードフッター */}
      <div style={{ display: 'flex', borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={() => onPropose(project)}
          disabled={generating || !project.to_email}
          title={!project.to_email ? '案件提供者の連絡先メールが未登録' : ''}
          style={{
            flex: 1, padding: '8px 0', border: 'none', cursor: generating || !project.to_email ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600,
            background: '#fff',
            color: generating ? '#9ca3af' : !project.to_email ? '#d1d5db' : '#2563eb',
            borderRadius: '0 0 12px 12px',
          }}>
          {generating ? '生成中…' : '📧 個別提案'}
        </button>
      </div>
    </div>
  )
}

// ── 鮮度マッチング: PMS リスト ────────────────────────
function FreshPmsCard({ item, onPropose, generating, checked, onCheck, engineerMailId, requirementMatchingEnabled }: {
  item: FreshPms
  onPropose: (p: FreshPms) => void
  generating: boolean
  checked: boolean
  onCheck: (id: number) => void
  engineerMailId: number
  requirementMatchingEnabled: boolean
}) {
  const color = rankColor(item.score)
  const badgeMap: Record<string, { label: string; color: string }> = {
    new: { label: '新規', color: '#2563eb' },
    registered: { label: '登録済', color: '#16a34a' },
    proposed: { label: '提案済', color: '#a855f7' },
  }
  const badge = badgeMap[item.badge]
  const topSkills = (item.required_skills ?? []).slice(0, 5)
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${color.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* カードヘッダー */}
      <div style={{ background: color.bg, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onCheck(item.project_mail_id)}
          onClick={e => e.stopPropagation()}
          style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, accentColor: color.border }}
        />
        <div style={{
          flexShrink: 0, width: 52, height: 52, borderRadius: 10,
          border: `2px solid ${color.border}`, background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: color.text, lineHeight: 1 }}>{rankLabel(item.score)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: color.text, lineHeight: 1.4 }}>{item.score}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.title ?? '（案件名未設定）'}
          </p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {badge && <span style={{ padding: '1px 5px', borderRadius: 3, background: '#fff', color: badge.color, border: `1px solid ${badge.color}`, fontSize: 10, fontWeight: 600 }}>{badge.label}</span>}
            <span>{item.customer_name ?? '—'}</span>
            <span title={item.received_at ? `送信 ${formatDate(item.received_at)}` : undefined}>{formatDate(item.arrived_at ?? item.received_at) ?? '—'}</span>
          </p>
        </div>
      </div>

      {/* カードボディ */}
      <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
          <span>💴 {priceStr(item.unit_price_min, item.unit_price_max)}</span>
          {item.work_location && <span>🏠 {item.work_location}</span>}
          {item.start_date && <span>📅 {formatDate(item.start_date)}〜</span>}
        </div>
        {topSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {topSkills.map((s, i) => (
              <span key={i} style={{
                fontSize: 10, background: '#eff6ff', color: '#1d4ed8',
                border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 5px',
              }}>{s}</span>
            ))}
            {(item.required_skills ?? []).length > 5 && (
              <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>+{(item.required_skills ?? []).length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* カードフッター */}
      <div style={{ display: 'flex', borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={() => onPropose(item)}
          disabled={generating || !item.email_from_address}
          style={{
            flex: 1, padding: '8px 0', border: 'none', cursor: generating || !item.email_from_address ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600,
            background: '#fff',
            color: generating ? '#9ca3af' : !item.email_from_address ? '#d1d5db' : '#2563eb',
            borderRadius: '0 0 12px 12px',
          }}>
          {generating ? '生成中…' : '📧 個別提案'}
        </button>
      </div>
      {requirementMatchingEnabled && (
        <div style={{ padding: '0 14px 12px' }}>
          <RequirementMatchAccordion
            projectMailId={item.project_mail_id}
            emsId={engineerMailId}
          />
        </div>
      )}
    </div>
  )
}

// ── 案件 リスト行（登録済モード） ─────────────────────
function ProjectRow({ project, onPropose, generating, checked, onCheck }: {
  project: MatchedProject
  onPropose: (p: MatchedProject) => void
  generating: boolean
  checked: boolean
  onCheck: (id: number) => void
}) {
  const c = rankColor(project.match_score)
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onCheck(project.project_id)}
          style={{ cursor: 'pointer', accentColor: c.border }}
        />
      </td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontWeight: 700, background: c.bg, color: c.text, borderRadius: 4, padding: '2px 6px' }}>
          {rankLabel(project.match_score)}{project.match_score}
        </span>
      </td>
      <td style={{ padding: '8px 10px', color: '#111827' }}>
        <div style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.project_title ?? ''}>
          {project.project_title ?? '（案件名未設定）'}
        </div>
        <div style={{ fontSize: 10, color: '#6b7280' }}>{project.matched_count}/{project.total_skills} スキル一致</div>
      </td>
      <td style={{ padding: '8px 10px', maxWidth: 260 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {project.required_skills.slice(0, 6).map((s, i) => (
            <span key={i} style={{
              fontSize: 10,
              background: s.matched ? '#dcfce7' : '#eff6ff',
              color: s.matched ? '#15803d' : '#1d4ed8',
              border: `1px solid ${s.matched ? '#86efac' : '#bfdbfe'}`,
              borderRadius: 3, padding: '1px 5px',
              fontWeight: s.is_required ? 700 : 400,
            }}>
              {s.matched ? '✓ ' : ''}{s.name}{s.is_required ? '*' : ''}
            </span>
          ))}
        </div>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#374151' }}>{priceStr(project.unit_price_min, project.unit_price_max)}</td>
      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{project.work_style ?? '—'}</td>
      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{project.nearest_station ?? '—'}</td>
      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
        <button
          onClick={() => onPropose(project)}
          disabled={generating || !project.to_email}
          title={!project.to_email ? '案件提供者の連絡先メールが未登録' : ''}
          style={{
            fontSize: 11,
            background: generating || !project.to_email ? '#e5e7eb' : '#2563eb',
            color: generating || !project.to_email ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 6, padding: '4px 10px',
            cursor: generating || !project.to_email ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {generating ? '生成中…' : '提案'}
        </button>
      </td>
    </tr>
  )
}

// ── 鮮度マッチング: PMS リスト行 ─────────────────────
function FreshPmsRow({ item, onPropose, generating, checked, onCheck }: {
  item: FreshPms
  onPropose: (p: FreshPms) => void
  generating: boolean
  checked: boolean
  onCheck: (id: number) => void
}) {
  const c = rankColor(item.score)
  const badgeMap: Record<string, { label: string; bg: string; color: string }> = {
    new:        { label: '新規',   bg: '#dcfce7', color: '#166534' },
    registered: { label: '登録済', bg: '#fef3c7', color: '#92400e' },
    proposed:   { label: '提案済', bg: '#fee2e2', color: '#991b1b' },
  }
  const badge = badgeMap[item.badge] ?? badgeMap.new
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onCheck(item.project_mail_id)}
          disabled={item.badge === 'proposed'}
          style={{ cursor: item.badge === 'proposed' ? 'not-allowed' : 'pointer', accentColor: c.border }}
        />
      </td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontWeight: 700, background: c.bg, color: c.text, borderRadius: 4, padding: '2px 6px' }}>
          {rankLabel(item.score)}{item.score}
        </span>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color, borderRadius: 4, padding: '2px 6px' }}>
          {badge.label}
        </span>
      </td>
      <td style={{ padding: '8px 10px', color: '#111827' }}>
        <div style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title ?? ''}>
          {item.title ?? '（案件名未設定）'}
        </div>
      </td>
      <td style={{ padding: '8px 10px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.customer_name ?? ''}>
        {item.customer_name ?? '—'}
      </td>
      <td style={{ padding: '8px 10px', maxWidth: 240 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {(item.required_skills ?? []).slice(0, 6).map((s, i) => (
            <span key={i} style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, padding: '1px 5px' }}>{s}</span>
          ))}
        </div>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#374151' }}>{priceStr(item.unit_price_min, item.unit_price_max)}</td>
      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{item.start_date ? formatDate(item.start_date) : '—'}</td>
      <td style={{ padding: '8px 10px', color: '#9ca3af', fontSize: 11 }} title={item.received_at ? `送信 ${formatDate(item.received_at)}` : undefined}>{formatDate(item.arrived_at ?? item.received_at) ?? '—'}</td>
      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
        <button
          onClick={() => onPropose(item)}
          disabled={generating || !item.email_from_address || item.badge === 'proposed'}
          style={{
            fontSize: 11,
            background: item.badge === 'proposed' || generating || !item.email_from_address ? '#e5e7eb' : '#2563eb',
            color:      item.badge === 'proposed' || generating || !item.email_from_address ? '#9ca3af' : '#fff',
            border: 'none', borderRadius: 6, padding: '4px 10px',
            cursor: item.badge === 'proposed' || generating || !item.email_from_address ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {item.badge === 'proposed' ? '提案済' : (generating ? '生成中…' : '提案')}
        </button>
      </td>
    </tr>
  )
}

// ── 鮮度マッチング ローディング表示 ───────────────────
function FreshLoadingIndicator({ phase, freshDays, progress, gridColumn }: {
  phase: 'fetch' | 'match'
  freshDays: number
  progress: { done: number; total: number } | null
  gridColumn?: string
}) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null
  return (
    <div style={{ gridColumn, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '4px solid #e5e7eb', borderTopColor: '#2563eb',
        animation: 'fresh-spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'center' }}>
        {phase === 'match' ? (
          <>📊 対照表で必須要件×案件を除外中</>
        ) : (
          <>🔍 過去{freshDays}日のメール候補を取得中</>
        )}
      </div>
      {phase === 'match' && progress && (
        <>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {progress.done} / {progress.total} 件 ({pct}%)
          </div>
          <div style={{ width: 320, maxWidth: '70vw', height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${pct ?? 0}%`, height: '100%',
              background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Claude API で 1 件あたり 5〜30 秒 (キャッシュ済は瞬時)</div>
        </>
      )}
      <style>{`
        @keyframes fresh-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────
export default function EngineerMailMatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  // docs/480 要件マッチング feature flag
  const user = useAuthStore(s => s.user)
  const requirementMatchingEnabled = !!user?.tenant?.feature_requirement_matching

  const [mail, setMail] = useState<EngineerMail | null>(null)
  const [projects, setProjects] = useState<MatchedProject[]>([])
  const [freshItems, setFreshItems] = useState<FreshPms[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshMode, setFreshMode] = useState(false)
  const [freshDays, setFreshDays] = useState(3)
  const [freshMinScore, setFreshMinScore] = useState<number>(60) // 既定=中(60)。営業打ち合わせ §4.4+§2.2: 情報不足の1点化でスコアが下がるため既定を高(70)→中(60)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [freshLoading, setFreshLoading] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [freshChecked, setFreshChecked] = useState<Set<number>>(new Set())
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft | null>(null)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [showBulkSend, setShowBulkSend] = useState(false)
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)
  // 鮮度マッチング: 対照表で必須要件×案件を除外するか (デフォルト OFF — 過去30日×低 だと時間がかかるため)
  const [useMatchFilter, setUseMatchFilter] = useState(false)
  const [matchFilterLoading, setMatchFilterLoading] = useState(false)
  const [matchFilterProgress, setMatchFilterProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    Promise.all([
      axios.get(`/api/v1/engineer-mails/${id}`),
      axios.get(`/api/v1/engineer-mails/${id}/matched-projects`),
      axios.get('/api/v1/email-body-templates/me').catch(() => null),
    ]).then(([emsRes, matchRes, tplRes]) => {
      setMail(emsRes.data)
      setProjects(matchRes.data?.data ?? [])
      if (tplRes?.data) setEmailTemplate(tplRes.data)
    }).catch((e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'データを取得できませんでした')
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!freshMode) return
    let cancelled = false
    setFreshLoading(true)
    setMatchFilterLoading(false)
    setMatchFilterProgress(null)
    axios.get(`/api/v1/engineer-mails/${id}/fresh-project-mails`, { params: { days: freshDays, min_score: freshMinScore } })
      .then(async res => {
        if (cancelled) return
        const items: FreshPms[] = res.data?.data ?? []
        // 対照表フィルタ OFF / 機能 OFF / 候補ゼロ → そのまま表示
        if (!requirementMatchingEnabled || !useMatchFilter || items.length === 0) {
          setFreshItems(items)
          return
        }
        // 対照表フィルタ ON → 各 PMS で対照表を並列取得し、必須×案件を一覧から除外
        // 同時実行数を絞り、上限件数も制限して Claude API のレート/コストを抑える (docs/730 §High #4)
        setMatchFilterLoading(true)
        const MATCH_BATCH_LIMIT = 30        // 1 リクエストで処理する最大件数 (上回る分は対照表評価せず表示)
        const MATCH_CONCURRENCY = 5         // 同時 Claude API 呼び出し数
        const targets = items.slice(0, MATCH_BATCH_LIMIT)
        const overflow = items.slice(MATCH_BATCH_LIMIT)
        setMatchFilterProgress({ done: 0, total: targets.length })
        let done = 0
        const evaluated = await mapLimit(targets, MATCH_CONCURRENCY, async (item) => {
          try {
            const mr = await axios.get(`/api/v1/project-mails/${item.project_mail_id}/requirement-match`, {
              params: { ems_id: Number(id) },
            })
            const reqs: { type: string; label: string }[] = mr.data?.requirements_json ?? []
            const matches: { label: string; judgment: string }[] = mr.data?.matches_json ?? []
            const mustLabels = new Set(reqs.filter(r => r.type === 'must').map(r => r.label))
            const hasMustCross = matches.some(m => m.judgment === 'cross' && mustLabels.has(m.label))
            return { item, hasMustCross }
          } catch {
            // 対照表生成失敗時は除外せず表示 (営業判断に委ねる)
            return { item, hasMustCross: false }
          } finally {
            done += 1
            if (!cancelled) setMatchFilterProgress({ done, total: targets.length })
          }
        })
        // 上限超過分は対照表評価をスキップして表示
        const results = [...evaluated, ...overflow.map(item => ({ item, hasMustCross: false }))]
        if (cancelled) return
        setFreshItems(results.filter(r => !r.hasMustCross).map(r => r.item))
      })
      .catch(() => { if (!cancelled) setFreshItems([]) })
      .finally(() => {
        if (cancelled) return
        setFreshLoading(false)
        setMatchFilterLoading(false)
        setMatchFilterProgress(null)
      })
    return () => { cancelled = true }
  }, [id, freshMode, freshDays, freshMinScore, requirementMatchingEnabled, useMatchFilter])

  const toggleCheck = (pid: number) => {
    setChecked(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n })
  }
  const toggleFreshCheck = (pmid: number) => {
    setFreshChecked(prev => { const n = new Set(prev); n.has(pmid) ? n.delete(pmid) : n.add(pmid); return n })
  }
  const selectableProjects = projects.filter(p => !!p.to_email)
  const selectableFresh = freshItems.filter(i => !!i.email_from_address)
  const allChecked = selectableProjects.length > 0 && selectableProjects.every(p => checked.has(p.project_id))
  const allFreshChecked = selectableFresh.length > 0 && selectableFresh.every(i => freshChecked.has(i.project_mail_id))

  const toggleAll = () => {
    if (allChecked) setChecked(new Set())
    else setChecked(new Set(selectableProjects.map(p => p.project_id)))
  }
  const toggleAllFresh = () => {
    if (allFreshChecked) setFreshChecked(new Set())
    else setFreshChecked(new Set(selectableFresh.map(i => i.project_mail_id)))
  }

  // 登録済モード: 個別提案 (案件提供者宛て)
  const handleGenerateProposal = async (project: MatchedProject) => {
    setGeneratingId(project.project_id)
    try {
      const res = await axios.post(`/api/v1/engineer-mails/${id}/generate-proposal`, { project_id: project.project_id })
      // 宛先名: API応答 → 案件営業担当 → 紹介元PMS本文の署名 から推測
      const bodyName = extractRecipientName(project.pms_email_body)
      const recipientName = res.data.to_name ?? project.sales_contact ?? bodyName ?? ''
      const greeting = recipientName ? `${recipientName} 様` : '●● 様'
      const mainContentWithBlock = (res.data.body ?? '') + buildEngineerInfoBlock(mail)
      const wrappedBody = buildEmailBody(greeting, mainContentWithBlock, emailTemplate)
      setProposalDraft({
        subject: res.data.subject ?? `【技術者ご紹介】${mail?.name ?? '弊社技術者'} - ${project.project_title ?? ''}`,
        body: wrappedBody,
        to_address: res.data.to_address ?? project.to_email,
        to_name: recipientName,
        project_id: project.project_id,
        original_mail_body: project.pms_email_body,
        original_mail_label: '紹介元案件メール 本文',
      })
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 503) alert('Claude API が混雑中です。少し待ってから再試行してください。')
      else alert('メール生成に失敗しました')
    } finally {
      setGeneratingId(null)
    }
  }

  // 鮮度モード: 個別提案 (PMS送信者宛て)
  const handleGenerateProposalFromPms = (item: FreshPms) => {
    if (!item.email_from_address) return
    const recipientName = extractRecipientName(item.email_body) ?? ''
    const greeting = recipientName ? `${recipientName} 様` : '●● 様'
    const mainContent = `先日お送りいただいた案件「${item.title ?? ''}」について、弊社所属の技術者がマッチしておりますのでご提案いたします。${buildEngineerInfoBlock(mail)}\n\n面談やスキルシートのご要望がございましたら、お気軽にご返信ください。`
    const wrappedBody = buildEmailBody(greeting, mainContent, emailTemplate)
    setProposalDraft({
      subject: `【技術者ご紹介】${mail?.name ?? '弊社技術者'} - ${item.title ?? ''}`,
      body: wrappedBody,
      to_address: item.email_from_address ?? '',
      to_name: recipientName,
      project_mail_id: item.project_mail_id,
      original_mail_body: item.email_body,
      original_mail_label: '紹介元案件メール 本文',
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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* 一斉配信モーダル */}
      {showBulkSend && (() => {
        // 宛先 = EMS 送信者 (BP 営業担当)。本文署名から氏名推測 → 無ければ from_name
        const bodyName = extractRecipientName(pickMailBody(mail.email))
        const recipientName = bodyName ?? mail.email?.from_name ?? ''
        const initToName = recipientName ? `${recipientName} 様` : ''
        const initTo     = mail.email?.from_address ?? ''
        const initSubject = `【案件のご提案】${mail.name ?? '貴社技術者様'} 向け案件`
        const greeting   = recipientName ? `${recipientName} 様` : '営業ご担当者様'

        let projectLines = ''
        let selectedCount = 0
        const sentProjectIds: number[] = []
        const sentPmsIds: number[] = []
        if (freshMode) {
          const sel = freshItems.filter(i => freshChecked.has(i.project_mail_id))
          selectedCount = sel.length
          sel.forEach(i => sentPmsIds.push(i.project_mail_id))
          projectLines = sel.map(i => {
            const skills = (i.required_skills ?? []).slice(0, 5).join('／')
            const price  = priceStr(i.unit_price_min, i.unit_price_max)
            return `・${i.title ?? '（案件名未設定）'}（${i.customer_name ?? '—'}）\n　スキル：${skills || '—'}　単価：${price}　場所：${i.work_location ?? '—'}`
          }).join('\n')
        } else {
          const sel = projects.filter(p => checked.has(p.project_id))
          selectedCount = sel.length
          sel.forEach(p => sentProjectIds.push(p.project_id))
          projectLines = sel.map(p => {
            const skills = p.required_skills.slice(0, 5).map(s => s.name).filter(Boolean).join('／')
            const price  = priceStr(p.unit_price_min, p.unit_price_max)
            return `・${p.project_title ?? '（案件名未設定）'}\n　スキル：${skills || '—'}　単価：${price}　働き方：${p.work_style ?? '—'}`
          }).join('\n')
        }
        const engineerInfoBlock = buildEngineerInfoBlock(mail)
        const mainContent = `この度、貴社よりご紹介いただいた技術者様について、弊社で取り扱っている以下の案件にマッチしておりますのでご案内いたします。${engineerInfoBlock}\n\n【ご提案案件（${selectedCount}件）】\n${projectLines}\n\nご興味のある案件がございましたら、お気軽にご返信ください。詳細資料の送付も可能です。`
        const initBody = buildEmailBody(greeting, mainContent, emailTemplate)
        return (
          <BulkSendModalToBp
            engineerMailId={Number(id)}
            initialToName={initToName}
            initialTo={initTo}
            initialSubject={initSubject}
            initialBody={initBody}
            projectCount={selectedCount}
            projectIds={sentProjectIds.length > 0 ? sentProjectIds : undefined}
            projectMailIds={sentPmsIds.length > 0 ? sentPmsIds : undefined}
            originalMailBody={pickMailBody(mail.email)}
            onClose={() => setShowBulkSend(false)}
          />
        )
      })()}

      {/* 個別提案モーダル */}
      {proposalDraft && (
        <ProposalModal
          draft={proposalDraft}
          engineerMailId={Number(id)}
          onClose={() => setProposalDraft(null)}
          engineerAttachments={mail.email?.attachments}
        />
      )}

      {/* ヘッダー */}
      <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>← 戻る</button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 11, opacity: 0.85, margin: 0 }}>技術者マッチング</p>
          <p style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0' }}>{mail.name ?? '（氏名未取得）'}{mail.age ? ` / ${mail.age}歳` : ''}{mail.affiliation ? ` / ${mail.affiliation}` : ''}</p>
          {mail.email?.attachments && mail.email.attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
              {mail.email.attachments.map(att => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => downloadEngineerAttachment(Number(id), att)}
                  title={`${att.mime_type ?? '不明'} / ${formatBytes(att.size)} (クリックでダウンロード)`}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 240,
                  }}
                >
                  <span>📎</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                  <span style={{ opacity: 0.7 }}>({formatBytes(att.size)})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* カード/リスト切替 */}
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => setViewMode('card')}
            title="カード表示"
            style={{ padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 14, background: viewMode === 'card' ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: viewMode === 'card' ? 700 : 400 }}
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="リスト表示"
            style={{ padding: '5px 10px', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, background: viewMode === 'list' ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: viewMode === 'list' ? 700 : 400 }}
          >
            ≡
          </button>
        </div>
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => setFreshMode(false)}
            style={{ padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 11, background: !freshMode ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: !freshMode ? 700 : 400 }}>
            登録済案件
          </button>
          <button
            onClick={() => setFreshMode(true)}
            title="過去N日の案件メールから候補抽出"
            style={{ padding: '5px 10px', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 11, background: freshMode ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: freshMode ? 700 : 400 }}>
            📨 メール候補
          </button>
        </div>
        {freshMode && (
          <>
            <select value={freshDays} onChange={e => setFreshDays(Number(e.target.value))}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
              <option value={3} style={{ color: '#000' }}>過去3日</option>
              <option value={7} style={{ color: '#000' }}>過去7日</option>
              <option value={14} style={{ color: '#000' }}>過去14日</option>
              <option value={30} style={{ color: '#000' }}>過去30日</option>
            </select>
            <select value={freshMinScore} onChange={e => setFreshMinScore(Number(e.target.value))}
              title="マッチスコアの下限"
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
              <option value={70} style={{ color: '#000' }}>高 (70+)</option>
              <option value={60} style={{ color: '#000' }}>中 (60+)</option>
              <option value={50} style={{ color: '#000' }}>低 (50+)</option>
            </select>
            {requirementMatchingEnabled && (
              <label
                title="対照表で必須要件×と判定された案件を一覧から除外します (件数が多いと時間がかかります)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: useMatchFilter ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: useMatchFilter ? 700 : 400 }}
              >
                <input
                  type="checkbox"
                  checked={useMatchFilter}
                  onChange={e => setUseMatchFilter(e.target.checked)}
                  style={{ accentColor: '#fff', cursor: 'pointer' }}
                />
                📊 対照表
              </label>
            )}
          </>
        )}
        <button
          onClick={freshMode ? toggleAllFresh : toggleAll}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
          {(freshMode ? allFreshChecked : allChecked) ? '全解除' : '全選択'}
        </button>
        <button
          onClick={() => setShowBulkSend(true)}
          disabled={freshMode ? freshChecked.size === 0 : checked.size === 0}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: (freshMode ? freshChecked.size : checked.size) > 0 ? '#fff' : 'rgba(255,255,255,0.25)',
            color: (freshMode ? freshChecked.size : checked.size) > 0 ? '#16a34a' : 'rgba(255,255,255,0.6)',
            fontSize: 12, fontWeight: 700, cursor: (freshMode ? freshChecked.size : checked.size) > 0 ? 'pointer' : 'default',
          }}>
          📤 まとめて提案 ({freshMode ? freshChecked.size : checked.size})
        </button>
      </div>

      {/* メインリスト */}
      {viewMode === 'card' ? (
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {!freshMode && (
            projects.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: 40, gridColumn: '1/-1' }}>マッチする登録済案件がありません</p>
            ) : (
              projects.map(p => (
                <ProjectCard
                  key={p.project_id}
                  project={p}
                  onPropose={handleGenerateProposal}
                  generating={generatingId === p.project_id}
                  checked={checked.has(p.project_id)}
                  onCheck={toggleCheck}
                />
              ))
            )
          )}

          {freshMode && (
            freshLoading ? (
              <FreshLoadingIndicator
                phase={matchFilterLoading ? 'match' : 'fetch'}
                freshDays={freshDays}
                progress={matchFilterProgress}
                gridColumn="1/-1"
              />
            ) : freshItems.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: 40, gridColumn: '1/-1' }}>過去{freshDays}日のマッチする案件メールはありません</p>
            ) : (
              freshItems.map(i => (
                <FreshPmsCard
                  key={i.project_mail_id}
                  item={i}
                  onPropose={handleGenerateProposalFromPms}
                  generating={false}
                  checked={freshChecked.has(i.project_mail_id)}
                  onCheck={toggleFreshCheck}
                  engineerMailId={Number(id)}
                  requirementMatchingEnabled={requirementMatchingEnabled}
                />
              ))
            )
          )}
        </div>
      ) : (
        // ── リスト表示 ──
        <div style={{ padding: '16px 20px' }}>
          {!freshMode && (
            projects.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>マッチする登録済案件がありません</p>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 32 }}></th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 70 }}>スコア</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>案件</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>必須スキル</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#374151', width: 100 }}>単価</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 90 }}>勤務形態</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 110 }}>最寄駅</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 90 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <ProjectRow
                        key={p.project_id}
                        project={p}
                        onPropose={handleGenerateProposal}
                        generating={generatingId === p.project_id}
                        checked={checked.has(p.project_id)}
                        onCheck={toggleCheck}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {freshMode && (
            freshLoading ? (
              <FreshLoadingIndicator
                phase={matchFilterLoading ? 'match' : 'fetch'}
                freshDays={freshDays}
                progress={matchFilterProgress}
              />
            ) : freshItems.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>過去{freshDays}日のマッチする案件メールはありません</p>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 32 }}></th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 70 }}>スコア</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 70 }}>状態</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>案件</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>顧客</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>必須スキル</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#374151', width: 100 }}>単価</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 100 }}>開始</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 100 }}>受信</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 90 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freshItems.map(i => (
                      <FreshPmsRow
                        key={i.project_mail_id}
                        item={i}
                        onPropose={handleGenerateProposalFromPms}
                        generating={false}
                        checked={freshChecked.has(i.project_mail_id)}
                        onCheck={toggleFreshCheck}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
