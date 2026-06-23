'use client'

import { useState } from 'react'

type Kind = 'plus' | 'minus' | 'neutral'

// score_reasons の生コード（project_a / lang:Java / domain:host:+20(..) 等）を
// 読みやすい日本語ラベル＋加点/減点の種別に変換する。案件/技術者 両方の語彙に対応。
// ※個別キーワードの点数はスコアリングが保持していないため数値は出さない（domain 加点のみ実値）。
export function formatScoreReason(reason: string): { label: string; kind: Kind } {
  // domain:kaizentech.co.jp:+20(96%/1918件)
  if (reason.startsWith('domain:')) {
    const parts = reason.replace('domain:', '').split(':')
    const host = parts[0]
    const detail = parts[1] ?? ''
    return { label: `🏢 ドメイン信頼度 ${host} ${detail}`, kind: detail.startsWith('-') ? 'minus' : 'plus' }
  }

  const idx = reason.indexOf(':')
  const prefix = idx === -1 ? reason : reason.slice(0, idx)
  const val = idx === -1 ? '' : reason.slice(idx + 1)

  // 値を持たない固定ラベル
  const fixed: Record<string, { label: string; kind: Kind }> = {
    project_a: { label: '案件確度A（明示的な案件紹介）', kind: 'plus' },
    project_b: { label: '案件確度B（条件提示）', kind: 'plus' },
    project_c: { label: '案件確度C', kind: 'plus' },
    price_concrete: { label: '単価が具体的', kind: 'plus' },
    has_attachment: { label: '添付（スキルシート等）あり', kind: 'plus' },
    no_unit_price: { label: '希望単価の記載なし', kind: 'minus' },
    unit_price_too_low: { label: '希望単価が低い（35万円未満）', kind: 'minus' },
    excluded: { label: '除外対象', kind: 'minus' },
  }
  if (fixed[prefix]) return fixed[prefix]

  // 「ラベル：値」型
  const valLabel: Record<string, { label: string; kind: Kind }> = {
    lang: { label: '言語', kind: 'plus' },
    lang2: { label: '言語', kind: 'plus' },
    infra: { label: 'インフラ', kind: 'plus' },
    db: { label: 'DB', kind: 'plus' },
    tech: { label: 'スキル', kind: 'plus' },
    skill: { label: 'スキル', kind: 'plus' },
    engineer_kw: { label: '技術者情報', kind: 'plus' },
    location: { label: '勤務地', kind: 'plus' },
    process: { label: '工程', kind: 'plus' },
    timing: { label: '時期', kind: 'plus' },
    availability: { label: '稼働', kind: 'plus' },
    affiliation: { label: '所属', kind: 'neutral' },
  }
  if (valLabel[prefix]) {
    const m = valLabel[prefix]
    return { label: val ? `${m.label}：${val}` : m.label, kind: m.kind }
  }

  if (prefix.startsWith('penalty')) {
    return { label: `⚠ ${val || '減点要因'}`, kind: 'minus' }
  }

  return { label: reason, kind: 'neutral' }
}

export interface ScoreBreakdownItem { label: string; points: number }

/**
 * 右ペイン詳細用のスコア内訳ボタン。
 * 「▼ スコア内訳（N点）」をクリックで内訳を表示する。
 *  - breakdown（項目ごとの加点）があれば「項目 +N点」で点数まで表示し、合計も出す。
 *  - 無ければ（バックフィル未済の旧データ等）判定理由を読みやすいラベルで表示する（フォールバック）。
 */
export default function ScoreBreakdown({
  reasons,
  breakdown,
  score,
}: {
  reasons?: string[] | null
  breakdown?: ScoreBreakdownItem[] | null
  score?: number | null
}) {
  const [open, setOpen] = useState(false)
  const bd = (breakdown ?? []).filter(b => b && typeof b.points === 'number')
  const reasonList = reasons ?? []
  if (bd.length === 0 && reasonList.length === 0) return null

  const total = bd.reduce((s, b) => s + b.points, 0)

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
      >
        {open ? '▲ スコア内訳を隠す' : `▼ スコア内訳${score != null ? `（${score}点）` : ''}`}
      </button>
      {open && (
        bd.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1">
            {bd.map((b, i) => {
              const plus = b.points >= 0
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-700">{b.label}</span>
                  <span className={`font-semibold tabular-nums ${plus ? 'text-green-700' : 'text-red-600'}`}>
                    {plus ? '+' : ''}{b.points}点
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-between gap-2 text-xs border-t border-gray-200 mt-1 pt-1">
              <span className="text-gray-500">合計{score != null && score !== total ? '（上限調整前）' : ''}</span>
              <span className="font-bold tabular-nums text-blue-700">{total}点</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 mt-2">
            {reasonList.map((r, i) => {
              const f = formatScoreReason(r)
              const cls = f.kind === 'plus'
                ? 'bg-green-50 border-green-300 text-green-700'
                : f.kind === 'minus'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-gray-100 border-gray-200 text-gray-600'
              return (
                <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{f.label}</span>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
