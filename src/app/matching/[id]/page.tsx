'use client'

import { useParams, useRouter } from 'next/navigation'

export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  return (
    <div style={{ padding: 32 }}>
      <p>matching page id = {String(params?.id)}</p>
      <button onClick={() => router.back()}>戻る</button>
    </div>
  )
}
