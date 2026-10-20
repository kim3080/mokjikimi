'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { TimerPanel } from '@/components/TimerPanel'
import { ParticipantCard, type ParticipantStatus, type ParticipantView } from '@/components/ParticipantCard'
import { PostureCamera } from '@/components/PostureCamera'
import { AICoachCard } from '@/components/AICoachCard'
import { PostureStatsModal } from '@/components/PostureStatsModal'
import { FirebaseSetupNotice } from '@/components/FirebaseSetupNotice'
import { isFirebaseConfigured } from '@/lib/firebase'
import { ONLINE_THRESHOLD_MS, updatePosture, validateNickname, type Member, type PostureStatus, type Room } from '@/lib/room'
import { useAnonymousUser } from '@/hooks/useAnonymousUser'
import { useNickname } from '@/hooks/useNickname'
import { useStudyRoom } from '@/hooks/useStudyRoom'
import { useSharedTimer } from '@/hooks/useSharedTimer'

// heartbeat 가 이 시간 이상 끊긴 참가자는 목록에서 숨깁니다 (ONLINE_THRESHOLD_MS ~ 이 값 사이는 '자리 비움')
const HIDE_AFTER_MS = 10 * 60_000

function toParticipant(member: Member, room: Room, serverNow: number, isMe: boolean): ParticipantView | null {
  const idleMs = member.lastSeen ? serverNow - member.lastSeen.toMillis() : 0
  if (!isMe && idleMs > HIDE_AFTER_MS) return null
  const status: ParticipantStatus = !isMe && idleMs > ONLINE_THRESHOLD_MS
    ? 'away'
    : room.timer.status === 'running' ? (room.timer.mode === 'work' ? 'focus' : 'break') : 'ready'
  return {
    id: member.uid,
    nickname: member.nickname,
    status,
    posture: status === 'away' ? null : member.posture,
    snapshotUrl: member.snapshotUrl || undefined,
  }
}

export default function StudyRoomPage({ params }: PageProps<'/room/[roomId]'>) {
  const roomId = use(params).roomId.toUpperCase()
  const router = useRouter()
  const { user, isLoading: isAuthLoading, error: authError } = useAnonymousUser()
  const [nickname, setNickname] = useNickname()
  const uid = user?.uid ?? null
  const isLoggedIn = !!user && !user.isAnonymous

  const { room, members, isLoading, notFound, error, serverOffsetMs } = useStudyRoom(roomId, uid, nickname)
  const { remainingMs, serverNow } = useSharedTimer(room, serverOffsetMs)
  const [copied, setCopied] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const [mounted, setMounted] = useState(false)
  const isRoomReady = room !== null

  // 로컬 웹캠 자세 상태 및 스냅샷 URL 실시간 연동
  const [localPosture, setLocalPosture] = useState<PostureStatus | null>(null)
  const [mySnapshotUrl, setMySnapshotUrl] = useState<string | null>(null)
  // [8주차] Recharts 누적 자세 & 집중 통계 모달 상태
  const [showStatsModal, setShowStatsModal] = useState(false)
  // 힘들조 팀원 (박진규, 안정민) 목(Mock) 연동 시뮬레이션 상태 (React Hooks 규칙: early return 이전에 선언)
  const [showMockTeam, setShowMockTeam] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => { if (isRoomReady) heading.current?.focus() }, [isRoomReady])

  // [8주차] 자세 상태 및 박제 스냅샷이 변경되었을 때 Firestore 실시간 동기화
  const lastPostureRef = useRef<PostureStatus | null>(null)
  const lastSnapshotRef = useRef<string | null>(null)

  const syncPostureAndSnapshot = useCallback((posture: PostureStatus | null, snapshot: string | null) => {
    if (!uid || !isRoomReady) return
    if (lastPostureRef.current === posture && lastSnapshotRef.current === snapshot) return
    lastPostureRef.current = posture
    lastSnapshotRef.current = snapshot
    updatePosture(roomId, uid, posture, snapshot ?? undefined).catch((err) =>
      console.error('자세 및 스냅샷 동기화 실패:', err)
    )
  }, [roomId, uid, isRoomReady])

  const handlePostureChange = useCallback((posture: PostureStatus | null) => {
    setLocalPosture(posture)
    syncPostureAndSnapshot(posture, mySnapshotUrl)
  }, [syncPostureAndSnapshot, mySnapshotUrl])

  const handleSnapshotChange = useCallback((url: string | null) => {
    setMySnapshotUrl(url)
    if (url) {
      syncPostureAndSnapshot(localPosture, url)
    }
  }, [syncPostureAndSnapshot, localPosture])

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('초대 링크를 복사해 주세요', `${window.location.origin}/room/${roomId}`)
    }
  }

  // 하이드레이션 불일치 방지: 클라이언트 마운트 완료 전에는 SSR 트리와 동일한 초기 로딩 패널 반환
  if (!mounted || isAuthLoading || isLoading) return <StatePanel title="스터디룸에 연결하고 있어요…" />

  if (!isFirebaseConfigured) return <StatePanel title="스터디룸"><FirebaseSetupNotice /></StatePanel>

  const statusMessage = authError ?? error
  if (statusMessage) return <StatePanel title="연결에 문제가 생겼어요"><p className="field-error">{statusMessage}</p><BackToLobby /></StatePanel>

  if (!nickname) return <StatePanel title="스터디룸에 입장하기" description={`방 코드 ${roomId}`}><NicknameForm onSubmit={setNickname} /></StatePanel>

  if (notFound || !room || !uid) {
    return <StatePanel title="방을 찾을 수 없어요" description="코드가 올바른지, 방이 아직 있는지 확인해 주세요."><BackToLobby /></StatePanel>
  }

  const me = members.find((m) => m.uid === uid)
  const others = members.filter((m) => m.uid !== uid)
  const baseMyCard = me && toParticipant(me, room, serverNow, true)
  const myCard: ParticipantView | null = baseMyCard
    ? {
        ...baseMyCard,
        posture: localPosture !== null ? localPosture : baseMyCard.posture,
        snapshotUrl: mySnapshotUrl ?? baseMyCard.snapshotUrl,
      }
    : null;
  const otherCards = others.map((m) => toParticipant(m, room, serverNow, false)).filter((p): p is ParticipantView => p !== null);

  // 팀원 목 데이터 정의
  const mockTeamMembers: ParticipantView[] = [
    {
      id: 'mock-park-jingyu',
      nickname: '박진규 (Frontend)',
      status: room.timer.status === 'running' ? (room.timer.mode === 'work' ? 'focus' : 'break') : 'ready',
      posture: 'perfect',
    },
    {
      id: 'mock-ahn-jeongmin',
      nickname: '안정민 (AI Vision)',
      status: room.timer.status === 'running' ? (room.timer.mode === 'work' ? 'focus' : 'break') : 'ready',
      posture: 'warning',
    },
  ];

  const effectiveOtherCards = [
    ...otherCards,
    ...(showMockTeam && otherCards.length === 0 ? mockTeamMembers : []),
  ];

  const onlineCount = (myCard ? 1 : 0) + effectiveOtherCards.filter((p) => p.status !== 'away').length;

  return <main id="main-content" className="room-main">
    <div className="room-breadcrumb">나의 공간 <span>/</span> 재호의 스터디룸</div>
    <div className="room-title-row">
      <div className="min-w-0">
        <div className="room-title"><span className="room-symbol"><Icon name="book" size={24} /></span><h1 ref={heading} tabIndex={-1}>{room.name}</h1></div>
        <div className="room-meta">
          <span>방 코드 <strong>{room.id}</strong></span>
          <span className="meta-divider" />
          <button className="copy-button" onClick={copyInviteLink}>
            <Icon name={copied ? 'check' : 'link'} size={13} />
            {copied ? '복사했어요' : '초대 링크 복사'}
          </button>
          <span className="meta-divider" />
          <button
            type="button"
            className="copy-button"
            onClick={() => setShowMockTeam((prev) => !prev)}
            title="힘들조 팀원 접속 상태 토글"
          >
            👥 팀원 연동 데모 {showMockTeam ? '활성' : '숨김'}
          </button>
          <span className="meta-divider" />
          <button
            type="button"
            className="copy-button"
            onClick={() => setShowStatsModal(true)}
            title={isLoggedIn ? '나의 주간 자세 및 집중 통계 대시보드 열기' : '로그인 후 자세 통계 조회 가능'}
          >
            {isLoggedIn ? '📊 내 자세 통계' : '🔒 내 자세 통계 (로그인 필요)'}
          </button>
        </div>
      </div>
      <button className="leave-button" onClick={() => router.push('/')}><Icon name="door" size={17} />방 나가기</button>
    </div>
    <div className="study-grid">
      <div className="timer-column space-y-4">
        <TimerPanel room={room} remainingMs={remainingMs} serverNow={serverNow} />
        <PostureCamera onPostureChange={handlePostureChange} onSnapshotChange={handleSnapshotChange} />
        <AICoachCard />
        <div className="gentle-tip"><span className="tip-icon"><Icon name="leaf" size={21} /></span><div><strong>집중하는 동안, 나도 챙겨요.</strong><p>어깨는 가볍게 펴고, 화면은 눈높이에 맞춰 보세요.</p></div><span className="tip-decoration" aria-hidden="true">✧</span></div>
      </div>
      <section className="participants-section" aria-labelledby="participants-title">
        <div className="participants-heading">
          <h2 id="participants-title"><Icon name="users" size={20} />함께하는 공간</h2>
          <div className="flex items-center gap-2">
            {showMockTeam && (
              <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                힘들조 팀원 접속 중
              </span>
            )}
            <span>지금 {onlineCount}명</span>
          </div>
        </div>
        <p className="participants-description">각자의 자리에서, 같은 마음으로.</p>
        <div className="participants-grid" aria-label="참여자 목록">
          {myCard && <ParticipantCard participant={myCard} isMe />}
          {effectiveOtherCards.map((p) => <ParticipantCard key={p.id} participant={p} />)}
        </div>
        <div className="privacy-note"><Icon name="shield" size={17} /><div><strong>영상은 내 기기를 떠나지 않아요</strong><p>다른 참여자에게는 타이머와 자세 상태만 공유돼요.<br />웹캠 영상은 내 기기 안에서 AI가 분석하며 외부로 전송되지 않아요.</p></div></div>
      </section>
    </div>
    <PostureStatsModal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} uid={uid} />
  </main>
}

function StatePanel({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <main id="main-content" className="room-main">
    <section className="entry-panel state-panel">
      <div className="entry-heading"><span className="entry-icon"><Icon name="book" size={23} /></span><div><h1 className="text-[19px] font-bold tracking-tight">{title}</h1>{description && <p>{description}</p>}</div></div>
      {children}
    </section>
  </main>
}

function BackToLobby() {
  return <Link href="/" className="primary-button w-full" style={{ marginTop: 20 }}>대기실로 돌아가기<Icon name="arrow" size={19} /></Link>
}

function NicknameForm({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = validateNickname(value)
    setError(message)
    if (!message) onSubmit(value.trim())
  }

  return <form onSubmit={submit} noValidate>
    <div className="field">
      <label htmlFor="nickname">닉네임</label>
      <input id="nickname" autoFocus autoComplete="nickname" placeholder="어떻게 불러드릴까요?" value={value} onChange={e => { setValue(e.target.value); setError(undefined) }} aria-invalid={!!error} aria-describedby={error ? 'nickname-error' : 'nickname-help'} />
      {error ? <p id="nickname-error" className="field-error" role="alert">{error}</p> : <p id="nickname-help" className="field-help">스터디룸에서 사용할 이름 · 최대 12자</p>}
    </div>
    <button className="primary-button w-full" type="submit">스터디룸 입장하기<Icon name="arrow" size={19} /></button>
  </form>
}
