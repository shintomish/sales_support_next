'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { hoursToHhmm, hhmmToHours } from '@/lib/hours';

/**
 * 精算条件の時間（控除/超過時間）を hh:mm で入力するコンポーネント。
 *
 * - 親が保持する値は decimal 時間の文字列（"8.5" / "140"）のまま（保存ロジック非干渉）。
 * - 表示・入力は hh:mm。編集中はローカルテキストを保持し、有効なら decimal を親へ通知。
 * - blur 時に正規化（"8:3" → "8:03"、不正は直前の有効値へ戻す）。
 */
export function HhmmInput({
  value,
  onChange,
  className,
  placeholder = 'hh:mm',
}: {
  value: string | number | null | undefined;
  onChange: (decimalHours: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => hoursToHhmm(value));
  const [focused, setFocused] = useState(false);

  // 外部値の変更（API ロード等）を反映。編集中は上書きしない。
  useEffect(() => {
    if (!focused) setText(hoursToHhmm(value));
  }, [value, focused]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      className={className}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const dec = hhmmToHours(t);
        if (dec !== null) onChange(dec); // 有効入力のみ親へ反映
      }}
      onBlur={() => {
        setFocused(false);
        const dec = hhmmToHours(text);
        if (dec === '') {
          onChange('');
          setText('');
        } else if (dec !== null) {
          onChange(dec);
          setText(hoursToHhmm(dec));
        } else {
          // 不正入力は直前の有効値（親の value）へ戻す
          setText(hoursToHhmm(value));
        }
      }}
    />
  );
}
