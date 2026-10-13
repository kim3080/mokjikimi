'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { DeskIllustration } from '@/components/DeskIllustration'
import { FirebaseSetupNotice } from '@/components/FirebaseSetupNotice'
import { AICoachCard } from '@/components/AICoachCard'
import { isFirebaseConfigured } from '@/lib/firebase'
import { createRoom, parseRoomCode, roomExists, validateNickname, validateRoomCode, validateRoomName } from '@/lib/room'
import { useAnonymousUser } from '@/hooks/useAnonymousUser'
import { useNickname } from '@/hooks/useNickname'

type Errors = { nickname?: string; room?: string }

// 타이머 프리셋 목록 (50분/10분 등)
const TIMER_PRESETS = [
  { label: '50분 집중 · 10분 휴식', workMin: 50, breakMin: 10 },
  { label: '25분 집중 · 5분 휴식', workMin: 25, breakMin: 5 },
  { label: '1분 집중 · 1분 휴식 (시연용)', workMin: 1, breakMin: 1 },
]

export default function LobbyPage() {
  const router = useRouter()
  const { user, error: authError } = useAnonymousUser()
  const [savedNickname, saveNickname] = useNickname()
  const [nicknameDraft, setNicknameDraft] = useState<string | null>(null)
  const nickname = nicknameDraft ?? savedNickname

  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [roomName, setRoomName] = useState('')
  const [presetIndex, setPresetIndex] = useState(0)
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const nicknameInput = useRef<HTMLInputElement>(null)
  const roomInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const createTab = useRef<HTMLButtonElement>(null)
  const joinTab = useRef<HTMLButtonElement>(null)

  useEffect(() => { heading.current?.focus() }, [])

  function switchTab(next: 'create' | 'join') {
    setTab(next)
    setErrors({})
  }

  function handleTabKey(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'create' : event.key === 'End' ? 'join' : tab === 'create' ? 'join' : 'create'
    switchTab(next)
    ;(next === 'create' ? createTab : joinTab).current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current || !user) return
    const next = {
      nickname: validateNickname(nickname),
      room: tab === 'create' ? validateRoomName(roomName) : validateRoomCode(code),
    }
    setErrors(next)
    if (next.nickname || next.room) {
      ;(next.nickname ? nicknameInput : roomInput).current?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    try {
      let roomCode: string
      if (tab === 'create') {
        const preset = TIMER_PRESETS[presetIndex]
        roomCode = await createRoom({ name: roomName.trim(), hostId: user.uid, workMin: preset.workMin, breakMin: preset.breakMin })
      } else {
        roomCode = parseRoomCode(code)!
        if (!(await roomExists(roomCode))) throw new Error('방을 찾을 수 없어요. 코드를 다시 확인해 주세요.')
      }
      saveNickname(nickname)
      router.push(`/room/${roomCode}`)
    } catch (error) {
      console.error('스터디룸 입장 실패:', error)
      setErrors({ room: error instanceof Error && tab === 'join' ? error.message : '잠시 후 다시 시도해 주세요.' })
      roomInput.current?.focus()
      pending.current = false
      setBusy(false)
    }
  }

  const disabled = busy || !user

  return <main id="main-content" className="lobby-main">
    <div className="page-eyebrow"><span className="small-line" />집중이 자라는 곳</div>
    <div className="lobby-grid">
      <section className="lobby-intro">
        <h1 ref={heading} tabIndex={-1}>오늘의 집중을<br className="desktop-break" /> 시작해 볼까요?</h1>
        <p className="intro-copy">공부는 차근차근, 자세는 반듯하게.<br />작은 집중이 모여 더 나은 하루가 돼요.</p>
        <div className="illustration-wrap"><span className="illustration-caption">조금씩, 함께 자라는 시간</span><DeskIllustration /></div>
        <div className="intro-features">
          <div><span className="feature-icon"><Icon name="clock" /></span><div><strong>함께 도는 뽀모도로</strong><p>스터디원 모두의 타이머가 같이 흘러가요</p></div></div>
          <div><span className="feature-icon"><Icon name="leaf" /></span><div><strong>내 자세도 소중하게</strong><p>AI가 거북목을 살짝 알려드려요</p></div></div>
        </div>
        <div style={{ marginTop: 24 }}>
          <AICoachCard />
        </div>
      </section>

      <section className="entry-panel" aria-label="스터디룸 시작">
        <div className="entry-heading"><span className="entry-icon"><Icon name="book" size={23} /></span><div><h2>나의 스터디룸</h2><p>집중할 준비, 여기서 시작해요.</p></div></div>
        {!isFirebaseConfigured ? <div style={{ marginTop: 24 }}><FirebaseSetupNotice /></div> : <>
          <div className="tabs" role="tablist" aria-label="방 이용 방법" onKeyDown={handleTabKey}>
            <button ref={createTab} role="tab" id="create-tab" aria-controls="room-form" aria-selected={tab === 'create'} tabIndex={tab === 'create' ? 0 : -1} onClick={() => switchTab('create')} disabled={busy}><Icon name="plus" size={17} />방 만들기</button>
            <button ref={joinTab} role="tab" id="join-tab" aria-controls="room-form" aria-selected={tab === 'join'} tabIndex={tab === 'join' ? 0 : -1} onClick={() => switchTab('join')} disabled={busy}><Icon name="door" size={17} />코드로 입장</button>
          </div>
          <div role="tabpanel" id="room-form" aria-labelledby={`${tab}-tab`}>
            <form onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="nickname">닉네임</label>
                <input ref={nicknameInput} id="nickname" autoComplete="nickname" placeholder="어떻게 불러드릴까요?" value={nickname} onChange={e => { setNicknameDraft(e.target.value); setErrors(old => ({ ...old, nickname: undefined })) }} aria-invalid={!!errors.nickname} aria-describedby={errors.nickname ? 'nickname-error' : 'nickname-help'} disabled={busy} />
                {errors.nickname ? <p id="nickname-error" className="field-error" role="alert">{errors.nickname}</p> : <p id="nickname-help" className="field-help">스터디룸에서 사용할 이름 · 최대 12자</p>}
              </div>
              <div className="field">
                <label htmlFor="room-input">{tab === 'create' ? '방 이름' : '방 코드'}</label>
                <input ref={roomInput} id="room-input" key={tab} autoComplete="off" spellCheck={false} autoCapitalize={tab === 'join' ? 'characters' : 'off'} placeholder={tab === 'create' ? '예: 오늘도 차근차근 공부방' : '예: AB12CD 또는 초대 링크'} value={tab === 'create' ? roomName : code} onChange={e => { if (tab === 'create') setRoomName(e.target.value); else setCode(e.target.value); setErrors(old => ({ ...old, room: undefined })) }} aria-invalid={!!errors.room} aria-describedby={errors.room ? 'room-error' : 'room-help'} disabled={busy} className={tab === 'join' ? 'code-input' : ''} />
                {errors.room ? <p id="room-error" className="field-error" role="alert">{errors.room}</p> : <p id="room-help" className="field-help">{tab === 'create' ? '우리만의 공간에 이름을 붙여 주세요 · 최대 30자' : '영문·숫자 6자리 코드나 초대 링크를 입력해 주세요'}</p>}
              </div>
              {tab === 'create' && <div className="field">
                <label htmlFor="timer-preset">타이머 주기</label>
                <select id="timer-preset" value={presetIndex} onChange={e => setPresetIndex(Number(e.target.value))} disabled={busy}>
                  {TIMER_PRESETS.map((preset, i) => <option key={preset.label} value={i}>{preset.label}</option>)}
                </select>
              </div>}
              <button className="primary-button w-full" type="submit" disabled={disabled}>{busy ? '준비하고 있어요…' : !user ? '연결하고 있어요…' : tab === 'create' ? '스터디룸 만들기' : '스터디룸 입장하기'}<Icon name="arrow" size={19} /></button>
            </form>
          </div>
          {authError && <p className="field-error" role="alert" style={{ marginTop: 16 }}>{authError}</p>}
        </>}
      </section>
    </div>
    <div className="lobby-bottom"><Icon name="shield" size={16} /><span>로그인 없이 바로 시작해요. 카메라는 스터디룸에서 원할 때만 켜지고, 영상은 전송되지 않아요.</span></div>
  </main>
}
