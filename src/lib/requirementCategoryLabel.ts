// 案件要件 × 技術者スキル 対照表 (docs/480) のカテゴリ表示用ラベル。
// 内部 enum は英語 (DB 互換性)・UI 表示は和文。

export type RequirementCategory =
  | 'skill'
  | 'experience'
  | 'attitude'
  | 'location'
  | 'language'
  | 'contract'
  | 'other'

export type Judgment = 'circle' | 'triangle' | 'cross' | 'unknown'
export type Confidence = 'high' | 'medium' | 'low'
export type RequirementType = 'must' | 'want'

const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  skill:      'スキル',
  experience: '経験',
  attitude:   '姿勢',
  location:   '勤務地',
  language:   '言語',
  contract:   '契約',
  other:      'その他',
}

export function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return 'その他'
  return CATEGORY_LABEL[cat as RequirementCategory] ?? cat
}

/**
 * 「スキル対照表」グループに属するカテゴリかを判定 (docs/480 §15.3)。
 * - スキル対照表: skill / experience / attitude / language / other (技術者本人の能力評価)
 * - 契約条件チェック: contract / location (案件側フィルタ条件)
 */
export function isSkillCategory(cat: string | null | undefined): boolean {
  return ['skill', 'experience', 'attitude', 'language', 'other'].includes(cat ?? '')
}

const JUDGMENT_MARK: Record<Judgment, string> = {
  circle:   '◯',
  triangle: '△',
  cross:    '×',
  unknown:  '?',
}

const JUDGMENT_COLOR: Record<Judgment, string> = {
  circle:   '#16a34a', // green-600
  triangle: '#ca8a04', // yellow-600
  cross:    '#dc2626', // red-600
  unknown:  '#9ca3af', // gray-400
}

const JUDGMENT_BG: Record<Judgment, string> = {
  circle:   '#dcfce7', // green-100
  triangle: '#fef3c7', // yellow-100
  cross:    '#fee2e2', // red-100
  unknown:  '#f3f4f6', // gray-100
}

export function judgmentMark(j: string): string {
  return JUDGMENT_MARK[j as Judgment] ?? '?'
}

export function judgmentColor(j: string): string {
  return JUDGMENT_COLOR[j as Judgment] ?? JUDGMENT_COLOR.unknown
}

export function judgmentBg(j: string): string {
  return JUDGMENT_BG[j as Judgment] ?? JUDGMENT_BG.unknown
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high:   '高',
  medium: '中',
  low:    '低',
}

export function confidenceLabel(c: string | null | undefined): string {
  if (!c) return ''
  return CONFIDENCE_LABEL[c as Confidence] ?? c
}

/**
 * 対照表をプレーンテキストの箇条書き形式に整形 (提案メール本文挿入用)。
 * Markdown テーブルだとプレーンテキストメールクライアントで読みにくいため、
 * 「判定マーク + [必須/尚可] ラベル + 要件名 → 根拠」の縦長レイアウトを採用。
 */
export function formatMatchTableMarkdown(
  requirements: Array<{ type: string; label: string; category: string }>,
  matches: Array<{ label: string; judgment: string; evidence?: string | null; confidence?: string }>,
): string {
  const reqByLabel = new Map(requirements.map(r => [r.label, r]))

  const skillRows: string[] = []
  const contractRows: string[] = []

  for (const m of matches) {
    const r = reqByLabel.get(m.label)
    if (!r) continue
    const mustWant = r.type === 'must' ? '必須' : '尚可'
    const mark = judgmentMark(m.judgment)
    const evidence = (m.evidence ?? '').replace(/[\r\n]+/g, ' ').trim()
    const lines = [
      `  ${mark} [${mustWant}] ${r.label}`,
    ]
    if (evidence) {
      lines.push(`       根拠: ${evidence}`)
    }
    const block = lines.join('\n')
    if (isSkillCategory(r.category)) {
      skillRows.push(block)
    } else {
      contractRows.push(block)
    }
  }

  const sep = '─'.repeat(40)
  let out = ''
  if (skillRows.length > 0) {
    out += `■ スキル対照表\n${sep}\n${skillRows.join('\n\n')}\n`
  }
  if (contractRows.length > 0) {
    if (out) out += '\n'
    out += `■ 契約条件チェック\n${sep}\n${contractRows.join('\n\n')}\n`
  }
  return out.trim()
}

/**
 * insertMatchTableIntoBody が挿入したブロックを本文から除去する。
 *  パターン: \n\n {separator(48 dashes)}\n {対照表テキスト}\n {separator}\n {notice}\n\n
 * 一度挿入したものを toggle で確実に外せるよう、separator(─×48) で挟まれたブロックを 1 つ取り除く。
 */
export function removeMatchTableFromBody(body: string): string {
  // ─ を 48 個連続したブロックで対照表を識別 (notice の改行も含めて削除)
  const sep = '─'.repeat(48)
  const re = new RegExp(`\\n*${sep}\\n[\\s\\S]*?\\n${sep}\\n[^\\n]*\\n\\n?`)
  return body.replace(re, '\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * 提案メール本文の「closing/署名」直前に対照表ブロックを挿入する。
 *
 * 検出順 (前にあるものから優先):
 *  1. 署名区切り ("_/_/_/" / "━━━" / "─────")
 *  2. 締め定型句 ("お忙しいところ" / "ご検討" / "何卒よろしくお願い")
 *
 * 注意: "お気軽にご返信" "ご面談" は「面談やスキルシートのご要望がございましたら、
 *       お気軽にご返信ください。」のような **本文中の一文** に出てきやすく、
 *       その直前に対照表を入れると文を分断してしまうため marker に含めない。
 *       検出できなければ本文末尾に追加 (締めの文の後ろにくる)。
 */
export function insertMatchTableIntoBody(baseBody: string, matchTableText: string): string {
  const markers = [
    '_/_/_/',
    '━━━',
    '─────',
    'お忙しいところ',
    'ご検討いただけます',
    'ご検討のほど',
    '何卒よろしくお願い',
  ]
  let insertPos = baseBody.length
  for (const m of markers) {
    const i = baseBody.indexOf(m)
    if (i >= 0 && i < insertPos) insertPos = i
  }
  const head = baseBody.slice(0, insertPos).trimEnd()
  const tail = baseBody.slice(insertPos)
  const separator = '─'.repeat(48)
  const notice = '※ 本対照表は AI による自動判定の参考情報です。最終的な適性は貴社にてご判断ください。'
  return `${head}\n\n${separator}\n${matchTableText}\n${separator}\n${notice}\n\n${tail}`
}
