import Link from 'next/link'
import { Icon } from '@/components/Icon'

export default function NotFound() {
  return (
    <main id="main-content" className="room-main flex items-center justify-center min-h-[60vh]">
      <section className="entry-panel state-panel max-w-md w-full text-center p-8 space-y-4">
        <div className="flex justify-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#eef2e6] text-[#285b46]">
            <Icon name="leaf" size={28} />
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[#253e30] tracking-tight">페이지를 찾을 수 없어요</h1>
          <p className="text-xs text-[#7e867e] leading-relaxed">
            요청하신 주소가 잘못되었거나 삭제된 페이지입니다.<br />
            입력하신 주소를 다시 한번 확인해 주세요.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/" className="primary-button w-full flex items-center justify-center gap-2">
            대기실로 돌아가기
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </section>
    </main>
  )
}
