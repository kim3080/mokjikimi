'use client'

import { useEffect, useRef, useState } from 'react'
import { usePostureDetection } from '@/hooks/usePostureDetection'
import type { PostureStatus } from '@/lib/room'
import { Icon } from './Icon'
import {
  playPostureAlertSound,
  playCalibrationSound,
  isSoundEnabled,
  setSoundEnabled,
} from '@/lib/soundService'

// 자세 상태가 이 시간 이상 유지될 때만 방에 전송 (프레임 단위 깜빡임 방지 + 쓰기 절약)
const POSTURE_SYNC_DEBOUNCE_MS = 1000

// 내 카메라 + 자세 감지. 영상은 공유하지 않고 자세 상태와 스냅샷만 상위로 전달합니다.
export function PostureCamera({
  onPostureChange,
  onSnapshotChange,
}: {
  onPostureChange: (posture: PostureStatus | null) => void
  onSnapshotChange?: (snapshotUrl: string | null) => void
}) {
  const {
    videoRef,
    canvasRef,
    metrics,
    isModelLoading,
    isDetecting,
    isSlouching,
    snapshotUrl,
    error,
    toggleDetection,
    calibrate,
    isCalibrated,
    captureSnapshot,
  } = usePostureDetection()
  const posture = isDetecting ? (metrics?.status ?? null) : null
  const [calibratedSuccess, setCalibratedSuccess] = useState(false)

  // Web Audio 사운드 알림 On/Off 상태 및 쿨다운 Ref
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const lastSoundAlertTimeRef = useRef<number>(0)

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev
      setSoundEnabled(next)
      if (next) playCalibrationSound() // 켤 때 가벼운 확인음
      return next
    })
  }

  // [EXPO 사운드 알림] 거북목/자세 붕괴 감지 시 실시간 스마트 차임벨 재생 (3.5초 쿨다운)
  useEffect(() => {
    if (!isSlouching) return
    const now = performance.now()
    if (now - lastSoundAlertTimeRef.current > 3500) {
      lastSoundAlertTimeRef.current = now
      playPostureAlertSound()
    }
  }, [isSlouching])

  const handleCalibrate = () => {
    const ok = calibrate()
    if (ok) {
      playCalibrationSound()
      setCalibratedSuccess(true)
      setTimeout(() => setCalibratedSuccess(false), 2500)
    }
  }

  useEffect(() => {
    const id = setTimeout(() => onPostureChange(posture), POSTURE_SYNC_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [posture, onPostureChange])

  useEffect(() => {
    onSnapshotChange?.(snapshotUrl)
  }, [snapshotUrl, onSnapshotChange])

  // 뷰 1 (실시간 웹캠) 및 뷰 2 (AI 골격 진단) 개별 활성화 상태 (독립 제어)
  const [showWebcamView, setShowWebcamView] = useState(true)
  const [showSkeletonView, setShowSkeletonView] = useState(true)

  // 둘 중 하나라도 켜져 있을 때만 실제 감지 루프 작동
  const handleToggleWebcam = async () => {
    if (!showWebcamView) {
      setShowWebcamView(true)
      if (!isDetecting) {
        await toggleDetection()
      }
    } else {
      setShowWebcamView(false)
      // 만약 스켈레톤 뷰도 꺼져 있다면 전체 감지 정지
      if (!showSkeletonView && isDetecting) {
        toggleDetection()
      }
    }
  }

  const handleToggleSkeleton = async () => {
    if (!showSkeletonView) {
      setShowSkeletonView(true)
      if (!isDetecting) {
        await toggleDetection()
      }
    } else {
      setShowSkeletonView(false)
      // 만약 웹캠 뷰도 꺼져 있다면 전체 감지 정지
      if (!showWebcamView && isDetecting) {
        toggleDetection()
      }
    }
  }

  const isWebcamRunning = isDetecting && showWebcamView
  const isSkeletonRunning = isDetecting && showSkeletonView

  // '내 자세 지킴이' 화면 확대 모드 (기본값: true - 크게 보기)
  const [isExpanded, setIsExpanded] = useState(true)

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev
      try {
        localStorage.setItem('mokjikimi_camera_expanded', String(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mokjikimi_camera_expanded')
      if (saved !== null) {
        setIsExpanded(saved === 'true')
      }
    } catch {}
  }, [])

  return (
    <section className="camera-panel" aria-labelledby="camera-title">
      <div className="timer-heading flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <h2 id="camera-title" className="flex items-center gap-2 text-base font-bold text-[#253e30]">
            <Icon name="video" size={20} />
            <span>내 자세 지킴이</span>
          </h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {isExpanded ? '🗖 화면 확대 모드' : '⊞ 표준 분할 모드'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={toggleSound}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors shadow-2xs ${
              soundOn
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-neutral-100 text-neutral-500 border-neutral-300 hover:bg-neutral-200'
            }`}
            title={soundOn ? '소리 알림 끄기 (음소거)' : '소리 알림 켜기'}
          >
            {soundOn ? '🔔 소리 켜짐' : '🔕 음소거'}
          </button>
          <button
            type="button"
            onClick={toggleExpanded}
            className="text-xs font-bold px-2.5 py-1 rounded-lg border border-[#d2dfc6] bg-[#f4f7ee] hover:bg-[#eaf1e2] text-[#285b46] transition-colors shadow-2xs"
            title={isExpanded ? '기본 나란히 보기로 변경' : '화면 크게 보기로 확대'}
          >
            {isExpanded ? '⊞ 나란히 보기' : '🗖 화면 크게 보기'}
          </button>
          {isDetecting && (
            <button
              type="button"
              onClick={handleCalibrate}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all shadow-2xs ${
                calibratedSuccess
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isCalibrated
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
              }`}
            >
              {calibratedSuccess ? '✅ 영점 등록 완료!' : isCalibrated ? '🎯 영점 재설정' : '🎯 바른 자세 영점 맞추기'}
            </button>
          )}
        </div>
      </div>

      {/* 듀얼 모니터링 2개 뷰포트 (좌: 실시간 원본 웹캠 / 우: AI 스켈레톤 골격 분석) */}
      <div className={`camera-view-dual ${isExpanded ? 'is-expanded' : ''}`}>
        {/* 모니터링 1: 실시간 원본 웹캠 뷰 */}
        <div className="camera-view-item flex flex-col justify-between">
          <div className="flex items-center justify-between p-2.5 z-10">
            <span className="camera-badge-tag bg-slate-900/80 text-slate-200 border border-slate-700/60">
              📹 뷰 1 · 실시간 원본 웹캠
            </span>
            <button
              type="button"
              onClick={handleToggleWebcam}
              disabled={isModelLoading}
              className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors shadow-sm ml-auto z-20 ${
                isWebcamRunning
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isWebcamRunning ? '웹캠 끄기' : '웹캠 켜기'}
            </button>
          </div>

          <video ref={videoRef} playsInline muted style={{ opacity: isWebcamRunning ? 1 : 0 }} />

          {!isWebcamRunning && (
            <div className="camera-placeholder">
              <Icon name="camera" size={24} />
              <p className="font-medium text-xs">
                {isModelLoading
                  ? 'AI 모델 준비 중…'
                  : '웹캠 꺼짐'}
              </p>
              <span className="text-[10px] text-gray-500">
                [웹캠 켜기] 버튼을 눌러 개별 실행
              </span>
            </div>
          )}

          {isWebcamRunning && metrics && (
            <div className="absolute top-8 right-2.5 z-10 pointer-events-none">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${
                  metrics.status === 'perfect'
                    ? 'bg-emerald-500 text-white'
                    : metrics.status === 'warning'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {Math.round(metrics.postureScore)}점
              </span>
            </div>
          )}
        </div>

        {/* 모니터링 2: AI 스켈레톤 및 거북목 골격 분석 뷰 */}
        <div className="camera-view-item flex flex-col justify-between">
          <div className="flex items-center justify-between p-2.5 z-10">
            <span className="camera-badge-tag bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
              🤖 뷰 2 · AI 골격 추적 & 진단
            </span>
            <button
              type="button"
              onClick={handleToggleSkeleton}
              disabled={isModelLoading}
              className={`text-xs font-bold px-2.5 py-1 rounded-md transition-colors shadow-sm ml-auto z-20 ${
                isSkeletonRunning
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isSkeletonRunning ? '골격 끄기' : '골격 켜기'}
            </button>
          </div>

          <canvas ref={canvasRef} style={{ opacity: isSkeletonRunning ? 1 : 0 }} />

          {!isSkeletonRunning && (
            <div className="camera-placeholder">
              <Icon name="leaf" size={24} />
              <p className="font-medium text-xs">
                {isModelLoading
                  ? 'AI 관절 추적망 초기화 중…'
                  : '골격 진단 꺼짐'}
              </p>
              <span className="text-[10px] text-gray-500">
                [골격 켜기] 버튼을 눌러 개별 실행
              </span>
            </div>
          )}

          {isSkeletonRunning && isSlouching && (
            <div className="absolute bottom-3 inset-x-3 bg-red-600/90 text-white py-1.5 px-3 rounded-lg text-center text-xs font-bold backdrop-blur-sm shadow-md animate-pulse z-10 pointer-events-none">
              ⚠️ 거북목 감지! 턱을 당기세요
            </div>
          )}

          {isSkeletonRunning && (
            <button
              type="button"
              onClick={captureSnapshot}
              title="자세 스냅샷 갱신"
              className="absolute top-9 right-2.5 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md transition-colors z-10"
            >
              <Icon name="camera" size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="camera-error p-2.5 bg-red-50 border border-red-200 rounded-lg mb-3">
          <p className="font-semibold mb-0.5">카메라 연결 알림</p>
          <p className="text-[11px] text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      {/* 하단 통합 제어 바 */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          className="secondary-button text-xs py-2"
          onClick={handleToggleWebcam}
          disabled={isModelLoading}
        >
          <Icon name="video" size={15} />
          {isWebcamRunning ? '뷰 1(웹캠) 끄기' : '뷰 1(웹캠) 켜기'}
        </button>
        <button
          type="button"
          className="secondary-button text-xs py-2"
          onClick={handleToggleSkeleton}
          disabled={isModelLoading}
        >
          <Icon name="leaf" size={15} />
          {isSkeletonRunning ? '뷰 2(AI골격) 끄기' : '뷰 2(AI골격) 켜기'}
        </button>
      </div>
    </section>
  )
}
