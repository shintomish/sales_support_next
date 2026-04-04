'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'

export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [mailTitle, setMailTitle] = useState<string | null>(null)
  const [engCount, setEngCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  console.log('RENDER', { loading, mailTitle, engCount, error })

  useEffect(() => {
    if (!id) return
    console.log('EFFECT START id=', id)
    Promise.all([
      axios.get(`/api/v1/project-mails/${id}`),
      axios.get(`/api/v1/project-mails/${id}/matched-engineers`),
    ]).then(([mailRes, matchRes]) => {
      console.log('DATA OK mail=', mailRes.data?.id, 'engineers=', matchRes.data?.data?.length)
      setMailTitle(mailRes.data?.title ?? mailRes.data?.id ?? '?')
      setEngCount(matchRes.data?.data?.length ?? 0)
    }).catch((e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      console.error('FETCH ERROR', status)
      setError(`エラー ${status}`)
    }).finally(() => {
      console.log('FINALLY setLoading false')
      setLoading(false)
    })
  }, [id])

  if (loading) return <div style={{ padding: 32, background: 'lightyellow' }}>読み込み中... id={id}</div>
  if (error)   return <div style={{ padding: 32, background: 'lightpink' }}>エラー: {error}</div>

  return (
    <div style={{ padding: 32, background: 'lightgreen' }}>
      <button onClick={() => router.back()}>← 戻る</button>
      <h1 style={{ fontSize: 18, fontWeight: 'bold', marginTop: 8 }}>案件: {mailTitle}</h1>
      <p>マッチング技術者: {engCount}名</p>
    </div>
  )
}
