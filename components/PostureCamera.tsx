'use client'

import { useEffect, useState } from 'react'
import { usePostureDetection } from '@/hooks/usePostureDetection'
import type { PostureStatus } from '@/lib/room'
import { Icon } from './Icon'

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

  const handleCalibrate = () => {
    const ok = calibrate()
    if (ok) {
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

  return (
    <section className="camera-panel" aria-labelledby="camera-title">
      <div className="timer-heading flex justify-between items-center">
        <h2 id="camera-title">
          <Icon name="video" size={19} />내 자세 지킴이
        </h2>
        {isDetecting && (
          <button
            type="button"
            onClick={handleCalibrate}
            className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-all ${
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

      {/* 듀얼 모니터링 2개 뷰포트 (좌: 실시간 원본 웹캠 / 우: AI 스켈레톤 골격 분석) */}
      <div className="camera-view-dual">
        {/* 모니터링 1: 실시간 원본 웹캠 뷰 */}
        <div className="camera-view-item flex flex-col justify-between">
          <div className="flex items-center justify-between p-2 z-10">
            <span className="camera-badge-tag bg-slate-900/80 text-slate-200 border border-slate-700/60">
              📹 뷰 1 · 실시간 원본 웹캠
            </span>
            <button
              type="button"
              onClick={handleToggleWebcam}
              disabled={isModelLoading}
              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors shadow-sm ml-auto z-20 ${
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
              <Icon name="camera" size={22} />
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
          <div className="flex items-center justify-between p-2 z-10">
            <span className="camera-badge-tag bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
              🤖 뷰 2 · AI 골격 추적 & 진단
            </span>
            <button
              type="button"
              onClick={handleToggleSkeleton}
              disabled={isModelLoading}
              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors shadow-sm ml-auto z-20 ${
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
              <Icon name="leaf" size={22} />
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
            <div className="absolute bottom-2 inset-x-2 bg-red-600/90 text-white py-1 px-2 rounded text-center text-[11px] font-semibold backdrop-blur-sm shadow-md animate-pulse z-10 pointer-events-none">
              ⚠️ 거북목 감지! 턱을 당기세요
            </div>
          )}

          {isSkeletonRunning && (
            <button
              type="button"
              onClick={captureSnapshot}
              title="자세 스냅샷 갱신"
              className="absolute top-8 right-2 bg-black/50 hover:bg-black/75 text-white p-1 rounded transition-colors z-10"
            >
              <Icon name="camera" size={13} />
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
