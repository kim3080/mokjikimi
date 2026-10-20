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

  // 모달이 열릴 때 백그라운드에서 최신 Firestore 데이터를 무깜빡임(Silent SWR)으로 갱신
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    fetchDailyStats(uid || '')
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
  }, [isOpen, uid])

  if (!isOpen || !mounted) return null

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
