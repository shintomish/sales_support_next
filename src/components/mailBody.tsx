import React from 'react'

// メール本文(プレーンテキスト)の共通レンダラ。
//  - 本文中の https?:// URL をクリック可能な <a target="_blank"> にする
//  - keywords をハイライト(<mark>)する。URL 部分はハイライト対象外
//    (cc.php → PHP / .go.jp → go 等の誤マッチを防ぐ)
// emails / project-mails / engineer-mails / 自社タブ の本文表示で共用する。
// 以前は各ページの highlightBody() に重複実装されていたものを集約 (URL リンク化を追加)。
const DEFAULT_MARK: React.CSSProperties = { background: '#fef08a', borderRadius: 2, padding: '0 1px' }

export function renderMailBody(
  text: string,
  keywords: string[] = [],
  markStyle: React.CSSProperties = DEFAULT_MARK,
): React.ReactNode {
  const kws = keywords.filter(k => k.length >= 2)

  // URL でセグメント分割
  const urlPattern = /https?:\/\/[^\s　"'<>「」【】）)]+/g
  const segments: { text: string; isUrl: boolean }[] = []
  let lastIndex = 0
  for (const m of text.matchAll(urlPattern)) {
    const idx = m.index ?? 0
    if (idx > lastIndex) segments.push({ text: text.slice(lastIndex, idx), isUrl: false })
    segments.push({ text: m[0], isUrl: true })
    lastIndex = idx + m[0].length
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isUrl: false })

  // キーワードのハイライト用パターン(前後がアルファベット/数字/スラッシュ/ドットに
  // 隣接する場合はマッチさせない = URL 断片・パスへの誤マッチ防止)
  const kwPattern = kws.length
    ? new RegExp(
        `(?<![a-zA-Z0-9/.])(${kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-zA-Z0-9/.])`,
        'gi'
      )
    : null

  return segments.flatMap((seg, si) => {
    if (seg.isUrl) {
      return [
        <a
          key={`u-${si}`}
          href={seg.text}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all hover:text-blue-800"
        >
          {seg.text}
        </a>,
      ]
    }
    if (!kwPattern) return [seg.text]
    const parts = seg.text.split(kwPattern)
    return parts.map((part, pi) =>
      kws.some(k => k.toLowerCase() === part.toLowerCase())
        ? <mark key={`${si}-${pi}`} style={markStyle}>{part}</mark>
        : part
    )
  })
}
