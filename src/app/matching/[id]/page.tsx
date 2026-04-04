'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from '@/lib/axios'

export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!id) return
    axios.get(`/api/v1/project-mails/${id}`)
      .then(res => setStatus('ok: ' + (res.data?.title ?? res.data?.id)))
      .catch(e => setStatus('error: ' + e?.response?.status))
  }, [id])

  return (
    <div className="p-8 bg-white">
      <button onClick={() => router.back()} className="text-sm text-blue-600 mb-4 block">← 戻る</button>
      <h1 className="text-lg font-bold text-gray-900 mb-2">マッチング画面 (id={id})</h1>
      <p className="text-sm text-gray-600">axios テスト: {status}</p>
    </div>
  )
}
