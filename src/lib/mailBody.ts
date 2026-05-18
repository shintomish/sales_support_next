/**
 * 元メール本文取得: body_text 優先、空なら body_html を strip-tags してフォールバック
 * HTML-only で取り込まれたメール (Kagoya IMAP 経由など、約7%) を表示するための共通処理
 */
export function pickMailBody(
  email: { body_text: string | null; body_html: string | null } | null | undefined,
): string | null {
  if (!email) return null
  const text = (email.body_text ?? '').trim()
  if (text) return text
  const html = email.body_html ?? ''
  if (!html.trim()) return null
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    // テーブルレイアウト対応: セル/行/見出しの区切りで改行
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<\/(tr|thead|tbody|table|p|div|li|h[1-6]|article|section|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return stripped || null
}

/**
 * メール本文から差出人名を推測する。
 * - 末尾の署名ブロックから氏名らしき行を1つ抽出
 * - 「担当：○○」「○○ 様」「Name: ○○」等のパターンも拾う
 * - 取得不可なら null
 *
 * 本文を pickMailBody() で取得済みのプレーンテキストに対して使う想定。
 */
export function extractRecipientName(body: string | null | undefined): string | null {
  if (!body) return null
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return null

  // 1) 「担当：山田太郎」「営業担当: ○○」
  for (const l of lines) {
    const m = l.match(/^(?:営業)?担当(?:者)?[：:]\s*([^\s<【\[（(]{2,15})/u)
    if (m) return m[1].trim()
  }

  // 2) 「山田 太郎 <foo@bar>」「山田太郎(yamada@bar)」
  for (const l of lines) {
    const m = l.match(/^([一-龯ぁ-んァ-ヶー々〆〤]{1,5}[\s　]?[一-龯ぁ-んァ-ヶー々〆〤]{1,5})\s*[<(（]/u)
    if (m) return m[1].replace(/\s+/g, ' ').trim()
  }

  // 3) 末尾署名: 下から見て「住所/TEL/FAX/MAIL/URL/会社名」より上の氏名行
  const tail = lines.slice(-15)
  const excludeRe = /(@|https?:|tel|fax|mail|mobile|url|〒|〶|株式会社|有限会社|合同会社|事業部|本社|支店|営業所|^\d|\d{2,}-\d{2,})/i
  for (let i = tail.length - 1; i >= 0; i--) {
    const l = tail[i]
    if (excludeRe.test(l)) continue
    // 「山田 太郎」「山田太郎」「ヤマダ タロウ」「Yamada Taro」
    const jp = l.match(/^([一-龯ぁ-んァ-ヶー々〆〤]{2,6}[\s　]?[一-龯ぁ-んァ-ヶー々〆〤]{1,6})$/u)
    if (jp) return jp[1].replace(/\s+/g, ' ').trim()
    const en = l.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)$/)
    if (en) return en[1]
  }

  return null
}

export interface EmailBodyTemplate {
  name: string
  name_en: string
  department: string
  position: string
  email: string
  mobile: string
  body_text?: string | null
}

/**
 * 提案メール本文の組み立て: テンプレ(設定ページで保存) があればそれを使い、
 * なければデフォルトの導入/署名で wrap する。
 */
export function buildEmailBody(
  greeting: string,
  mainContent: string,
  tpl: EmailBodyTemplate | null,
): string {
  if (tpl?.body_text) {
    return tpl.body_text
      .replace(/^.*?様\s*/u, `${greeting}\n\n`)
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
