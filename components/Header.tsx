'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './Icon'
import { SocialLoginButton } from './SocialLoginButton'
import { PostureStatsModal } from './PostureStatsModal'

export function Header() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const inRoom = mounted && pathname ? pathname.startsWith('/room') : false

  return <>
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand"><span className="brand-mark"><Icon name="leaf" size={24} /></span><span>목지키미<span className="brand-dot">.</span></span></Link>
        <div className="header-context"><span className="header-divider" /><span suppressHydrationWarning>{inRoom ? '재호의 스터디룸' : '나를 위한 집중 공간'}</span></div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dde5d4] bg-[#f5f8f0] hover:bg-[#eaf1e3] text-[#285b46] text-xs font-bold transition-all shadow-xs"
            title="나의 주간 자세 및 집중 통계 대시보드"
          >
            <span>📊</span>
            <span>자세 통계</span>
          </button>
          <SocialLoginButton />
          <span className="demo-badge"><span />베타</span>
        </div>
      </div>
    </header>
    <PostureStatsModal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} />
  </>
}
