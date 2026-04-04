'use client'

import { useParams, useRouter } from 'next/navigation'

export default function MatchingPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  return (
    <div className="p-8 bg-white">
      <button onClick={() => router.back()} className="text-sm text-blue-600 mb-4 block">← 戻る</button>
      <h1 className="text-lg font-bold text-gray-900 mb-2">マッチング画面 (id={id})</h1>
      <p className="text-sm text-gray-600">この画面が見えたら useState/useEffect を追加します</p>
    </div>
  )
}
