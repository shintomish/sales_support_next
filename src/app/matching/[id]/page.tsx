'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'

// ── 一斉配信モーダル ──────────────────────────────────
function BulkSendModal({
  projectMailId,
  initialToName,
  initialTo,
  initialSubject,
  initialBody,
  engineerCount,
  onClose,
}: {
  projectMailId: number
  initialToName: string
  initialTo: string
  initialSubject: string
  initialBody: string
  engineerCount: number
  onClose: () => void
}) {
  const [toName, setToName] = useState(initialToName)
  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    if (!to.trim()) { alert('送信先メールアドレスを入力してください'); return }
    if (!subject.trim()) { alert('件名を入力してください'); return }
    if (!body.trim()) { alert('本文を入力してください'); return }
    if (!confirm(`${toName || to} に送信しますか？`)) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('to', to)
      formData.append('to_name', toName)
      formData.append('subject', subject)
      formData.append('body', body)
      attachments.forEach(f => formData.append('attachments[]', f))
      await axios.post(`/api/v1/project-mails/${projectMailId}/send-proposal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSent(true)
      setTimeout(() => onClose(), 2000)
    } catch {
      alert('送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' as const }

  if (sent) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>送信しました</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>{toName || to}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 24px' }}>{subject}</p>
          <button onClick={onClose} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            閉じる
          </button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 620, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* ヘッダー */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📤 まとめて提案</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{engineerCount}名をまとめて提案</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 宛先（1件） */}
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#6b7280', width: 44, flexShrink: 0 }}>宛先名</span>
              <input
                type="text"
                value={toName}
                onChange={e => setToName(e.target.value)}
                placeholder="担当者名"
                style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#6b7280', width: 44, flexShrink: 0 }}>送信先</span>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="example@example.com"
                style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#6b7280', width: 44, flexShrink: 0 }}>件名</span>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
              />
            </div>
          </div>

          {/* 本文 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>本文</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* 添付ファイル D&D */}
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation(); setIsDragging(false)
              const files = Array.from(e.dataTransfer.files)
              if (files.length) setAttachments(prev => [...prev, ...files])
            }}
            style={{
              border: `2px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
              borderRadius: 8,
              padding: '12px 16px',
              textAlign: 'center',
              background: isDragging ? '#eff6ff' : '#f9fafb',
              transition: 'all 0.2s',
            }}
          >
            <p style={{ fontSize: 12, color: '#2563eb', margin: '0 0 6px' }}>スキルシート等をドラッグ＆ドロップ、またはファイルを選択</p>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) setAttachments(prev => [...prev, ...files])
              if (fileInputRef.current) fileInputRef.current.value = ''
            }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
              ファイルを選択
            </button>
            {attachments.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachments.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, background: '#fff', borderRadius: 4, padding: '4px 8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', marginLeft: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
            閉じる
          </button>
          <button
            onClick={handleSend}
            disabled={sending || sent}
            style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: sent ? '#16a34a' : sending ? '#93c5fd' : '#2563eb', color: '#fff', cursor: sending || sent ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {sent ? '✓ 送信しました' : sending ? '送信中...' : `📤 送信`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 提案メールモーダル ────────────────────────────────
interface EmailBodyTemplate {
  name: string
  name_en: string
  department: string
  position: string
  email: string
  mobile: string
  body_text?: string | null
}

function buildEmailBody(
  greeting: string,
  mainContent: string,
  tpl: EmailBodyTemplate | null,
): string {
  // body_text（設定ページで保存済みのテンプレート）があればそちらを優先
  if (tpl?.body_text) {
    return tpl.body_text
      .replace(/^.*?様\s*/u, `${greeting}\n\n`)   // 1行目の「●● 様」を実際の宛先に置換
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

interface ProposalDraft {
  subject: string
  body: string
  to_address: string
  to_name: string
  engineer_name: string
  project_mail_id: number
}

function ProposalModal({ draft, onClose }: { draft: ProposalDraft; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [toName, setToName] = useState(draft.to_name ? draft.to_name + ' 様' : '')
  const [toAddress, setToAddress] = useState(draft.to_address)
  const [body, setBody] = useState(draft.body)
  const [subject, setSubject] = useState(draft.subject)
  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleToNameChange = (name: string) => {
    setToName(name)
    // 本文の挨拶行（1行目）を更新
    setBody(prev => {
      const lines = prev.split('\n')
      lines[0] = name ? `${name} 様` : '●● 様'
      return lines.join('\n')
    })
  }

  const copyAll = () => {
    const text = `件名: ${subject}\n宛先: ${toName} <${toAddress}>\n\n${body}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      await axios.post(`/api/v1/project-mails/${draft.project_mail_id}/send-proposal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
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
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>送信しました</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>{toName || toAddress}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 24px' }}>{subject}</p>
          <button onClick={onClose} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            閉じる
          </button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* ヘッダー */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>📧 提案メール草稿</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{draft.engineer_name} の提案</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {/* メタ情報 */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>宛先名</span>
            <input
              type="text"
              value={toName}
              onChange={e => handleToNameChange(e.target.value)}
              placeholder="担当者名"
              style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>送信先</span>
            <input
              type="email"
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
              placeholder="example@example.com"
              style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#6b7280', width: 40, flexShrink: 0 }}>件名</span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
          </div>
        </div>

        {/* 本文 */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ width: '100%', fontSize: 13, color: '#374151', lineHeight: 1.7, fontFamily: 'sans-serif', border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px', resize: 'vertical', minHeight: 280, boxSizing: 'border-box' }}
          />

          {/* 添付ファイル D&D */}
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation(); setIsDragging(false)
              const files = Array.from(e.dataTransfer.files)
              if (files.length) setAttachments(prev => [...prev, ...files])
            }}
            style={{
              border: `2px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
              borderRadius: 8,
              padding: '12px 16px',
              textAlign: 'center',
              background: isDragging ? '#eff6ff' : '#f9fafb',
              transition: 'all 0.2s',
            }}
          >
            <p style={{ fontSize: 12, color: '#2563eb', margin: '0 0 6px' }}>スキルシート等をドラッグ＆ドロップ、またはファイルを選択</p>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) setAttachments(prev => [...prev, ...files])
              if (fileInputRef.current) fileInputRef.current.value = ''
            }} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
              ファイルを選択
            </button>
            {attachments.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachments.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, background: '#fff', borderRadius: 4, padding: '4px 8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', marginLeft: 8 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
            閉じる
          </button>
          <button
            onClick={copyAll}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: copied ? '#16a34a' : '#e5e7eb', color: copied ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'background 0.2s' }}
          >
            {copied ? '✓ コピーしました' : '📋 コピー'}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || sent}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: sent ? '#16a34a' : sending ? '#93c5fd' : '#2563eb', color: '#fff', cursor: sending || sent ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, transition: 'background 0.2s' }}
          >
            {sent ? '✓ 送信しました' : sending ? '送信中...' : '📤 送信'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 型定義 ──────────────────────────────────────────
interface ProjectMail {
  id: number
  title: string | null
  customer_name: string | null
  sales_contact: string | null
  required_skills: string[]
  preferred_skills: string[]
  work_location: string | null
  remote_ok: boolean | null
  unit_price_min: number | null
  unit_price_max: number | null
  start_date: string | null
  age_limit: string | null
  supply_chain: number | null
  email: { from_address: string | null; from_name: string | null } | null
}

interface MatchedEngineer {
  engineer_id: number
  engineer_name: string
  email: string | null
  affiliation: string | null
  affiliation_contact: string | null
  affiliation_email: string | null
  affiliation_type: string | null
  engineer_mail_source_id: number | null
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
  checked,
  generating,
  onPropose,
  onExclude,
  onCheck,
  onDetail,
  onGenerateProposal,
}: {
  eng: MatchedEngineer
  proposed: boolean
  excluded: boolean
  checked: boolean
  generating: boolean
  onPropose: () => void
  onExclude: () => void
  onCheck: () => void
  onDetail: () => void
  onGenerateProposal: () => void
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
      {/* カードヘッダー: チェックボックス + スコアバッジ + 名前 */}
      <div style={{ background: color.bg, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          onClick={e => e.stopPropagation()}
          style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0, accentColor: color.border }}
        />
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
            borderRadius: '0 0 0 0',
          }}
        >
          {proposed ? '✓ 提案済み' : '提案する'}
        </button>
        <button
          onClick={onGenerateProposal}
          disabled={generating}
          style={{
            flex: 1,
            padding: '8px 0',
            border: 'none',
            borderRight: '1px solid #f3f4f6',
            cursor: generating ? 'wait' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: '#fff',
            color: generating ? '#9ca3af' : '#2563eb',
            transition: 'all 0.15s',
          }}
        >
          {generating ? '生成中…' : '📧 提案メール'}
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

// ── 技術者行（リスト表示用） ──────────────────────────
function EngineerRow({
  eng,
  proposed,
  excluded,
  checked,
  generating,
  onPropose,
  onExclude,
  onCheck,
  onDetail,
  onGenerateProposal,
}: {
  eng: MatchedEngineer
  proposed: boolean
  excluded: boolean
  checked: boolean
  generating: boolean
  onPropose: () => void
  onExclude: () => void
  onCheck: () => void
  onDetail: () => void
  onGenerateProposal: () => void
}) {
  const color = rankColor(eng.score)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      background: excluded ? '#f9fafb' : '#fff',
      borderBottom: '1px solid #f3f4f6',
      opacity: excluded ? 0.55 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* チェックボックス */}
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        onClick={e => e.stopPropagation()}
        style={{ width: 15, height: 15, flexShrink: 0, accentColor: color.border, cursor: 'pointer' }}
      />

      {/* スコアバッジ */}
      <button
        onClick={onDetail}
        title="スコア内訳を見る"
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 8,
          border: `2px solid ${color.border}`,
          background: color.bg,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: color.text, lineHeight: 1 }}>{rankLabel(eng.score)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.text, lineHeight: 1.3 }}>{eng.score}</span>
      </button>

      {/* 名前・所属 */}
      <div style={{ width: 160, flexShrink: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eng.engineer_name}
        </p>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eng.age ? `${eng.age}歳` : ''}{eng.age && eng.affiliation ? '　' : ''}{eng.affiliation ?? ''}
        </p>
      </div>

      {/* 稼働状況 */}
      <div style={{ width: 110, flexShrink: 0 }}>
        {eng.availability_status ? (
          <p style={{ fontSize: 11, margin: 0, color: eng.availability_status === 'available' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
            ● {AVAILABILITY_LABEL[eng.availability_status] ?? eng.availability_status}
          </p>
        ) : null}
        {eng.available_from && (
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '1px 0 0' }}>{formatDate(eng.available_from)}〜</p>
        )}
      </div>

      {/* 単価 */}
      <div style={{ width: 80, flexShrink: 0, fontSize: 11, color: '#6b7280' }}>
        {priceStr(eng.desired_unit_price_min, eng.desired_unit_price_max) ?? '—'}
      </div>

      {/* スキルタグ（最大4件） */}
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 3, minWidth: 0 }}>
        {eng.skills.slice(0, 4).map((s, i) => (
          <span key={i} style={{
            fontSize: 10,
            background: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            borderRadius: 4,
            padding: '1px 5px',
            whiteSpace: 'nowrap',
          }}>
            {s.name}{s.experience_years ? ` ${s.experience_years}y` : ''}
          </span>
        ))}
        {eng.skills.length > 4 && (
          <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>+{eng.skills.length - 4}</span>
        )}
      </div>

      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={onPropose}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            background: proposed ? '#16a34a' : '#f0fdf4',
            color: proposed ? '#fff' : '#16a34a',
          }}
        >
          {proposed ? '✓ 提案済み' : '提案する'}
        </button>
        <button
          onClick={onGenerateProposal}
          disabled={generating}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: 6,
            cursor: generating ? 'wait' : 'pointer',
            fontSize: 11,
            fontWeight: 600,
            background: '#eff6ff',
            color: generating ? '#9ca3af' : '#2563eb',
          }}
        >
          {generating ? '生成中…' : '📧 メール'}
        </button>
        <button
          onClick={onExclude}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            background: excluded ? '#6b7280' : '#f3f4f6',
            color: excluded ? '#fff' : '#9ca3af',
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
  checked,
  onPropose,
  onExclude,
  onCheck,
  onDetail,
  generatingId,
  onGenerateProposal,
  viewMode,
}: {
  rank: '◎' | '○' | '△'
  engineers: MatchedEngineer[]
  proposed: Set<number>
  excluded: Set<number>
  checked: Set<number>
  onPropose: (id: number) => void
  onExclude: (id: number) => void
  onCheck: (id: number) => void
  onDetail: (eng: MatchedEngineer) => void
  generatingId: number | null
  onGenerateProposal: (eng: MatchedEngineer) => void
  viewMode: 'card' | 'list'
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
        viewMode === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {engineers.map(eng => (
              <EngineerCard
                key={eng.engineer_id}
                eng={eng}
                proposed={proposed.has(eng.engineer_id)}
                excluded={excluded.has(eng.engineer_id)}
                checked={checked.has(eng.engineer_id)}
                generating={generatingId === eng.engineer_id}
                onPropose={() => onPropose(eng.engineer_id)}
                onExclude={() => onExclude(eng.engineer_id)}
                onCheck={() => onCheck(eng.engineer_id)}
                onDetail={() => onDetail(eng)}
                onGenerateProposal={() => onGenerateProposal(eng)}
              />
            ))}
          </div>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {engineers.map(eng => (
              <EngineerRow
                key={eng.engineer_id}
                eng={eng}
                proposed={proposed.has(eng.engineer_id)}
                excluded={excluded.has(eng.engineer_id)}
                checked={checked.has(eng.engineer_id)}
                generating={generatingId === eng.engineer_id}
                onPropose={() => onPropose(eng.engineer_id)}
                onExclude={() => onExclude(eng.engineer_id)}
                onCheck={() => onCheck(eng.engineer_id)}
                onDetail={() => onDetail(eng)}
                onGenerateProposal={() => onGenerateProposal(eng)}
              />
            ))}
          </div>
        )
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
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft | null>(null)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [showBulkSend, setShowBulkSend] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [sourceFilter, setSourceFilter] = useState<'' | 'self' | 'bp' | 'mail'>('')

  const visibleEngineers = engineers.filter(e => {
    if (excluded.has(e.engineer_id)) return false
    if (sourceFilter === 'self') return e.affiliation_type === 'self'
    if (sourceFilter === 'bp') return e.affiliation_type && e.affiliation_type !== 'self' && !e.engineer_mail_source_id
    if (sourceFilter === 'mail') return !!e.engineer_mail_source_id
    return true
  })
  const allChecked = visibleEngineers.length > 0 && visibleEngineers.every(e => checked.has(e.engineer_id))

  const toggleCheck = (engId: number) => {
    setChecked(prev => { const n = new Set(prev); n.has(engId) ? n.delete(engId) : n.add(engId); return n })
  }
  const toggleCheckAll = () => {
    if (allChecked) {
      setChecked(new Set())
    } else {
      setChecked(new Set(visibleEngineers.map(e => e.engineer_id)))
    }
  }


  useEffect(() => {
    if (!id) return
    axios.get('/api/v1/email-body-templates/me').then(res => {
      if (res.data) setEmailTemplate(res.data)
    }).catch(() => {})
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

  const handleGenerateProposal = async (eng: MatchedEngineer) => {
    setGeneratingId(eng.engineer_id)
    try {
      const res = await axios.post(`/api/v1/project-mails/${id}/generate-proposal`, { engineer_id: eng.engineer_id })
      const greeting = `${res.data.to_name ? res.data.to_name + ' 様' : '●● 様'}`
      const wrappedBody = buildEmailBody(greeting, res.data.body, emailTemplate)
      setProposalDraft({ ...res.data, subject: `【技術者ご紹介】${mail?.title ?? ''}`, body: wrappedBody, engineer_name: eng.engineer_name, project_mail_id: Number(id) })
    } catch {
      alert('メール生成に失敗しました')
    } finally {
      setGeneratingId(null)
    }
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
    [s]: visibleEngineers.filter(e => e.score >= 80),
    [o]: visibleEngineers.filter(e => e.score >= 60 && e.score < 80),
    [t]: visibleEngineers.filter(e => e.score < 60),
  }

  const proposedCount = proposed.size


  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* 一斉配信モーダル */}
      {showBulkSend && (()=>{
        const selected = engineers.filter(e => checked.has(e.engineer_id))
        // 宛先は案件メールの送信元（案件をくれた相手）
        const initToName = (mail?.sales_contact || mail?.email?.from_name || '') + ' 様'
        const initTo     = mail?.email?.from_address ?? ''
        const initSubject = `【技術者ご紹介】${mail?.title ?? ''}`
        const greeting   = mail?.sales_contact || mail?.email?.from_name
          ? `${mail.sales_contact || mail.email?.from_name} 様`
          : '営業ご担当者様'
        const engineerLines = selected.map(e => {
          const skills = e.skills.slice(0, 5).map(s => s.name).join('／')
          const avail = e.availability_status === 'available' ? '稼働可' : e.availability_status === 'scheduled' ? '稼働予定' : e.availability_status === 'working' ? '稼働中' : ''
          return `・${e.engineer_name}（${e.age ? `${e.age}歳` : ''}${e.affiliation ? `／${e.affiliation}` : ''}）\n　スキル：${skills || '—'}　稼働：${avail || '—'}`
        }).join('\n')
        const mainContent = `この度は、貴社のご要件に対応可能なエンジニアをご紹介させていただきたく、ご連絡差し上げました。\n\n【ご紹介エンジニア（${selected.length}名）】\n${engineerLines}\n\n各エンジニアのスキルシートをご要望の場合は、お気軽にご返信ください。\nまた、面談のご調整も随時承っております。`
        const initBody = buildEmailBody(greeting, mainContent, emailTemplate)
        return <BulkSendModal projectMailId={Number(id)} initialToName={initToName} initialTo={initTo} initialSubject={initSubject} initialBody={initBody} engineerCount={selected.length} onClose={() => setShowBulkSend(false)} />
      })()}
      {/* 提案メールモーダル */}
      {proposalDraft && <ProposalModal draft={proposalDraft} onClose={() => setProposalDraft(null)} />}
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
          {/* ソース別フィルタ */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            {([
              { value: '', label: '全て' },
              { value: 'self', label: '自社' },
              { value: 'bp', label: 'BP' },
              { value: 'mail', label: 'メール' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSourceFilter(opt.value)}
                style={{ padding: '5px 10px', border: 'none', borderLeft: opt.value ? '1px solid rgba(255,255,255,0.3)' : 'none', cursor: 'pointer', fontSize: 11, background: sourceFilter === opt.value ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: sourceFilter === opt.value ? 700 : 400 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleCheckAll}
            style={{ fontSize: 12, background: allChecked ? '#6b7280' : 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
          >
            {allChecked ? '☑ 全解除' : '☐ 全選択'}
          </button>
          <button
            onClick={() => setShowBulkSend(true)}
            disabled={checked.size === 0}
            style={{ fontSize: 12, background: checked.size > 0 ? '#f59e0b' : '#d1d5db', border: 'none', color: checked.size > 0 ? '#fff' : '#9ca3af', borderRadius: 6, padding: '5px 12px', cursor: checked.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 600, flexShrink: 0 }}
          >
            📤 まとめて提案{checked.size > 0 ? `（${checked.size}名）` : ''}
          </button>
          <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 10px', flexShrink: 0 }}>
            候補 {visibleEngineers.length}名
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
                checked={checked}
                onPropose={togglePropose}
                onExclude={toggleExclude}
                onCheck={toggleCheck}
                onDetail={setDetailEng}
                generatingId={generatingId}
                onGenerateProposal={handleGenerateProposal}
                viewMode={viewMode}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
