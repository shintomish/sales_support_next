'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  html: string
  className?: string
  highlight?: string  // 検索キーワード (空なら強調無し)
}

// iframe 内 DOM の text node を走査して term を <mark> でラップ。
// script/style/mark 配下は除外、case-insensitive 部分一致。
function highlightInDocument(doc: Document, term: string) {
  const t = term.trim()
  if (!t) return
  const lcTerm = t.toLowerCase()
  const root = doc.body
  if (!root) return

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (['SCRIPT', 'STYLE', 'MARK', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT
      const v = node.nodeValue ?? ''
      return v.toLowerCase().includes(lcTerm) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  const targets: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) targets.push(n as Text)

  for (const node of targets) {
    const text = node.nodeValue ?? ''
    const lc = text.toLowerCase()
    const frag = doc.createDocumentFragment()
    let i = 0
    while (i < text.length) {
      const idx = lc.indexOf(lcTerm, i)
      if (idx === -1) {
        frag.appendChild(doc.createTextNode(text.slice(i)))
        break
      }
      if (idx > i) frag.appendChild(doc.createTextNode(text.slice(i, idx)))
      const mark = doc.createElement('mark')
      mark.className = 'q-hl'
      mark.textContent = text.slice(idx, idx + t.length)
      frag.appendChild(mark)
      i = idx + t.length
    }
    node.parentNode?.replaceChild(frag, node)
  }
}

// iframe 内 DOM の text node を走査し、本文中の裸 URL (https?://…) を
// クリック可能な <a target="_blank"> に変換する。既存の <a>/script/style 配下は除外。
// HTML メールでも URL がテキストのまま (href 無し) 書かれているものが多く、
// そのままだとクリックできないため。プレーンテキスト側は renderMailBody が担当。
function linkifyInDocument(doc: Document) {
  const root = doc.body
  if (!root) return
  // renderMailBody と同じ URL パターン (空白・全角空白・引用符・各種括弧で停止)
  const urlRe = /https?:\/\/[^\s　"'<>「」【】）)]+/g

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (['A', 'SCRIPT', 'STYLE', 'MARK', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT
      return (node.nodeValue ?? '').includes('http') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  const targets: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) targets.push(n as Text)

  for (const node of targets) {
    const text = node.nodeValue ?? ''
    urlRe.lastIndex = 0
    if (!urlRe.test(text)) continue
    urlRe.lastIndex = 0
    const frag = doc.createDocumentFragment()
    let i = 0
    let m: RegExpExecArray | null
    while ((m = urlRe.exec(text)) !== null) {
      const idx = m.index
      if (idx > i) frag.appendChild(doc.createTextNode(text.slice(i, idx)))
      const a = doc.createElement('a')
      a.href = m[0]
      a.textContent = m[0]
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
      a.style.color = '#2563eb'
      a.style.textDecoration = 'underline'
      a.style.wordBreak = 'break-all'
      frag.appendChild(a)
      i = idx + m[0].length
    }
    if (i < text.length) frag.appendChild(doc.createTextNode(text.slice(i)))
    node.parentNode?.replaceChild(frag, node)
  }
}

export default function EmailHtmlFrame({ html, className = '', highlight }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(400)

  // html or highlight が変わったら一旦既定値にリセット → onLoad で実コンテンツの高さを再計算する。
  // setState を effect 内で呼ぶ意図的な使い方。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHeight(400) }, [html, highlight])

  const handleLoad = () => {
    const doc = ref.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    })
    // 本文中の裸 URL をクリック可能にする (href 無しのテキスト URL 対策)。highlight より先に実行。
    linkifyInDocument(doc)

    if (highlight && highlight.trim()) {
      // <mark> 用の最低限スタイルを iframe 内に注入 (Tailwind は iframe 内では効かない)
      const style = doc.createElement('style')
      style.textContent = 'mark.q-hl{background:#fef08a;color:inherit;padding:0 1px;border-radius:2px;}'
      doc.head?.appendChild(style)
      highlightInDocument(doc, highlight)
    }

    const h = doc.documentElement.scrollHeight
    if (h > 0) setHeight(h + 16)
  }

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={handleLoad}
      className={`w-full border-0 ${className}`}
      style={{ height: `${height}px` }}
    />
  )
}
