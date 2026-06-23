'use client'

import { useState } from 'react'
import { renderMailBody } from '@/components/mailBody'

/**
 * 提案メールモーダル等で、元メール本文を ▼ で開閉表示するアコーディオン。
 * body が空/null の場合は何もレンダリングしない。
 */
export default function OriginalMailAccordion({
  body,
  label = '元メール本文',
}: {
  body: string | null | undefined
  label?: string
}) {
  const [open, setOpen] = useState(false)
  if (!body || !body.trim()) return null
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent',
          border: 'none', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>📧 {label}</span>
        <span style={{ color: '#9ca3af', fontSize: 11 }}>{open ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '8px 12px 12px', fontSize: 11, lineHeight: 1.6,
          color: '#4b5563', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          borderTop: '1px solid #e5e7eb', maxHeight: 240, overflowY: 'auto', fontFamily: 'inherit',
        }}>
          {renderMailBody(body, [])}
        </pre>
      )}
    </div>
  )
}
