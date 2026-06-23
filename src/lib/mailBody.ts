function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // <br>, <br/>, <br style="...">, <br class="..."> など属性付きも全部改行に
    .replace(/<br\b[^>]*>/gi, '\n')
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
}

/**
 * 元メール本文取得: body_text 優先、空なら body_html を strip-tags してフォールバック。
 * HTML-only で取り込まれたメール (Kagoya IMAP 経由など、約7%) を表示するための共通処理。
 *
 * ただし body_text が "改行ほぼ無しの一塊" (HTML→text 変換に失敗したケース) の時は、
 * 改行情報を保持している body_html を strip し直したほうが読みやすいので
 * そちらを優先する。
 */
export function pickMailBody(
  email: { body_text: string | null; body_html: string | null } | null | undefined,
): string | null {
  if (!email) return null
  const text = (email.body_text ?? '').trim()
  const html = (email.body_html ?? '').trim()

  if (text) {
    const textNewlines = (text.match(/\n/g)?.length ?? 0)
    // 500文字超で改行密度が 250文字/改行 より低い = 一塊に潰れている
    const textCollapsed = text.length > 500 && textNewlines < text.length / 250
    if (!textCollapsed) return text
    // collapsed: html が改行情報を持っていればそちらを採用
    if (html) {
      const stripped = stripHtmlToText(html)
      const strippedNewlines = (stripped.match(/\n/g)?.length ?? 0)
      if (strippedNewlines > textNewlines * 3) return stripped || text
    }
    return text
  }

  if (!html) return null
  return stripHtmlToText(html) || null
}

/**
 * メール本文から差出人名を推測する。
 * - 末尾の署名ブロックから氏名らしき行を1つ抽出
 * - 「担当：○○」「○○ 様」「Name: ○○」等のパターンも拾う
 * - 取得不可なら null
 *
 * 本文を pickMailBody() で取得済みのプレーンテキストに対して使う想定。
 */
// 案件条件・定型句など「氏名ではない」語を弾くガード（"外国籍不可" 等の誤抽出防止）。
const NAME_BLOCKLIST_RE = /(不可|可否|以上|以下|前後|程度|歳|万円|円|ヶ月|カ月|即日|リモート|出社|常駐|経験|スキル|案件|募集|外国籍|日本語|英語|面談|単価|単金|期間|工程|勤務|場所|契約|言語|稼働|必須|歓迎|要員|時給|月給|可能|対応|連絡|確認|検討|大丈夫|同様|予定|別途|本日|明日|宜しく|よろしく|お願|御願|ありがとう|有難う|世話|担当|営業部|採用|参画|交代|交替|延長|新規|急募)/u

function isPlausiblePersonName(s: string): boolean {
  const t = s.replace(/[\s　]+/g, '')
  return t.length >= 2 && t.length <= 8 && !NAME_BLOCKLIST_RE.test(t)
}

export function extractRecipientName(body: string | null | undefined): string | null {
  if (!body) return null
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return null

  // 1) 「担当：山田太郎」「営業担当: ○○」
  for (const l of lines) {
    const m = l.match(/^(?:営業)?担当(?:者)?[：:]\s*([^\s<【\[（(]{2,15})/u)
    if (m && isPlausiblePersonName(m[1])) return m[1].trim()
  }

  // 1.5) 自己紹介の署名「(会社名)○○と申します／でございます／です」から氏名を抽出。
  //   「MKCソリューション内田です」→ 内田。[一-龯](漢字)のみなのでカタカナ社名は巻き込まない。
  //   と申します/でございます を優先、です は行末限定（文中の「〜です」の誤検出を避ける）。
  for (const l of lines) {
    const m = l.match(/([一-龯]{2,4})(?:と申します|でございます)/u)
    if (m && isPlausiblePersonName(m[1])) return m[1]
  }
  for (const l of lines) {
    const m = l.match(/([一-龯]{2,4})です[。.！!\s　]*$/u)
    if (m && isPlausiblePersonName(m[1])) return m[1]
  }

  // 2) 「山田 太郎 <foo@bar>」「山田太郎(yamada@bar)」
  for (const l of lines) {
    const m = l.match(/^([一-龯ぁ-んァ-ヶー々〆〤]{1,5}[\s　]?[一-龯ぁ-んァ-ヶー々〆〤]{1,5})\s*[<(（]/u)
    if (m && isPlausiblePersonName(m[1])) return m[1].replace(/\s+/g, ' ').trim()
  }

  // 3) 末尾署名: 下から見て「住所/TEL/FAX/MAIL/URL/会社名」より上の氏名行
  const tail = lines.slice(-15)
  const excludeRe = /(@|https?:|tel|fax|mail|mobile|url|〒|〶|株式会社|有限会社|合同会社|事業部|本社|支店|営業所|^\d|\d{2,}-\d{2,})/i
  for (let i = tail.length - 1; i >= 0; i--) {
    const l = tail[i]
    if (excludeRe.test(l)) continue
    // 「山田 太郎」「山田太郎」「ヤマダ タロウ」「Yamada Taro」
    const jp = l.match(/^([一-龯ぁ-んァ-ヶー々〆〤]{2,6}[\s　]?[一-龯ぁ-んァ-ヶー々〆〤]{1,6})$/u)
    if (jp && isPlausiblePersonName(jp[1])) return jp[1].replace(/\s+/g, ' ').trim()
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
