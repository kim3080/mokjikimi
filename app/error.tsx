'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Icon'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('페이지 렌더링 중 오류 감지:', error)
  }, [error])

  return (
    <main id="main-content" className="room-main flex items-center justify-center min-h-[60vh]">
      <section className="entry-panel state-panel max-w-md w-full text-center p-8 space-y-4">
        <div className="flex justify-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#fdf2e9] text-[#b46b2b]">
            <Icon name="info" size={28} />
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[#253e30] tracking-tight">잠시 연결에 문제가 생겼어요</h1>
          <p className="text-xs text-[#7e867e] leading-relaxed">
            일시적인 네트워크 지연이나 예기치 않은 오류가 발생했습니다.<br />
            다시 시도하거나 대기실로 이동해 주세요.
          </p>
        </div>
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={() => reset()}
            className="primary-button w-full flex items-center justify-center gap-2"
          >
            다시 시도하기
          </button>
          <Link
            href="/"
            className="w-full flex items-center justify-center py-2.5 text-xs text-[#6e776e] hover:text-[#253e30] transition-colors"
          >
            대기실로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  )
}
