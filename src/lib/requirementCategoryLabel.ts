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
 * 対照表を Markdown 表 (Phase 3 の提案メール本文挿入用) に変換。
 * スキル対照表と契約条件チェックを 2 つの見出しで分離する。
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
    const evidence = (m.evidence ?? '').replace(/\|/g, '\\|').slice(0, 80)
    const row = `| ${r.label} | ${mustWant} | ${mark} | ${evidence} |`
    if (isSkillCategory(r.category)) {
      skillRows.push(row)
    } else {
      contractRows.push(row)
    }
  }

  const header = '| 要件 | 必須/尚可 | 判定 | 根拠 |\n|------|----------|:---:|------|'

  let out = ''
  if (skillRows.length > 0) {
    out += '## スキル対照表\n\n' + header + '\n' + skillRows.join('\n') + '\n\n'
  }
  if (contractRows.length > 0) {
    out += '## 契約条件チェック\n\n' + header + '\n' + contractRows.join('\n') + '\n'
  }
  return out.trim()
}
