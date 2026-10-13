'use client'

import { useState } from 'react'
import { pauseTimer, resetTimer, setTimerMode, startTimer, updateTimerRhythm, type Room, type TimerMode } from '@/lib/room'
import { Icon } from './Icon'

// 공동 뽀모도로 타이머: 누가 조작하든 방 전체에 같은 상태가 반영됩니다.
export function TimerPanel({ room, remainingMs, serverNow }: { room: Room; remainingMs: number; serverNow: number }) {
  const [busy, setBusy] = useState(false)
  const { mode, status } = room.timer
  const isRunning = status === 'running'
  const durations: Record<TimerMode, number> = { work: room.workSec, break: room.breakSec }
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const isFresh = remainingSeconds === durations[mode]
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0')
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0')
  const progress = durations[mode] > 0 ? remainingSeconds / durations[mode] : 0
  const workMin = Math.round(room.workSec / 60)
  const breakMin = Math.round(room.breakSec / 60)
  const label = mode === 'work' ? '지금은, 오롯이 집중할 시간' : '잠깐 쉬어가도 괜찮아요'

  const is25_5 = workMin === 25 && breakMin === 5
  const is50_10 = workMin === 50 && breakMin === 10

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error('타이머 조작 실패:', error)
    } finally {
      setBusy(false)
    }
  }

  return <section className={`timer-panel ${mode === 'break' ? 'break-mode' : ''}`} aria-label="공동 뽀모도로 타이머">
    <div className="timer-heading">
      <h2><Icon name="clock" size={19} />공동 뽀모도로 타이머</h2>
      <span className="local-label">모두와 함께 흘러가요</span>
    </div>

    {/* 타이머 주기 원클릭 전환 탭 (25분 집중 · 5분 휴식 vs 50분 집중 · 10분 휴식) */}
    <div className="flex items-center justify-between bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100 text-xs mb-3">
      <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1 pl-1">
        ⏱️ 주기 선택:
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy || is25_5}
          onClick={() => run(() => updateTimerRhythm(room.id, 25, 5))}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            is25_5
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white/80 text-emerald-800 hover:bg-white border border-emerald-200'
          }`}
        >
          25분 · 5분
        </button>
        <button
          type="button"
          disabled={busy || is50_10}
          onClick={() => run(() => updateTimerRhythm(room.id, 50, 10))}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            is50_10
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white/80 text-emerald-800 hover:bg-white border border-emerald-200'
          }`}
        >
          50분 · 10분
        </button>
      </div>
    </div>

    <div className="timer-modes" aria-label="타이머 모드">
      <button aria-pressed={mode === 'work'} disabled={busy} onClick={() => run(() => setTimerMode(room.id, 'work'))}><Icon name="book" size={16} />집중 <span>{workMin}분</span></button>
      <button aria-pressed={mode === 'break'} disabled={busy} onClick={() => run(() => setTimerMode(room.id, 'break'))}><Icon name="coffee" size={16} />휴식 <span>{breakMin}분</span></button>
    </div>
    <div className="timer-dial">
      <svg className="timer-ring" viewBox="0 0 300 300" aria-hidden="true"><circle className="ring-track" cx="150" cy="150" r="139" /><circle className="ring-progress" cx="150" cy="150" r="139" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} /></svg>
      <div className="timer-center"><span className="timer-state">{isRunning ? (mode === 'work' ? '차곡차곡 집중 중' : '느긋하게 휴식 중') : isFresh ? '준비되셨나요?' : '잠시 멈춤'}</span><div className="timer-digits" role="timer" aria-label={`남은 시간 ${Number(minutes)}분 ${Number(seconds)}초`}>{minutes}<span>:</span>{seconds}</div><span className="timer-session"><span />{mode === 'work' ? '집중 시간' : '휴식 시간'}</span></div>
    </div>
    <p className="timer-message">{label}</p>
    <div className="timer-controls"><button className="primary-button" disabled={busy} onClick={() => run(() => isRunning ? pauseTimer(room.id, serverNow) : startTimer(room.id))}><Icon name={isRunning ? 'pause' : 'play'} size={18} />{isRunning ? '일시정지' : isFresh ? '시작하기' : '이어하기'}</button><button className="reset-button" aria-label="초기화" title="초기화" disabled={busy} onClick={() => run(() => resetTimer(room.id))}><Icon name="reset" size={21} /></button></div>
    <div className="timer-announcement" role="status" aria-live="polite">누가 조작해도 모두의 타이머가 함께 움직여요. 시간이 끝나면 다음 모드가 자동으로 시작돼요.</div>
    <div className="timer-rhythm"><span><i className="rhythm-dot" />{workMin}분 집중</span><span className="rhythm-line" /><Icon name="coffee" size={15} /><span>{breakMin}분 휴식</span><span className="rhythm-line" /><Icon name="reset" size={15} /><span>함께 반복</span></div>
  </section>
}
