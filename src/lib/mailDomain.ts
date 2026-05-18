// メールアドレスからドメインを抽出（小文字化）
// 存在しない / 形式不正なら null
export function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const d = email.slice(at + 1).trim().toLowerCase()
  return d || null
}

// 2 つのメールアドレスのドメインが一致するか
export function isSameDomain(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = extractDomain(a)
  const db = extractDomain(b)
  return !!da && !!db && da === db
}
