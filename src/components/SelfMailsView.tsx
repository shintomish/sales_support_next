'use client'

// 「自社」タブの共有ビュー（営業打ち合わせ 2026-05-25 §要望1）。
// 自社 = to_address が当社 xxx@aizen-sol.co.jp（catch-all の outsource@ は除外＝その他扱い、[spam] も除外）。
// 宛先（担当者 = to のローカル部）で絞り込み、件名・送信者・本文で検索できる。
// /emails・/project-mails・/engineer-mails の3画面で使い回す。返信導線は E-2。
import { useState, useEffect, useCallback } from 'react'
import axios from '@/lib/axios'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import EmailHtmlFrame from '@/components/EmailHtmlFrame'

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
}

function formatSize(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
type Owner = { owner: string; count: number }
type Paginated = { data: MailRow[]; current_page: number; last_page: number; total: number }

// 選択値: 'self:'=自社全担当者 / 'self:<owner>'=自社の特定担当者
const ALL_SELF = 'self:'

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

  useEffect(() => {
    axios.get('/api/v1/emails/self-owners')
      .then(res => setOwners(res.data.owners ?? []))
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

  // 行選択: 本文は一覧データに含まれるが添付一覧は詳細取得が必要
  const openMail = (m: MailRow) => {
    setSelected(m)
    setAttachments([])
    if (m.attachments_count && m.attachments_count > 0) {
      axios.get(`/api/v1/emails/${m.id}`)
        .then(res => setAttachments(res.data.attachments ?? []))
        .catch(() => {})
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
    <div className="flex h-full min-h-0">
      {/* 左ペイン: 宛先 + 検索 + 一覧 */}
      <div className="w-1/2 flex flex-col min-h-0 border-r border-gray-200">
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
              className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${selected?.id === m.id ? 'bg-teal-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                {!m.is_read && <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />}
                <span className="text-xs text-gray-500 truncate">{m.from_name || m.from_address}</span>
                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                  {formatDistanceToNow(new Date(m.received_at), { addSuffix: true, locale: ja })}
                </span>
              </div>
              <p className="text-sm text-gray-800 truncate mt-0.5">{m.attachments_count ? '📎 ' : ''}{m.subject || '(件名なし)'}</p>
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

      {/* 右ペイン: 詳細 */}
      <div className="w-1/2 overflow-y-auto p-4">
        {selected ? (
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{selected.subject || '(件名なし)'}</p>
            <p className="text-xs text-gray-500 mb-3">{selected.from_name} &lt;{selected.from_address}&gt;</p>
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
          </div>
        ) : (
          <p className="text-xs text-gray-400">メールを選択してください</p>
        )}
      </div>
    </div>
  )
}
