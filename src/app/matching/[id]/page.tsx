'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'
import OriginalMailAccordion from '@/components/OriginalMailAccordion'
import RequirementMatchAccordion from '@/components/RequirementMatchAccordion'
import { pickMailBody, buildEmailBody, type EmailBodyTemplate } from '@/lib/mailBody'
import { isSameDomain, extractDomain } from '@/lib/mailDomain'
import { formatMatchTableMarkdown, insertMatchTableIntoBody, removeMatchTableFromBody } from '@/lib/requirementCategoryLabel'
import { useAuthStore } from '@/store/authStore'

/**
 * 技術者メール本文の挨拶文から **送信者 (BP 担当者)** の氏名を抽出する。
 *   「いつもお世話になっております。株式会社キャリアビートの雨宮 昂平と申します。」
 *   → "雨宮 昂平"
 *
 * 抽出できない場合は null。署名や宛先の人物名 (= 技術者本人) ではなく
 * メールの発信者名を返すための関数。
 */
function extractSenderNameFromBody(body: string | null | undefined): string | null {
  if (!body) return null
  // 日本人氏名で許容する文字: 漢字・ひらがな・カタカナ・全角空白・半角スペース
  // 区切り文字 (、。の/と/で/が/より など) や改行で終端
  const nameChars = '[ぁ-んァ-ヶー一-龥々〆〤A-Za-z\\s　]'
  const patterns: RegExp[] = [
    // 「[会社名]の YY と申します/でございます」 (会社名が前にあるパターン優先)
    new RegExp(`(?:株式会社|有限会社|合同会社|合資会社|（株）|\\(株\\)|㈱)[^\\s\\n、。の]{1,30}の\\s*(${nameChars}{2,15})\\s*(?:と申します|でございます)`),
    // 「YY と申します」 (会社情報なし)
    new RegExp(`(${nameChars}{2,15})\\s*と申します`),
    // 「YY でございます」
    new RegExp(`(${nameChars}{2,15})\\s*でございます`),
  ]
  for (const re of patterns) {
    const m = body.match(re)
    if (m && m[1]) {
      const name = m[1].trim().replace(/\s+/g, ' ')
      // 「営業」「弊社」など一般語は除外
      if (/^(営業|弊社|当社|担当|担当者)$/.test(name)) continue
      if (name.length >= 2) return name
    }
  }
  return null
}

// PMS の構造化フィールドから「【案件情報】◇〜」ブロックを組み立てる
// 個別提案/まとめて提案の両モードで同一フォーマットになるよう共通化
function buildProjectInfoBlock(mail: ProjectMail | null): string {
  if (!mail) return ''
  const lines: string[] = []
  if (mail.title) lines.push(`◇案件：${mail.title}`)
  if (mail.customer_name) lines.push(`◇顧客：${mail.customer_name}`)
  const req = Array.isArray(mail.required_skills) ? mail.required_skills.filter(Boolean) : []
  if (req.length > 0) lines.push(`◇必須スキル：${req.join('／')}`)
  const pref = Array.isArray(mail.preferred_skills) ? mail.preferred_skills.filter(Boolean) : []
  if (pref.length > 0) lines.push(`◇歓迎スキル：${pref.join('／')}`)
  const process = Array.isArray(mail.process) ? mail.process.filter(Boolean) : []
  if (process.length > 0) lines.push(`◇工程：${process.join('／')}`)
  if (mail.start_date) lines.push(`◇時期：${mail.start_date}`)
  if (mail.work_location || mail.remote_ok) {
    const loc = [mail.work_location, mail.remote_ok ? 'リモート可' : null].filter(Boolean).join('／')
    if (loc) lines.push(`◇場所：${loc}`)
  }
  if (mail.unit_price_min || mail.unit_price_max) {
    lines.push(`◇単価：${mail.unit_price_min ?? ''}〜${mail.unit_price_max ?? ''}万円`)
  }
  if (mail.contract_type) lines.push(`◇契約：${mail.contract_type}`)
  if (lines.length === 0) return ''
  return `\n\n【案件情報】\n${lines.join('\n')}`
}

// ── 元メール本文 アコーディオン ────────────────────────
// ── 一斉配信モーダル ──────────────────────────────────
function BulkSendModal({
  projectMailId,
  initialToName,
  initialTo,
  initialSubject,
  initialBody,
  engineerCount,
  originalMailBody,
  onClose,
}: {
  projectMailId: number
  initialToName: string
  initialTo: string
  initialSubject: string
  initialBody: string
  engineerCount: number
  originalMailBody?: string | null
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
  const [domainWarn, setDomainWarn] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // BulkSendModal は技術者単体の添付には非対応 (複数技術者まとめ送信のため空で固定)
  const engineerAttachments: EmailAttachment[] = []
  const addedEngineerAttIds = new Set<number>()
  const setAddedEngineerAttIds = (_: unknown) => {} // no-op (BulkSendModal では未使用)
  const includingEngineerAttachments = false
  const includeEngineerAttachments = async () => {}
  const engineerMailIdForAtt: number | null = null

  const execSend = async () => {
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

  const handleSend = async () => {
    if (!to.trim()) { alert('送信先メールアドレスを入力してください'); return }
    if (!subject.trim()) { alert('件名を入力してください'); return }
    if (!body.trim()) { alert('本文を入力してください'); return }
    // 編集された送信先がまだソース案件元と同一ドメインの場合は確認 (抜き額露呈防止)
    const edited = to.trim() !== initialTo.trim()
    if (edited && isSameDomain(to, initialTo)) {
      setDomainWarn(true)
      return
    }
    if (!confirm(`${toName || to} に送信しますか？`)) return
    await execSend()
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
      {/* ドメイン一致警告 */}
      {domainWarn && (
        <div onClick={() => setDomainWarn(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ background: '#fef2f2', padding: '12px 20px', borderBottom: '1px solid #fecaca', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>⚠️ 元請けドメインと一致しています</div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0 }}>配信先 <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{to}</span> のドメイン (<span style={{ fontFamily: 'monospace' }}>{extractDomain(to)}</span>) が、案件元 <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{initialTo}</span> と一致しています。</p>
              <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>同じ案件を元請けに提案すると、抜き額が露呈する恐れがあります。</p>
              <p style={{ margin: 0 }}>本当に送信しますか？</p>
            </div>
            <div style={{ padding: '12px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDomainWarn(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: 'none', fontSize: 13, cursor: 'pointer' }}>キャンセル</button>
              <button onClick={async () => { setDomainWarn(false); await execSend() }} style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>送信する</button>
            </div>
          </div>
        </div>
      )}

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

          {/* 元メール本文 (アコーディオン) */}
          <OriginalMailAccordion body={originalMailBody} label="紹介元案件メール 本文" />

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
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
                ファイルを選択
              </button>
              {engineerAttachments.length > 0 && (() => {
                const allAdded = engineerAttachments.every(a => addedEngineerAttIds.has(a.id))
                return (
                  <button
                    type="button"
                    onClick={includeEngineerAttachments}
                    disabled={includingEngineerAttachments || allAdded}
                    title="技術者メールに添付されていたスキルシート等を送信添付に含めます"
                    style={{
                      padding: '4px 12px', borderRadius: 6,
                      border: `1px solid ${allAdded ? '#86efac' : '#bfdbfe'}`,
                      background: allAdded ? '#dcfce7' : '#eff6ff',
                      color: allAdded ? '#15803d' : '#1d4ed8',
                      cursor: includingEngineerAttachments || allAdded ? 'default' : 'pointer',
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {includingEngineerAttachments
                      ? '📎 取得中…'
                      : allAdded
                        ? '✓ 技術者スキルシート追加済'
                        : `📎 技術者スキルシート (${engineerAttachments.length}件) を添付`}
                  </button>
                )
              })()}
            </div>
            {engineerAttachments.length > 0 && engineerMailIdForAtt && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontSize: 11, color: '#6b7280', alignItems: 'center', marginTop: 6, justifyContent: 'center' }}>
                <span>確認DL:</span>
                {engineerAttachments.map(att => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => downloadEngineerAttachment(engineerMailIdForAtt, att)}
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
            )}
            {attachments.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachments.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, background: '#fff', borderRadius: 4, padding: '4px 8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                    <button
                      onClick={() => {
                        const removed = attachments[i]
                        setAttachments(prev => prev.filter((_, j) => j !== i))
                        const eng = engineerAttachments.find(a => a.filename === removed.name)
                        if (eng) {
                          setAddedEngineerAttIds(prev => {
                            const n = new Set(prev); n.delete(eng.id); return n
                          })
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', marginLeft: 8 }}
                    >✕</button>
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

interface ProposalDraft {
  subject: string
  body: string
  to_address: string
  to_name: string
  engineer_name: string
  project_mail_id: number
  // 鮮度マッチング経由（EMS から提案）の場合のみセット
  engineer_mail_source_id?: number
  // モーダル内 ▼アコーディオン表示用 (登録済モード=PMS本文 / 鮮度モード=EMS本文)
  original_mail_body?: string | null
  original_mail_label?: string
}

interface EmailAttachment {
  id: number
  filename: string
  mime_type: string | null
  size: number | null
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

  // 技術者メール (EMS) の添付ファイル — 「📎 技術者のスキルシートを送信添付に追加」用
  const [engineerAttachments, setEngineerAttachments] = useState<EmailAttachment[]>([])
  const [includingEngineerAttachments, setIncludingEngineerAttachments] = useState(false)
  const [addedEngineerAttIds, setAddedEngineerAttIds] = useState<Set<number>>(new Set())
  const engineerMailIdForAtt: number | null = draft.engineer_mail_source_id ?? null

  useEffect(() => {
    if (!draft.engineer_mail_source_id) return
    let cancelled = false
    axios.get(`/api/v1/engineer-mails/${draft.engineer_mail_source_id}`)
      .then(res => {
        if (cancelled) return
        setEngineerAttachments(res.data?.email?.attachments ?? [])
      })
      .catch(() => { if (!cancelled) setEngineerAttachments([]) })
    return () => { cancelled = true }
  }, [draft.engineer_mail_source_id])

  const includeEngineerAttachments = async () => {
    const emsId = draft.engineer_mail_source_id
    if (!emsId) return
    const targets = engineerAttachments.filter(a => !addedEngineerAttIds.has(a.id))
    if (targets.length === 0) return
    setIncludingEngineerAttachments(true)
    try {
      const files = await Promise.all(targets.map(async att => {
        const res = await axios.get(
          `/api/v1/engineer-mails/${emsId}/attachment/${att.id}`,
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
  const matchEnabled = !!matchUser?.tenant?.feature_requirement_matching && !!draft.engineer_mail_source_id
  const [includeMatchTable, setIncludeMatchTable] = useState(false)
  const [matchTableMd, setMatchTableMd] = useState<string | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)

  const fetchMatchTable = async () => {
    if (!draft.engineer_mail_source_id) return null
    setMatchLoading(true)
    setMatchError(null)
    try {
      const res = await axios.get(`/api/v1/project-mails/${draft.project_mail_id}/requirement-match`, {
        params: { ems_id: draft.engineer_mail_source_id },
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

  // 対照表 toggle: 現在の本文をベースに対照表ブロックを挿入/除去
  // (baseBodyRef を使わないので、宛先名変更や本文編集が toggle で失われない)
  const handleToggleMatchTable = async (checked: boolean) => {
    setIncludeMatchTable(checked)
    if (!checked) {
      setBody(prev => removeMatchTableFromBody(prev))
      return
    }
    const md = matchTableMd ?? (await fetchMatchTable())
    if (!md) {
      setIncludeMatchTable(false)
      return
    }
    // 既に対照表ブロックがあれば一旦除去してから挿入し直し (重複防止)
    setBody(prev => insertMatchTableIntoBody(removeMatchTableFromBody(prev), md))
  }

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
      const endpoint = draft.engineer_mail_source_id
        ? `/api/v1/project-mails/${draft.project_mail_id}/send-proposal-from-ems`
        : `/api/v1/project-mails/${draft.project_mail_id}/send-proposal`
      if (draft.engineer_mail_source_id) {
        formData.append('engineer_mail_source_id', String(draft.engineer_mail_source_id))
      }
      await axios.post(endpoint, formData, {
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
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#1d4ed8' }}>
                ファイルを選択
              </button>
              {engineerAttachments.length > 0 && (() => {
                const allAdded = engineerAttachments.every(a => addedEngineerAttIds.has(a.id))
                return (
                  <button
                    type="button"
                    onClick={includeEngineerAttachments}
                    disabled={includingEngineerAttachments || allAdded}
                    title="技術者メールに添付されていたスキルシート等を送信添付に含めます"
                    style={{
                      padding: '4px 12px', borderRadius: 6,
                      border: `1px solid ${allAdded ? '#86efac' : '#bfdbfe'}`,
                      background: allAdded ? '#dcfce7' : '#eff6ff',
                      color: allAdded ? '#15803d' : '#1d4ed8',
                      cursor: includingEngineerAttachments || allAdded ? 'default' : 'pointer',
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {includingEngineerAttachments
                      ? '📎 取得中…'
                      : allAdded
                        ? '✓ 技術者スキルシート追加済'
                        : `📎 技術者スキルシート (${engineerAttachments.length}件) を添付`}
                  </button>
                )
              })()}
            </div>
            {engineerAttachments.length > 0 && engineerMailIdForAtt && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, fontSize: 11, color: '#6b7280', alignItems: 'center', marginTop: 6, justifyContent: 'center' }}>
                <span>確認DL:</span>
                {engineerAttachments.map(att => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => downloadEngineerAttachment(engineerMailIdForAtt, att)}
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
            )}
            {attachments.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {attachments.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, background: '#fff', borderRadius: 4, padding: '4px 8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                    <button
                      onClick={() => {
                        const removed = attachments[i]
                        setAttachments(prev => prev.filter((_, j) => j !== i))
                        const eng = engineerAttachments.find(a => a.filename === removed.name)
                        if (eng) {
                          setAddedEngineerAttIds(prev => {
                            const n = new Set(prev); n.delete(eng.id); return n
                          })
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', marginLeft: 8 }}
                    >✕</button>
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
  process: string[] | null
  work_location: string | null
  remote_ok: boolean | null
  unit_price_min: number | null
  unit_price_max: number | null
  start_date: string | null
  age_limit: string | null
  contract_type: string | null
  supply_chain: number | null
  email: { from_address: string | null; from_name: string | null; body_text: string | null; body_html: string | null } | null
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

// 鮮度マッチング（過去N日メールから候補抽出）の項目
interface FreshEms {
  engineer_mail_source_id: number
  name: string | null
  age: number | null
  affiliation: string | null
  affiliation_type: string | null
  nearest_station: string | null
  skills: string[] | null
  unit_price_min: number | null
  unit_price_max: number | null
  available_from: string | null
  received_at: string | null
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
  registered_engineer_id: number | null
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

// ── 鮮度マッチング: EMS リスト ────────────────────────
function FreshEmsList({
  loading,
  items,
  days,
  viewMode,
  onPropose,
  checked,
  onCheck,
  projectMailId,
  requirementMatchingEnabled,
  matchedEmsIds,
}: {
  loading: boolean
  items: FreshEms[]
  days: number
  viewMode: 'card' | 'list'
  onPropose: (item: FreshEms) => void
  checked: Set<number>
  onCheck: (emsId: number) => void
  projectMailId: number
  requirementMatchingEnabled: boolean
  matchedEmsIds: Set<number>
}) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📨</div>
        <p>過去{days}日のメールから候補を抽出中...</p>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
        <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
        <p>過去{days}日の受信メールにマッチする候補がありません</p>
      </div>
    )
  }
  const sorted = [...items].sort((a, b) => b.score - a.score)

  // ── リスト(テーブル)表示 ──
  if (viewMode === 'list') {
    return (
      <div>
        <div style={{ marginBottom: 12, fontSize: 12, color: '#6b7280' }}>
          📨 過去{days}日の受信メールから {items.length} 件の候補
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 32 }}></th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 70 }}>スコア</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 110 }}>状態</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>技術者</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>所属</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>スキル</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#374151', width: 90 }}>単価</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 100 }}>稼動可能</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', width: 100 }}>受信</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 110 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => {
                const c = rankColor(item.score)
                const hasMatch = matchedEmsIds.has(item.engineer_mail_source_id)
                const badgeLabel =
                  item.badge === 'proposed' ? '提案済' :
                  item.badge === 'registered' ? '登録済' : '新規'
                const badgeColor =
                  item.badge === 'proposed' ? { bg: '#fee2e2', color: '#991b1b' } :
                  item.badge === 'registered' ? { bg: '#fef3c7', color: '#92400e' } :
                  { bg: '#dcfce7', color: '#166534' }
                const priceLabel = item.unit_price_min || item.unit_price_max
                  ? `${item.unit_price_min ?? '?'}〜${item.unit_price_max ?? '?'}万`
                  : '—'
                return (
                  <tr key={item.engineer_mail_source_id} style={{ borderBottom: '1px solid #f1f5f9', background: hasMatch ? '#f0fdf4' : undefined }}>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={checked.has(item.engineer_mail_source_id)}
                        onChange={() => onCheck(item.engineer_mail_source_id)}
                        disabled={item.badge === 'proposed'}
                        style={{ cursor: item.badge === 'proposed' ? 'not-allowed' : 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontWeight: 700, background: c.bg, color: c.text, borderRadius: 4, padding: '2px 6px' }}>
                        {rankLabel(item.score)}{item.score}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, background: badgeColor.bg, color: badgeColor.color, borderRadius: 4, padding: '2px 6px', display: 'inline-block', width: 'fit-content' }}>
                          {badgeLabel}
                        </span>
                        {hasMatch && (
                          <span style={{ fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '2px 6px', display: 'inline-block', width: 'fit-content' }}>
                            📊 対照表
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#111827' }}>
                      <div style={{ fontWeight: 600 }}>{item.name ?? '（未取得）'}</div>
                      {item.age && <div style={{ fontSize: 10, color: '#6b7280' }}>{item.age}歳</div>}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.affiliation ?? ''}>
                      {item.affiliation ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', maxWidth: 240 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {(item.skills ?? []).slice(0, 6).map((s, i) => (
                          <span key={i} style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, padding: '1px 5px' }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#374151' }}>{priceLabel}</td>
                    <td style={{ padding: '8px 10px', color: '#6b7280' }}>{item.available_from ?? '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#9ca3af', fontSize: 11 }}>{formatDate(item.received_at) ?? '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => onPropose(item)}
                        disabled={item.badge === 'proposed'}
                        style={{
                          fontSize: 11,
                          background: item.badge === 'proposed' ? '#e5e7eb' : '#2563eb',
                          color: item.badge === 'proposed' ? '#9ca3af' : '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: item.badge === 'proposed' ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {item.badge === 'proposed' ? '提案済' : '提案'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── カード表示 ──
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#6b7280' }}>
        📨 過去{days}日の受信メールから {items.length} 件の候補
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {sorted.map(item => {
          const c = rankColor(item.score)
          const hasMatch = matchedEmsIds.has(item.engineer_mail_source_id)
          const badgeLabel =
            item.badge === 'proposed' ? '提案済' :
            item.badge === 'registered' ? '登録済（未提案）' : '新規'
          const badgeColor =
            item.badge === 'proposed' ? { bg: '#fee2e2', color: '#991b1b' } :
            item.badge === 'registered' ? { bg: '#fef3c7', color: '#92400e' } :
            { bg: '#dcfce7', color: '#166534' }
          const priceLabel = item.unit_price_min || item.unit_price_max
            ? `${item.unit_price_min ?? '?'}〜${item.unit_price_max ?? '?'}万`
            : null
          return (
            <div
              key={item.engineer_mail_source_id}
              style={{
                background: '#fff',
                border: `1px solid ${hasMatch ? '#16a34a' : c.border}`,
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: hasMatch ? '0 0 0 2px rgba(22,163,74,0.15), 0 1px 3px rgba(0,0,0,0.05)' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {hasMatch && (
                <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, border: '1px solid #86efac' }}>
                  📊 対照表 生成済
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={checked.has(item.engineer_mail_source_id)}
                  onChange={() => onCheck(item.engineer_mail_source_id)}
                  disabled={item.badge === 'proposed'}
                  style={{ cursor: item.badge === 'proposed' ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, background: c.bg, color: c.text, borderRadius: 4, padding: '2px 8px' }}>
                  {rankLabel(item.score)} {item.score}点
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, background: badgeColor.bg, color: badgeColor.color, borderRadius: 4, padding: '2px 6px' }}>
                  {badgeLabel}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>
                  {formatDate(item.received_at)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {item.name ?? '（氏名未取得）'}
                  {item.age && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6, fontSize: 12 }}>{item.age}歳</span>}
                </div>
                {item.affiliation && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>🏢 {item.affiliation}</div>
                )}
              </div>
              {item.skills && item.skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {item.skills.slice(0, 8).map((s, i) => (
                    <span key={i} style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, padding: '1px 6px' }}>{s}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
                {priceLabel && <span>💴 {priceLabel}</span>}
                {item.available_from && <span>📅 {item.available_from}〜</span>}
                {item.nearest_station && <span>🚉 {item.nearest_station}</span>}
              </div>
              {item.reasons.length > 0 && (
                <div style={{ fontSize: 10, color: '#6b7280', borderTop: '1px dashed #e5e7eb', paddingTop: 6 }}>
                  {item.reasons.slice(0, 3).join(' / ')}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={item.email_subject ?? ''}>
                  📧 {item.email_subject ?? '—'}
                </div>
                <button
                  onClick={() => onPropose(item)}
                  disabled={item.badge === 'proposed'}
                  style={{
                    fontSize: 11,
                    background: item.badge === 'proposed' ? '#e5e7eb' : '#2563eb',
                    color: item.badge === 'proposed' ? '#9ca3af' : '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    cursor: item.badge === 'proposed' ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {item.badge === 'proposed' ? '提案済' : '提案メール作成'}
                </button>
              </div>
              {requirementMatchingEnabled && (
                <RequirementMatchAccordion
                  projectMailId={projectMailId}
                  emsId={item.engineer_mail_source_id}
                  prefetched={hasMatch}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────────────
export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  // docs/480 要件マッチング feature flag
  const user = useAuthStore(s => s.user)
  const requirementMatchingEnabled = !!user?.tenant?.feature_requirement_matching
  const [batchMatching, setBatchMatching] = useState(false)
  // 進捗パネル: 各 EMS ごとの状態
  type BatchProgressItem = { ems_id: number; name: string; status: 'pending' | 'running' | 'done' | 'error'; error?: string }
  const [batchProgress, setBatchProgress] = useState<BatchProgressItem[]>([])
  // バッチ生成済 EMS ID (カード/対照表ボタンの強調表示用)
  const matchedEmsIds = new Set(batchProgress.filter(p => p.status === 'done').map(p => p.ems_id))

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
  const [sourceFilter, setSourceFilter] = useState<'' | 'self' | 'bp'>('')
  // 鮮度マッチング機能（過去N日メール）
  const [freshMode, setFreshMode] = useState(false)
  const [freshDays, setFreshDays] = useState<number>(3)
  const [freshMinScore, setFreshMinScore] = useState<number>(70)
  const [freshItems, setFreshItems] = useState<FreshEms[]>([])
  const [freshLoading, setFreshLoading] = useState(false)
  const [freshChecked, setFreshChecked] = useState<Set<number>>(new Set())

  const visibleEngineers = engineers.filter(e => {
    if (excluded.has(e.engineer_id)) return false
    if (sourceFilter === 'self') return e.affiliation_type === 'self'
    if (sourceFilter === 'bp') return e.affiliation_type && e.affiliation_type !== 'self' && !e.engineer_mail_source_id
    return true
  })
  const allChecked = visibleEngineers.length > 0 && visibleEngineers.every(e => checked.has(e.engineer_id))

  const toggleCheck = (engId: number) => {
    setChecked(prev => {
      const n = new Set(prev)
      if (n.has(engId)) n.delete(engId)
      else n.add(engId)
      return n
    })
  }
  const toggleCheckAll = () => {
    if (allChecked) {
      setChecked(new Set())
    } else {
      setChecked(new Set(visibleEngineers.map(e => e.engineer_id)))
    }
  }

  // 鮮度モード用: 提案済を除いて全選択対象とする
  const selectableFreshItems = freshItems.filter(i => i.badge !== 'proposed')
  const allFreshChecked = selectableFreshItems.length > 0 && selectableFreshItems.every(i => freshChecked.has(i.engineer_mail_source_id))
  const toggleFreshCheck = (emsId: number) => {
    setFreshChecked(prev => {
      const n = new Set(prev)
      if (n.has(emsId)) n.delete(emsId)
      else n.add(emsId)
      return n
    })
  }
  const toggleFreshCheckAll = () => {
    if (allFreshChecked) {
      setFreshChecked(new Set())
    } else {
      setFreshChecked(new Set(selectableFreshItems.map(i => i.engineer_mail_source_id)))
    }
  }

  // docs/480 §10 Phase 4: スコア上位 5 件に対照表を一括生成 (個別 GET を逐次実行で進捗表示)
  const handleBatchMatch = async () => {
    if (selectableFreshItems.length === 0) return
    const top = [...selectableFreshItems].sort((a, b) => b.score - a.score).slice(0, 5)
    if (!confirm(`スコア上位 ${top.length} 件に対照表を生成します (Claude API 呼出・約 ${top.length * 8}秒)。よろしいですか?`)) return

    // 初期状態: 全件 pending
    const initial: BatchProgressItem[] = top.map(i => ({
      ems_id: i.engineer_mail_source_id,
      name: i.name ?? `EMS#${i.engineer_mail_source_id}`,
      status: 'pending',
    }))
    setBatchProgress(initial)
    setBatchMatching(true)

    // 逐次 GET (cache を効かせるため並列ではなく順次)
    for (let i = 0; i < top.length; i++) {
      const target = top[i]
      setBatchProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'running' } : p))
      try {
        await axios.get(`/api/v1/project-mails/${id}/requirement-match`, {
          params: { ems_id: target.engineer_mail_source_id },
          timeout: 120000,
        })
        setBatchProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done' } : p))
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } }; message?: string }
        const msg = err.response?.data?.message ?? err.message ?? '失敗'
        setBatchProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', error: msg } : p))
      }
    }
    setBatchMatching(false)
    // 結果はパネルに残す。閉じるのはユーザ操作で。
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

  // 鮮度マッチング: モード切替 / 日数変更時に過去N日の EMS を取得
  useEffect(() => {
    if (!id || !freshMode) return
    setFreshLoading(true)
    setFreshChecked(new Set())  // 件数/構成が変わるので選択をリセット
    axios.get(`/api/v1/project-mails/${id}/fresh-engineer-mails`, { params: { days: freshDays, min_score: freshMinScore } })
      .then(res => setFreshItems(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setFreshItems([]))
      .finally(() => setFreshLoading(false))
  }, [id, freshMode, freshDays, freshMinScore])

  // 鮮度マッチング: EMS から提案メール草稿を生成
  const handleGenerateProposalFromEms = (item: FreshEms) => {
    // 宛先名: メール本文の挨拶文 (「株式会社XXのYYと申します」等) から送信者名を抽出
    // 抽出できなければ from_address のローカル部分を使う (item.name は技術者本人なので使わない)
    const recipientName = extractSenderNameFromBody(item.email_body)
    const greeting = recipientName ? `${recipientName} 様` : '営業ご担当者様'
    const skillLine = (item.skills || []).slice(0, 5).join('／') || '—'
    const priceLine = item.unit_price_min || item.unit_price_max
      ? `${item.unit_price_min ?? ''}〜${item.unit_price_max ?? ''}万円`
      : '—'
    const mainContent = `先日いただいた技術者ご紹介メール（件名: ${item.email_subject ?? '—'}）について、弊社で進行中の以下案件にマッチしておりますのでご提案させていただきます。\n\n【ご紹介エンジニア】\n・${item.name ?? '（氏名未取得）'}（${item.age ? `${item.age}歳／` : ''}${item.affiliation ?? '所属未取得'}）\n　スキル：${skillLine}\n　希望単価：${priceLine}${buildProjectInfoBlock(mail)}\n\nご面談のご調整、もしくは類似案件のご紹介も可能でございます。お気軽にご返信ください。`
    const wrappedBody = buildEmailBody(greeting, mainContent, emailTemplate)
    setProposalDraft({
      subject: `【案件のご提案】${mail?.title ?? ''}`,
      body: wrappedBody,
      to_address: item.email_from_address ?? '',
      to_name: recipientName ?? '',
      engineer_name: item.name ?? '（氏名未取得）',
      project_mail_id: Number(id),
      engineer_mail_source_id: item.engineer_mail_source_id,
      original_mail_body: item.email_body,
      original_mail_label: '技術者ご紹介メール 本文',
    })
  }

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
      // Claude が生成した prose に、まとめて提案と同形式の ◇案件情報 ブロックを追記
      const mainContentWithBlock = (res.data.body ?? '') + buildProjectInfoBlock(mail)
      const wrappedBody = buildEmailBody(greeting, mainContentWithBlock, emailTemplate)
      setProposalDraft({ ...res.data, subject: `【技術者ご紹介】${mail?.title ?? ''}`, body: wrappedBody, engineer_name: eng.engineer_name, project_mail_id: Number(id), original_mail_body: pickMailBody(mail?.email), original_mail_label: '紹介元案件メール 本文' })
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 503) {
        alert('Claude API が混雑中です。少し待ってから再試行してください。')
      } else {
        alert('メール生成に失敗しました')
      }
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
        // 宛先は案件メールの送信元（案件をくれた相手）— 登録済/鮮度モード共通
        const initToName = (mail?.sales_contact || mail?.email?.from_name || '') + ' 様'
        const initTo     = mail?.email?.from_address ?? ''
        const initSubject = `【技術者ご紹介】${mail?.title ?? ''}`
        const greeting   = mail?.sales_contact || mail?.email?.from_name
          ? `${mail.sales_contact || mail.email?.from_name} 様`
          : '営業ご担当者様'
        let engineerLines = ''
        let selectedCount = 0
        if (freshMode) {
          const selected = freshItems.filter(i => freshChecked.has(i.engineer_mail_source_id))
          selectedCount = selected.length
          engineerLines = selected.map((i, idx) => {
            const skills = (i.skills ?? []).filter(Boolean).slice(0, 8).join('／')
            const price = priceStr(i.unit_price_min, i.unit_price_max)
            const block: string[] = []
            block.push(`■ ${idx + 1}人目`)
            block.push(`◇氏名：${i.name ?? '（氏名未取得）'}`)
            if (i.age) block.push(`◇年齢：${i.age}歳`)
            if (i.affiliation) block.push(`◇所属：${(i.affiliation_type === 'partner' ? '協力／' : i.affiliation_type === 'freelance' ? 'FL／' : '')}${i.affiliation}`)
            if (skills) block.push(`◇スキル：${skills}`)
            if (price) block.push(`◇希望単価：${price}/月`)
            if (i.available_from) block.push(`◇稼働開始：${i.available_from}`)
            if (i.nearest_station) block.push(`◇最寄駅：${i.nearest_station}`)
            return block.join('\n')
          }).join('\n\n')
        } else {
          const selected = engineers.filter(e => checked.has(e.engineer_id))
          selectedCount = selected.length
          engineerLines = selected.map((e, idx) => {
            const skills = e.skills.slice(0, 8).map(s => s.experience_years ? `${s.name}(${s.experience_years}y)` : s.name).join('／')
            const price = priceStr(e.desired_unit_price_min, e.desired_unit_price_max)
            const availLabel = AVAILABILITY_LABEL[e.availability_status ?? ''] ?? ''
            const availStr = [availLabel, e.available_from ? `${formatDate(e.available_from)}〜` : null].filter(Boolean).join(' ')
            const block: string[] = []
            block.push(`■ ${idx + 1}人目`)
            block.push(`◇氏名：${e.engineer_name}`)
            if (e.age) block.push(`◇年齢：${e.age}歳`)
            if (e.affiliation) block.push(`◇所属：${(e.affiliation_type === 'partner' ? '協力／' : e.affiliation_type === 'freelance' ? 'FL／' : '')}${e.affiliation}`)
            if (skills) block.push(`◇スキル：${skills}`)
            if (price) block.push(`◇希望単価：${price}/月`)
            if (availStr) block.push(`◇稼働：${availStr}`)
            if (e.work_style) block.push(`◇勤務形態：${e.work_style}`)
            return block.join('\n')
          }).join('\n\n')
        }
        const projectInfoBlock = buildProjectInfoBlock(mail)
        const mainContent = `この度は、貴社のご要件に対応可能なエンジニアをご紹介させていただきたく、ご連絡差し上げました。\n\n【ご紹介エンジニア（${selectedCount}名）】\n${engineerLines}${projectInfoBlock}\n\n各エンジニアのスキルシートをご要望の場合は、お気軽にご返信ください。\nまた、面談のご調整も随時承っております。`
        const initBody = buildEmailBody(greeting, mainContent, emailTemplate)
        return <BulkSendModal projectMailId={Number(id)} initialToName={initToName} initialTo={initTo} initialSubject={initSubject} initialBody={initBody} engineerCount={selectedCount} originalMailBody={pickMailBody(mail?.email)} onClose={() => setShowBulkSend(false)} />
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
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSourceFilter(opt.value); setFreshMode(false) }}
                style={{ padding: '5px 10px', border: 'none', borderLeft: opt.value ? '1px solid rgba(255,255,255,0.3)' : 'none', cursor: 'pointer', fontSize: 11, background: !freshMode && sourceFilter === opt.value ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: !freshMode && sourceFilter === opt.value ? 700 : 400 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* 鮮度マッチング: 過去N日メール (技術者画面と同じスタイル) */}
          <button
            onClick={() => setFreshMode(v => !v)}
            title="過去N日の受信メールから候補抽出"
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 11, background: freshMode ? 'rgba(255,255,255,0.35)' : 'transparent', color: '#fff', fontWeight: freshMode ? 700 : 400, flexShrink: 0 }}
          >
            📨 メール
          </button>
          {freshMode && (
            <>
              <select
                value={freshDays}
                onChange={e => setFreshDays(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
              >
                <option value={3} style={{ color: '#000' }}>過去3日</option>
                <option value={7} style={{ color: '#000' }}>過去7日</option>
                <option value={14} style={{ color: '#000' }}>過去14日</option>
                <option value={30} style={{ color: '#000' }}>過去30日</option>
              </select>
              <select
                value={freshMinScore}
                onChange={e => setFreshMinScore(Number(e.target.value))}
                title="マッチスコアの下限"
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
              >
                <option value={70} style={{ color: '#000' }}>高 (70+)</option>
                <option value={60} style={{ color: '#000' }}>中 (60+)</option>
                <option value={50} style={{ color: '#000' }}>低 (50+)</option>
              </select>
            </>
          )}
          {/* 全選択 / まとめて提案 (登録済モード / 鮮度モードで対象が切替わる。送信先は常に案件提供者) */}
          {freshMode ? (
            <>
              <button
                onClick={toggleFreshCheckAll}
                disabled={selectableFreshItems.length === 0}
                style={{ fontSize: 12, background: allFreshChecked ? '#6b7280' : 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 12px', cursor: selectableFreshItems.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 600, flexShrink: 0, opacity: selectableFreshItems.length === 0 ? 0.5 : 1 }}
              >
                {allFreshChecked ? '☑ 全解除' : '☐ 全選択'}
              </button>
              <button
                onClick={() => setShowBulkSend(true)}
                disabled={freshChecked.size === 0}
                style={{ fontSize: 12, background: freshChecked.size > 0 ? '#f59e0b' : '#d1d5db', border: 'none', color: freshChecked.size > 0 ? '#fff' : '#9ca3af', borderRadius: 6, padding: '5px 12px', cursor: freshChecked.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 600, flexShrink: 0 }}
              >
                📤 まとめて提案{freshChecked.size > 0 ? `（${freshChecked.size}名）` : ''}
              </button>
              {requirementMatchingEnabled && (
                <button
                  onClick={handleBatchMatch}
                  disabled={batchMatching || selectableFreshItems.length === 0}
                  title="スコア上位 5 件に対照表を一括生成 (Claude 呼出)"
                  style={{ fontSize: 12, background: batchMatching ? '#9ca3af' : 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 12px', cursor: batchMatching || selectableFreshItems.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, flexShrink: 0, opacity: selectableFreshItems.length === 0 ? 0.5 : 1 }}
                >
                  {batchMatching ? '⏳ 生成中...' : '📊 上位 5 件に対照表'}
                </button>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
          <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 10px', flexShrink: 0 }}>
            候補 {freshMode ? freshItems.length : visibleEngineers.length}名
            {!freshMode && proposedCount > 0 && <span style={{ marginLeft: 6, color: '#86efac' }}>提案 {proposedCount}名</span>}
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

      {/* 一括判定 進捗パネル (docs/480 Phase 4) */}
      {batchProgress.length > 0 && (
        <div style={{ margin: '12px 20px 0', padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#374151' }}>
              📊 対照表 一括生成
              {(() => {
                const done = batchProgress.filter(p => p.status === 'done').length
                const err = batchProgress.filter(p => p.status === 'error').length
                const total = batchProgress.length
                return <span style={{ marginLeft: 12, color: '#6b7280', fontWeight: 400 }}>{done}/{total} 完了{err > 0 ? `・${err} 失敗` : ''}</span>
              })()}
            </span>
            {!batchMatching && (
              <button onClick={() => setBatchProgress([])} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 4, cursor: 'pointer', color: '#6b7280' }}>
                ✕ 閉じる
              </button>
            )}
          </div>
          {/* 進捗バー */}
          <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
            <div
              style={{
                width: `${(batchProgress.filter(p => p.status === 'done' || p.status === 'error').length / batchProgress.length) * 100}%`,
                height: '100%',
                background: batchProgress.some(p => p.status === 'error') ? '#f59e0b' : '#16a34a',
                transition: 'width 0.3s',
              }}
            />
          </div>
          {/* 各 item の状態 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {batchProgress.map(p => (
              <div key={p.ems_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, textAlign: 'center', fontSize: 14 }}>
                  {p.status === 'pending' && '⋯'}
                  {p.status === 'running' && <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>}
                  {p.status === 'done' && '✅'}
                  {p.status === 'error' && '❌'}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280', minWidth: 80 }}>EMS #{p.ems_id}</span>
                <span style={{ fontSize: 12, color: p.status === 'error' ? '#dc2626' : '#374151', flex: 1 }}>
                  {p.name}
                  {p.status === 'error' && p.error && <span style={{ marginLeft: 8, fontSize: 10 }}>({p.error})</span>}
                </span>
              </div>
            ))}
          </div>
          {!batchMatching && batchProgress.every(p => p.status === 'done' || p.status === 'error') && (
            <div style={{ marginTop: 10, padding: '6px 10px', background: '#eff6ff', borderRadius: 4, fontSize: 11, color: '#1e40af' }}>
              💡 各カードの ▶ 対照表 ボタンで結果を確認できます (DB キャッシュ済 / Claude 呼出ゼロ)
            </div>
          )}
        </div>
      )}

      {/* 技術者リスト */}
      <div style={{ padding: '20px 20px 40px' }}>
        {freshMode ? (
          <FreshEmsList
            loading={freshLoading}
            items={freshItems}
            days={freshDays}
            viewMode={viewMode}
            onPropose={handleGenerateProposalFromEms}
            checked={freshChecked}
            onCheck={toggleFreshCheck}
            projectMailId={Number(id)}
            requirementMatchingEnabled={requirementMatchingEnabled}
            matchedEmsIds={matchedEmsIds}
          />
        ) : engineers.length === 0 ? (
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
