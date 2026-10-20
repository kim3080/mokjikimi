'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Icon } from './Icon'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchDailyStats,
  getInitialStats,
  type DailyPostureStat,
  type PostureSummaryKPI,
} from '@/lib/statsService'

interface PostureStatsModalProps {
  isOpen: boolean
  onClose: () => void
  uid?: string | null
}

export function PostureStatsModal({ isOpen, onClose, uid = '' }: PostureStatsModalProps) {
  const { user, loginWithGoogle, isLoading: isAuthLoading } = useAuth()
  const isLoggedIn = !!user && !user.isAnonymous
  const effectiveUid = uid || (isLoggedIn ? user.uid : '')

  const [activeTab, setActiveTab] = useState<'score' | 'time' | 'table'>('score')
  // 초기 렌더링 시에도 깜빡임이 전혀 없도록 기본 통계 데이터로 즉시 동기 초기화
  const [data, setData] = useState<{ stats: DailyPostureStat[]; kpi: PostureSummaryKPI }>(() =>
    getInitialStats(7)
  )
  const [mounted, setMounted] = useState(false)

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    setMounted(true)
  }, [])

  // 모달이 열릴 때 백그라운드에서 최신 Firestore 데이터를 무깜빡임(Silent SWR)으로 갱신 (로그인 회원만)
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return

    let cancelled = false

    fetchDailyStats(effectiveUid)
      .then((res) => {
        if (!cancelled && res) {
          setData(res)
        }
      })
      .catch((err) => {
        console.warn('통계 백그라운드 동기화 알림:', err)
      })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelled = true
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isLoggedIn, effectiveUid])

  if (!isOpen || !mounted) return null

  // 비로그인 상태일 때는 통계 대시보드 열람을 엄격히 차단하고 로그인 안내 화면 제공
  if (!isLoggedIn) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-login-required-title"
        onClick={() => onCloseRef.current?.()}
      >
        <div
          className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#dde3d7] overflow-hidden text-center p-6 sm:p-8 animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 우측 상단 닫기 버튼 */}
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="absolute top-4 right-4 text-[#8a9488] hover:text-[#253e30] p-1.5 rounded-lg hover:bg-[#f0f3eb] transition-colors text-base font-bold leading-none"
            aria-label="닫기"
          >
            ✕
          </button>

          {/* 자물쇠 아이콘 배지 */}
          <div className="w-16 h-16 rounded-2xl bg-[#f4f7ee] border border-[#d2dfc6] text-[#285b46] flex items-center justify-center text-3xl mx-auto mb-4 shadow-xs">
            🔒
          </div>

          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fee2e2] text-[#b91c1c] mb-2">
            비로그인 상태
          </span>

          <h3 id="stats-login-required-title" className="text-lg font-bold text-[#253e30] mb-2">
            로그인 후 통계를 볼 수 있습니다
          </h3>
          <p className="text-xs text-[#6e776e] leading-relaxed mb-6">
            비로그인(게스트) 상태에서는 개인 자세 통계 모드를 볼 수 없습니다.<br />
            Google 계정으로 로그인하시면 나의 <strong>주간 자세 점수 추이</strong>, <strong>집중 시간</strong>, <strong>거북목 경고 통계표</strong> 및 <strong>AI 코칭 리포트</strong>를 안전하게 확인하실 수 있습니다.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                await loginWithGoogle()
              }}
              disabled={isAuthLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-xl px-4 py-3 text-sm font-bold shadow-sm hover:shadow transition-all active:scale-98 disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google 계정으로 로그인</span>
            </button>

            <button
              type="button"
              onClick={() => onCloseRef.current?.()}
              className="w-full px-4 py-2 text-xs font-semibold text-[#6e776e] hover:text-[#253e30] transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )
  }

  const stats = data.stats
  const kpi = data.kpi

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current?.()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
    >
      <div className="relative w-full max-w-3xl bg-[#fffefa] border border-[#e2e6db] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#e7eae2] bg-[#fbfcf8]">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#285b46] text-[#e4eecf]">
              <Icon name="leaf" size={20} />
            </span>
            <div>
              <h2 id="stats-modal-title" className="text-lg font-bold text-[#253e30] tracking-tight">
                나의 자세 & 집중 통계 대시보드
              </h2>
              <p className="text-xs text-[#7e867e] mt-0.5">
                AI 온디바이스 거북목 분석 및 소셜 뽀모도로 주간 누적 리포트
              </p>
            </div>
          </div>
          <button
            onClick={() => onCloseRef.current?.()}
            className="p-2 text-[#7e867e] hover:text-[#253e30] hover:bg-[#eef2e6] rounded-lg transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 모달 본문 (스크롤 가능) */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 상단 4대 핵심 KPI 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#f5f8f0] border border-[#e2e9db]">
              <span className="text-xs text-[#637d68] font-medium">주간 평균 자세</span>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-bold text-[#285b46]">{kpi.weeklyAvgScore}</span>
                <span className="text-xs font-semibold text-[#8aaa71]">점</span>
                <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded bg-[#285b46] text-white">
                  {kpi.postureGrade}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f5f8f0] border border-[#e2e9db]">
              <span className="text-xs text-[#637d68] font-medium">총 집중 시간</span>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-2xl font-bold text-[#285b46]">
                  {Math.round((kpi.totalFocusMinutes / 60) * 10) / 10}
                </span>
                <span className="text-xs font-semibold text-[#637d68]">시간</span>
                <span className="ml-auto text-[11px] text-[#8aaa71]">
                  ({kpi.totalFocusMinutes}분)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#fbf6ed] border border-[#fae2c8]">
              <span className="text-xs text-[#b46b2b] font-medium">거북목 교정 방지</span>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-2xl font-bold text-[#b46b2b]">
                  {kpi.totalWarningPrevented}
                </span>
                <span className="text-xs font-semibold text-[#b46b2b]">회</span>
                <span className="ml-auto text-[11px] text-[#e07a38] font-medium">경각심 유지</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f0f6fc] border border-[#d2e3f8]">
              <span className="text-xs text-[#3969a8] font-medium">연속 실천 일수</span>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-2xl font-bold text-[#2b589a]">{kpi.streakDays}</span>
                <span className="text-xs font-semibold text-[#3969a8]">일째</span>
                <span className="ml-auto text-[11px] text-[#3b82f6] font-medium">🔥 스트릭</span>
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex items-center justify-between border-b border-[#e7eae2] pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('score')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'score'
                    ? 'bg-[#285b46] text-white shadow-sm'
                    : 'bg-[#f0f3eb] text-[#6b756b] hover:bg-[#e4ebd9]'
                }`}
              >
                📈 일별 자세 점수 추이
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('time')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'time'
                    ? 'bg-[#285b46] text-white shadow-sm'
                    : 'bg-[#f0f3eb] text-[#6b756b] hover:bg-[#e4ebd9]'
                }`}
              >
                ⏱️ 집중 시간 & 경고 빈도
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'table'
                    ? 'bg-[#285b46] text-white shadow-sm'
                    : 'bg-[#f0f3eb] text-[#6b756b] hover:bg-[#e4ebd9]'
                }`}
              >
                📋 일별 상세 통계표
              </button>
            </div>
            <span className="text-[11px] text-[#8e968b]">최근 7일 모니터링 분석</span>
          </div>

          {/* 차트 및 통계표 영역 (깜빡임 없이 즉시 고정 렌더링) */}
          <div className="h-[280px] w-full bg-[#fbfcf8] border border-[#e8ece0] rounded-xl p-3 sm:p-4">
            {activeTab === 'score' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#285b46" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#285b46" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ece2" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#6e776e' }} />
                  <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#6e776e' }} unit="점" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as DailyPostureStat
                        return (
                          <div className="bg-white border border-[#dde3d7] p-2.5 rounded-lg shadow-md text-xs space-y-1">
                            <strong className="text-[#253e30] block">{d.date}</strong>
                            <div className="text-[#285b46] font-bold">
                              평균 자세 점수: {d.avgScore}점
                            </div>
                            <div className="text-[#7e867e]">
                              집중 시간: {d.focusMinutes}분 · 경고 {d.warningCount}회
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    name="자세 점수"
                    stroke="#285b46"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#scoreGradient)"
                    dot={{ r: 4, fill: '#285b46', strokeWidth: 1.5, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#8aaa71' }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : activeTab === 'time' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ece2" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#6e776e' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6e776e' }} unit="분" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#b46b2b' }}
                    unit="회"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as DailyPostureStat
                        return (
                          <div className="bg-white border border-[#dde3d7] p-2.5 rounded-lg shadow-md text-xs space-y-1">
                            <strong className="text-[#253e30] block">{d.date}</strong>
                            <div className="text-[#285b46] font-medium">
                              누적 집중: {d.focusMinutes}분 ({d.sessionCount}세션)
                            </div>
                            <div className="text-[#b46b2b] font-medium">
                              거북목 경고: {d.warningCount}회
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="focusMinutes"
                    name="집중 시간 (분)"
                    fill="#3a7d5a"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="warningCount"
                    name="경고 횟수 (회)"
                    fill="#e67e3a"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#f4f7ee] text-[#4d5e4b] font-bold border-b border-[#dde5d3]">
                    <tr>
                      <th className="py-2 px-2.5">날짜</th>
                      <th className="py-2 px-2 text-center">자세 점수</th>
                      <th className="py-2 px-2 text-center">누적 집중</th>
                      <th className="py-2 px-2 text-center">거북목 경고</th>
                      <th className="py-2 px-2 text-center">세션</th>
                      <th className="py-2 px-2.5 text-center">상태 등급</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1e8]">
                    {stats.map((row) => (
                      <tr key={row.date} className="hover:bg-[#f6f9f2] transition-colors">
                        <td className="py-2 px-2.5 font-semibold text-[#253e30]">
                          {row.displayDate}
                          <span className="text-[10px] text-[#8a9488] block">{row.date}</span>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-[#285b46]">
                          {row.avgScore}점
                        </td>
                        <td className="py-2 px-2 text-center text-[#4b5563]">
                          {row.focusMinutes}분
                        </td>
                        <td className="py-2 px-2 text-center font-semibold text-[#c86228]">
                          {row.warningCount}회
                        </td>
                        <td className="py-2 px-2 text-center text-[#556353]">
                          {row.sessionCount}회
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.avgScore >= 90
                                ? 'bg-[#d8f0d8] text-[#1c692b]'
                                : row.avgScore >= 80
                                ? 'bg-[#fef3c7] text-[#92400e]'
                                : 'bg-[#fee2e2] text-[#b91c1c]'
                            }`}
                          >
                            {row.avgScore >= 90 ? '최우수' : row.avgScore >= 80 ? '양호' : '주의'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI 종합 처방 코멘트 */}
          <div className="p-4 rounded-xl bg-[#f4f7ee] border border-[#dde5d3] flex items-start gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#285b46] text-[#e4eecf] shrink-0 text-sm font-bold">
              AI
            </span>
            <div className="space-y-1 text-xs">
              <strong className="text-[#253e30] font-bold">목지키미 AI 코칭 진단 리포트</strong>
              <p className="text-[#556353] leading-relaxed">{kpi.adviceComment}</p>
            </div>
          </div>
        </div>

        {/* 모달 하단 버튼 */}
        <div className="px-6 py-3.5 border-t border-[#e7eae2] bg-[#fbfcf8] flex justify-end">
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="px-4 py-2 text-xs font-bold text-[#285b46] bg-[#eef2e6] hover:bg-[#e2ebd6] rounded-lg transition-colors"
          >
            대시보드 닫기
          </button>
        </div>
      </div>
    </div>
  )
}
