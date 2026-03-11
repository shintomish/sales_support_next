// src/lib/validation.ts
// フロントエンド共通バリデーションユーティリティ

export type FieldErrors = Record<string, string>;

// ---- 個別ルール ----

export const rules = {
  required: (v: string, label: string) =>
    !v?.trim() ? `${label}は必須です` : '',

  maxLength: (v: string, max: number, label: string) =>
    v && v.length > max ? `${label}は${max}文字以内で入力してください` : '',

  email: (v: string) => {
    if (!v) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ? '' : 'メールアドレスの形式が正しくありません';
  },

  url: (v: string) => {
    if (!v) return '';
    try { new URL(v); return ''; }
    catch { return 'URLの形式が正しくありません（例: https://example.com）'; }
  },

  phone: (v: string) => {
    if (!v) return '';
    return /^[\d\-\+\(\)\s]+$/.test(v)
      ? '' : '電話番号の形式が正しくありません（例: 03-1234-5678）';
  },

  positiveInteger: (v: string, label: string) => {
    if (!v) return '';
    const n = Number(v);
    return Number.isInteger(n) && n >= 0
      ? '' : `${label}は0以上の整数で入力してください`;
  },

  numberRange: (v: string, min: number, max: number, label: string) => {
    if (!v) return '';
    const n = Number(v);
    if (isNaN(n)) return `${label}は数値で入力してください`;
    if (n < min) return `${label}は${min}以上で入力してください`;
    if (n > max) return `${label}は${max}以下で入力してください`;
    return '';
  },

  dateNotFuture: (v: string, label: string) => {
    if (!v) return '';
    return new Date(v) > new Date()
      ? `${label}は今日以前の日付を入力してください` : '';
  },

  dateAfter: (v: string, other: string, label: string, otherLabel: string) => {
    if (!v || !other) return '';
    return new Date(v) < new Date(other)
      ? `${label}は${otherLabel}以降の日付を入力してください` : '';
  },
};

// ---- ページ別バリデーター ----

export function validateCustomer(form: Record<string, string>): FieldErrors {
  const e: FieldErrors = {};
  const set = (k: string, msg: string) => { if (msg && !e[k]) e[k] = msg; };

  set('company_name', rules.required(form.company_name, '会社名'));
  set('company_name', rules.maxLength(form.company_name, 255, '会社名'));
  set('industry',     rules.maxLength(form.industry, 100, '業種'));
  set('phone',        rules.phone(form.phone));
  set('phone',        rules.maxLength(form.phone, 20, '電話番号'));
  set('website',      rules.url(form.website));
  set('employee_count', rules.positiveInteger(form.employee_count, '従業員数'));
  set('notes',        rules.maxLength(form.notes, 2000, '備考'));
  return e;
}

export function validateContact(form: Record<string, string>): FieldErrors {
  const e: FieldErrors = {};
  const set = (k: string, msg: string) => { if (msg && !e[k]) e[k] = msg; };

  set('customer_id', rules.required(form.customer_id, '顧客'));
  set('name',        rules.required(form.name, '氏名'));
  set('name',        rules.maxLength(form.name, 255, '氏名'));
  set('department',  rules.maxLength(form.department, 100, '部署'));
  set('position',    rules.maxLength(form.position, 100, '役職'));
  set('email',       rules.email(form.email));
  set('phone',       rules.phone(form.phone));
  set('notes',       rules.maxLength(form.notes, 2000, '備考'));
  return e;
}

export function validateDeal(form: Record<string, string>): FieldErrors {
  const e: FieldErrors = {};
  const set = (k: string, msg: string) => { if (msg && !e[k]) e[k] = msg; };

  set('customer_id', rules.required(form.customer_id, '顧客'));
  set('title',       rules.required(form.title, '商談名'));
  set('title',       rules.maxLength(form.title, 255, '商談名'));
  set('status',      rules.required(form.status, 'ステータス'));
  set('amount',      rules.numberRange(form.amount, 0, 999999999999, '金額'));
  set('probability', rules.numberRange(form.probability, 0, 100, '成約確度'));
  set('actual_close_date', rules.dateAfter(
    form.actual_close_date, form.expected_close_date,
    '実際の成約日', '予定成約日'
  ));
  set('notes', rules.maxLength(form.notes, 2000, '備考'));
  return e;
}

export function validateActivity(form: Record<string, string>): FieldErrors {
  const e: FieldErrors = {};
  const set = (k: string, msg: string) => { if (msg && !e[k]) e[k] = msg; };

  set('customer_id',   rules.required(form.customer_id, '顧客'));
  set('type',          rules.required(form.type, '活動種別'));
  set('subject',       rules.required(form.subject, '件名'));
  set('subject',       rules.maxLength(form.subject, 255, '件名'));
  set('activity_date', rules.required(form.activity_date, '活動日'));
  set('activity_date', rules.dateNotFuture(form.activity_date, '活動日'));
  set('content',       rules.maxLength(form.content, 5000, '内容'));
  return e;
}

export function validateTask(form: Record<string, string>): FieldErrors {
  const e: FieldErrors = {};
  const set = (k: string, msg: string) => { if (msg && !e[k]) e[k] = msg; };

  set('title',    rules.required(form.title, 'タスク名'));
  set('title',    rules.maxLength(form.title, 255, 'タスク名'));
  set('priority', rules.required(form.priority, '優先度'));
  set('status',   rules.required(form.status, 'ステータス'));
  set('description', rules.maxLength(form.description, 2000, '説明'));
  return e;
}

// ---- ヘルパー ----

/** エラーが1件もなければtrue */
export const isValid = (e: FieldErrors) => Object.keys(e).length === 0;

/** フィールドのエラー表示用クラス */
export const inputErrCls = (e: FieldErrors, name: string) =>
  e[name] ? 'border-red-400 focus:ring-red-400' : '';

