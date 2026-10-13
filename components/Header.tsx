'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './Icon'
import { SocialLoginButton } from './SocialLoginButton'

export function Header() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const inRoom = mounted && pathname ? pathname.startsWith('/room') : false

  return <header className="site-header">
    <div className="header-inner">
      <Link href="/" className="brand"><span className="brand-mark"><Icon name="leaf" size={24} /></span><span>목지키미<span className="brand-dot">.</span></span></Link>
      <div className="header-context"><span className="header-divider" /><span suppressHydrationWarning>{inRoom ? '재호의 스터디룸' : '나를 위한 집중 공간'}</span></div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <SocialLoginButton />
        <span className="demo-badge"><span />베타</span>
      </div>
    </div>
  </header>
}
