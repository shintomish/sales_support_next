'use client'

// 「自社」タブの共有ビュー（営業打ち合わせ 2026-05-25 §要望1 + E-4 2026-05-27）。
// 自社 = to_address が当社 xxx@aizen-sol.co.jp（catch-all の outsource@ は除外＝その他扱い、[spam] も除外）。
// 宛先（担当者 = to のローカル部）で絞り込み、件名・送信者・本文で検索できる。
// /emails・/project-mails・/engineer-mails の3画面で使い回す。
// E-4: 右ペインに返信フォーム（Cc/Bcc/添付対応）。POST /api/v1/emails/{id}/reply で送信。
import { useState, useEffect, useCallback, useRef } from 'react'
import axios from '@/lib/axios'
import EmailHtmlFrame from '@/components/EmailHtmlFrame'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useStaleResponseGuard } from '@/hooks/useStaleResponseGuard'
import { useResizableSplit } from '@/hooks/useResizableSplit'

type Attachment = { id: number; filename: string; mime_type: string | null; size: number | null }
type MailRow = {
  id: number
  subject: string | null
  from_address: string | null
  from_name: string | null
  to_address: string | null
  body_html: string | null
  body_text: string | null
  received_at: string
  is_read: boolean
  attachments_count?: number
  // 一斉配信(delivery_campaigns) への返信の場合、紐付け元 campaign 情報（バックエンド EmailController::index が付与）
  reply_to_campaign_id?: number | null
  reply_to_campaign_subject?: string | null
}

// メール署名テンプレート（/api/v1/email-body-templates/me から取得）
type EmailBodyTemplate = {
  name: string
  name_en: string | null
  department: string | null
  position: string | null
  email: string | null
  mobile: string | null
  body_text?: string | null
}

function formatSize(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// project-mails / engineer-mails 同等の署名生成。テンプレ body_text に「（本文）」マーカーがあれば
// その後ろを署名として使う。なければ固定フォーマットで生成。
function buildSignature(tpl: EmailBodyTemplate | null): string {
  if (!tpl) return ''
  if (tpl.body_text) {
    const idx = tpl.body_text.indexOf('（本文）')
    if (idx >= 0) return tpl.body_text.slice(idx + '（本文）'.length).replace(/^\s*\n/, '')
  }
  return `_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/
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
}

// 返信本文の初期値: 宛名 + > 引用 + 署名
function buildReplyBody(recipientName: string, originalBody: string, tpl: EmailBodyTemplate | null): string {
  const greeting = recipientName ? `${recipientName}様\n\n\n` : ''
  const quoted = originalBody
    ? originalBody.replace(/\r\n/g, '\n').split('\n').map(l => `> ${l}`).join('\n')
    : ''
  const sig = buildSignature(tpl)
  return `${greeting}${quoted}${sig ? `\n\n${sig}` : ''}`
}

// "a@x.com, b@y.com  c@z.com" → ["a@x.com", "b@y.com", "c@z.com"]（空要素除去）
function parseRecipients(raw: string): string[] {
  return raw.split(/[\s,;]+/).map(s => s.trim()).filter(s => s.length > 0)
}

type Owner = { owner: string; count: number }
type Paginated = { data: MailRow[]; current_page: number; last_page: number; total: number }

// 選択値: 'self:'=自社全担当者 / 'self:<owner>'=自社の特定担当者
const ALL_SELF = 'self:'

type ReplyForm = {
  to: string
  cc: string         // カンマ/スペース区切り入力
  bcc: string        // カンマ/スペース区切り入力
  subject: string
  body: string
  files: File[]
}

export default function SelfMailsView() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [sel, setSel] = useState<string>(ALL_SELF)
  const [list, setList] = useState<Paginated | null>(null)
  const [selected, setSelected] = useState<MailRow | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')           // 入力中（未確定）
  const [appliedSearch, setAppliedSearch] = useState('') // Enter/🔍 で確定
  const [searchBody, setSearchBody] = useState(false)  // 本文も検索
  const [attachments, setAttachments] = useState<Attachment[]>([]) // 選択メールの添付（詳細取得で埋める）
  // 返信フォーム (E-4)
  const [replyForm, setReplyForm] = useState<ReplyForm | null>(null)
  const [replySending, setReplySending] = useState(false)
  const [replyMsg, setReplyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailTemplate, setEmailTemplate] = useState<EmailBodyTemplate | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── ペイン分割幅 (ドラッグでリサイズ。localStorage で永続化) ──
  const split = useResizableSplit('selfMailsView:leftPct')

  useEffect(() => {
    axios.get('/api/v1/emails/self-owners')
      .then(res => setOwners(res.data.owners ?? []))
      .catch(() => {})
    // 返信本文に挿入する署名テンプレート
    axios.get('/api/v1/email-body-templates/me')
      .then(res => { if (res.data) setEmailTemplate(res.data) })
      .catch(() => {})
  }, [])

  const fetchList = useCallback(() => {
    setLoading(true)
    // 自社 = to_address が当社 xxx@aizen-sol.co.jp（outsource@ 除く・spam 除外）。
    //   全担当者 = mail_scope=self / 特定担当者 = self_owner。
    const scope = sel === ALL_SELF
      ? { mail_scope: 'self' }
      : { self_owner: sel.slice(ALL_SELF.length) }
    axios.get('/api/v1/emails', {
      params: { ...scope, page, per_page: 30, search: appliedSearch || undefined, search_body: searchBody || undefined },
    })
      .then(res => setList(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sel, page, appliedSearch, searchBody])

  useEffect(() => { fetchList() }, [fetchList])

  // 連続クリック時の async race 対策 (docs/730 §High #5):
  // 古いレスポンスが新しい選択を上書きしないよう、選択 id を hook で追跡。
  const selectGuard = useStaleResponseGuard<number>()

  // 行選択: 本文は一覧データに含まれるが添付一覧は詳細取得が必要
  // 別メール選択時は返信フォームを閉じる (誤送信防止)
  const openMail = (m: MailRow) => {
    selectGuard.mark(m.id)
    setSelected(m)
    setAttachments([])
    setReplyForm(null)
    setReplyMsg(null)
    if (m.attachments_count && m.attachments_count > 0) {
      axios.get(`/api/v1/emails/${m.id}`)
        .then(res => {
          if (selectGuard.isStale(m.id)) return
          setAttachments(res.data.attachments ?? [])
        })
        .catch(() => {})
    }
  }

  // 返信フォームを開く (E-4)
  const openReply = () => {
    if (!selected) return
    setReplyMsg(null)
    setReplyForm({
      to: selected.from_address ?? '',
      cc: '',
      bcc: '',
      subject: (selected.subject ?? '').startsWith('Re:') ? (selected.subject ?? '') : `Re: ${selected.subject ?? ''}`,
      body: buildReplyBody(selected.from_name ?? '', selected.body_text ?? '', emailTemplate),
      files: [],
    })
  }

  const addReplyFiles = (filesList: FileList | File[] | null) => {
    if (!filesList) return
    const arr = Array.from(filesList)
    setReplyForm(f => f ? { ...f, files: [...f.files, ...arr] } : f)
  }

  const removeReplyFile = (index: number) => {
    setReplyForm(f => f ? { ...f, files: f.files.filter((_, i) => i !== index) } : f)
  }

  // 返信送信 (POST /api/v1/emails/{id}/reply, multipart)
  const sendReply = async () => {
    if (!selected || !replyForm) return
    if (!replyForm.to.trim()) { setReplyMsg({ type: 'err', text: '宛先(to)を入力してください' }); return }
    if (!replyForm.subject.trim()) { setReplyMsg({ type: 'err', text: '件名を入力してください' }); return }
    if (!replyForm.body.trim()) { setReplyMsg({ type: 'err', text: '本文を入力してください' }); return }

    setReplySending(true)
    setReplyMsg(null)
    try {
      const fd = new FormData()
      fd.append('to', replyForm.to.trim())
      fd.append('subject', replyForm.subject)
      fd.append('body', replyForm.body)
      for (const cc of parseRecipients(replyForm.cc)) fd.append('cc[]', cc)
      for (const bcc of parseRecipients(replyForm.bcc)) fd.append('bcc[]', bcc)
      for (const file of replyForm.files) fd.append('attachments[]', file)
      await axios.post(`/api/v1/emails/${selected.id}/reply`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReplyMsg({ type: 'ok', text: '返信を送信しました' })
      setReplyForm(null)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setReplyMsg({ type: 'err', text: err.response?.data?.message ?? '送信に失敗しました' })
    } finally {
      setReplySending(false)
    }
  }

  const downloadAttachment = async (emailId: number, att: Attachment) => {
    const res = await axios.get(`/api/v1/emails/${emailId}/attachments/${att.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: att.mime_type ?? 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url
    a.download = att.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div ref={split.containerRef} className="flex h-full min-h-0">
      {/* 左ペイン: 宛先 + 検索 + 一覧 */}
      <div className="flex flex-col min-h-0 border-r border-gray-200"
           style={{ width: `${split.leftPct}%` }}>
        {/* 宛先（担当者）ドロップダウン */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-200">
          <label className="text-xs text-gray-500 flex-shrink-0">宛先</label>
          <select
            value={sel}
            onChange={e => { setSel(e.target.value); setPage(1); setSelected(null) }}
            className="flex-1 min-w-0 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value={ALL_SELF}>全担当者</option>
            {owners.map(o => (
              <option key={o.owner} value={`${ALL_SELF}${o.owner}`}>{o.owner}（{o.count}）</option>
            ))}
          </select>
          {list && <span className="text-xs text-gray-400 flex-shrink-0">{list.total.toLocaleString()} 件</span>}
        </div>

        {/* 検索（件名・送信者、本文も検索可） */}
        <form
          onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); setPage(1); setSelected(null) }}
          className="px-3 py-2 border-b border-gray-200 space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value) { setAppliedSearch(''); setPage(1) } }}
              placeholder={searchBody ? '件名・送信者・本文で検索' : '件名・送信者で検索'}
              className="flex-1 min-w-0 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button type="submit" className="flex-shrink-0 px-2.5 py-1.5 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700">🔍</button>
          </div>
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={searchBody} onChange={e => { setSearchBody(e.target.checked); setPage(1) }} className="rounded" />
            本文も検索
          </label>
        </form>

        {/* 一覧 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && <p className="p-3 text-xs text-gray-400">読み込み中...</p>}
          {list?.data.map(m => (
            <button
              key={m.id}
              onClick={() => openMail(m)}
              className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${selected?.id === m.id ? 'bg-teal-100 border-l-2 border-l-teal-500 ring-1 ring-inset ring-teal-300' : ''}`}
            >
              <div className="flex items-center gap-2">
                {!m.is_read && <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />}
                <span className="text-xs text-gray-500 truncate">{m.from_name || m.from_address}</span>
                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                  {new Date(m.received_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-800 truncate mt-0.5">{m.attachments_count ? '📎 ' : ''}{m.subject || '(件名なし)'}</p>
              {m.reply_to_campaign_id && (
                <p className="text-[10px] text-teal-700 truncate mt-0.5">↳ 一斉配信 #{m.reply_to_campaign_id} への返信</p>
              )}
            </button>
          ))}
          {list && list.data.length === 0 && !loading && (
            <p className="p-3 text-xs text-gray-400">該当するメールがありません</p>
          )}
          {list && list.last_page > 1 && (
            <div className="flex items-center justify-center gap-2 p-2 text-xs text-gray-600">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">前</button>
              <span>{list.current_page} / {list.last_page}</span>
              <button disabled={page >= list.last_page} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">次</button>
            </div>
          )}
        </div>
      </div>

      {/* リサイザー (ドラッグで左右ペイン幅を変更)。自社タブは md 未満でも2ペインなので常時表示 */}
      <ResizeHandle dragging={split.dragging} onStart={split.startDragging} onReset={split.reset} className="" />

      {/* 右ペイン: 詳細 */}
      <div className="overflow-y-auto p-4 flex-1 min-w-0">
        {selected ? (
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{selected.subject || '(件名なし)'}</p>
            <p className="text-xs text-gray-500 mb-1">{selected.from_name} &lt;{selected.from_address}&gt;</p>
            <p className="text-xs text-gray-400 mb-1">
              {new Date(selected.received_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
            {selected.reply_to_campaign_id && (
              <a
                href={`/deliveries/campaigns/${selected.reply_to_campaign_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mb-3 text-xs text-teal-700 hover:text-teal-900 hover:underline"
              >
                ↳ 一斉配信 #{selected.reply_to_campaign_id}
                {selected.reply_to_campaign_subject ? `「${selected.reply_to_campaign_subject}」` : ''} への返信
              </a>
            )}
            {!selected.reply_to_campaign_id && <div className="mb-2" />}
            {attachments.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-medium text-amber-700 mb-2">📎 添付ファイル（{attachments.length}件）</p>
                <div className="space-y-1.5">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-700 truncate">
                        {att.filename}{att.size ? `（${formatSize(att.size)}）` : ''}
                      </span>
                      <button
                        onClick={() => downloadAttachment(selected.id, att)}
                        className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded hover:bg-blue-50"
                      >
                        DL
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.body_html
              ? <EmailHtmlFrame html={selected.body_html} />
              : <pre className="text-sm whitespace-pre-wrap text-gray-800 font-sans">{selected.body_text}</pre>}

            {/* 返信エリア (E-4 2026-05-27) */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {replyMsg && (
                <p className={`text-xs mb-2 ${replyMsg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {replyMsg.text}
                </p>
              )}
              {!replyForm ? (
                <button
                  onClick={openReply}
                  className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700"
                >
                  ↩ 返信
                </button>
              ) : (
                <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700">返信</p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-12 flex-shrink-0">To</label>
                    <input
                      type="email"
                      value={replyForm.to}
                      onChange={e => setReplyForm(f => f ? { ...f, to: e.target.value } : f)}
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-12 flex-shrink-0">Cc</label>
                    <input
                      type="text"
                      value={replyForm.cc}
                      onChange={e => setReplyForm(f => f ? { ...f, cc: e.target.value } : f)}
                      placeholder="カンマ区切り (任意)"
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-12 flex-shrink-0">Bcc</label>
                    <input
                      type="text"
                      value={replyForm.bcc}
                      onChange={e => setReplyForm(f => f ? { ...f, bcc: e.target.value } : f)}
                      placeholder="カンマ区切り (任意)"
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-12 flex-shrink-0">件名</label>
                    <input
                      type="text"
                      value={replyForm.subject}
                      onChange={e => setReplyForm(f => f ? { ...f, subject: e.target.value } : f)}
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <textarea
                    value={replyForm.body}
                    onChange={e => setReplyForm(f => f ? { ...f, body: e.target.value } : f)}
                    rows={12}
                    className="w-full text-xs font-mono border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />

                  {/* 添付ファイル (D&D 対応) */}
                  <div
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (!dropOver) setDropOver(true) }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDropOver(true) }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDropOver(false) }}
                    onDrop={e => {
                      e.preventDefault(); e.stopPropagation(); setDropOver(false)
                      if (e.dataTransfer?.files?.length) addReplyFiles(e.dataTransfer.files)
                    }}
                    className={`space-y-1.5 rounded border-2 border-dashed p-2 transition-colors ${
                      dropOver ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        添付ファイル ({replyForm.files.length})
                        <span className="ml-2 text-gray-400">— ここにファイルをドロップ</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + ファイル追加
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={e => { addReplyFiles(e.target.files); if (e.target) e.target.value = '' }}
                      />
                    </div>
                    {replyForm.files.length > 0 && (
                      <ul className="space-y-1">
                        {replyForm.files.map((file, i) => (
                          <li key={i} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1">
                            <span className="truncate">{file.name}（{formatSize(file.size)}）</span>
                            <button
                              type="button"
                              onClick={() => removeReplyFile(i)}
                              className="flex-shrink-0 text-red-500 hover:text-red-700 ml-2"
                            >×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={replySending}
                      className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
                    >
                      {replySending ? '送信中...' : '送信'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReplyForm(null); setReplyMsg(null) }}
                      disabled={replySending}
                      className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">メールを選択してください</p>
        )}
      </div>
    </div>
  )
}
