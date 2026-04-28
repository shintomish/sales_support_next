'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  html: string
  className?: string
}

export default function EmailHtmlFrame({ html, className = '' }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(400)

  useEffect(() => { setHeight(400) }, [html])

  const handleLoad = () => {
    const doc = ref.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('a').forEach(a => a.setAttribute('target', '_blank'))
    const h = doc.documentElement.scrollHeight
    if (h > 0) setHeight(h + 16)
  }

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-same-origin allow-popups"
      onLoad={handleLoad}
      className={`w-full border-0 ${className}`}
      style={{ height: `${height}px` }}
    />
  )
}
