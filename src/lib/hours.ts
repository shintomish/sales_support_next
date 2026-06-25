/**
 * 精算条件の時間フィールド（控除時間/超過時間）の表示・入力ヘルパー。
 *
 * DB は decimal(6,2)（時間の小数。例: 8.5 = 8時間30分, 140 = 140時間）で保持する。
 * UI では hh:mm 形式で表示・入力するため、相互変換する。
 *
 * decimal(6,2) は分に換算すると最近接の分へ丸めて往復可能（例: 8:30↔8.5, 0:10↔0.17）。
 */

/** decimal 時間（"8.5" / 140 / null）→ "h:mm"（"8:30" / "140:00"）。空・無効は ''。 */
export function hoursToHhmm(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const f = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(f)) return '';
  const sign = f < 0 ? '-' : '';
  const abs = Math.abs(f);
  let h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

/**
 * "h:mm" / "h"（分省略可）→ decimal 時間の文字列（"8.5"）。
 * 空文字は '' を返す。形式不正は null（呼び出し側で無視できる）。
 */
export function hhmmToHours(input: string): string | null {
  const t = (input ?? '').trim();
  if (t === '') return '';
  // "H" / "H:M" / "H:MM"（分は 0〜59）
  const m = t.match(/^(\d+)(?::([0-5]?\d))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] != null ? parseInt(m[2], 10) : 0;
  const dec = h + min / 60;
  return (Math.round(dec * 100) / 100).toString();
}
