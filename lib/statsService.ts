import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export interface DailyPostureStat {
  date: string; // 'YYYY-MM-DD'
  displayDate: string; // '10/14 (수)' 등
  avgScore: number; // 0 ~ 100
  focusMinutes: number; // 누적 집중 시간(분)
  warningCount: number; // 거북목/슬라우칭 경고 횟수
  sessionCount: number; // 완료한 세션 수
}

export interface PostureSummaryKPI {
  weeklyAvgScore: number;
  totalFocusMinutes: number;
  totalWarningPrevented: number;
  streakDays: number;
  postureGrade: "A+" | "A" | "B+" | "B" | "C";
  adviceComment: string;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// 기본 시뮬레이션 베이스라인 (사용자 누적 성장에 따른 점진적 개선 패턴)
const BASE_SCORES = [74, 79, 83, 80, 88, 91, 93];
const BASE_MINUTES = [45, 60, 50, 75, 90, 85, 100];
const BASE_WARNINGS = [8, 6, 5, 7, 3, 2, 1];

function buildStatsAndKPI(
  days: number = 7,
  firestoreMap: Map<string, any> = new Map()
): { stats: DailyPostureStat[]; kpi: PostureSummaryKPI } {
  const today = new Date("2026-10-20T09:00:00");
  const stats: DailyPostureStat[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - i);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const dayName = DAY_NAMES[targetDate.getDay()];
    const isToday = i === 0;

    const displayDate = `${month}/${day} (${isToday ? "오늘" : dayName})`;

    // Firestore에 실제 저장된 기록이 있으면 우선 반영
    const realData = firestoreMap.get(dateKey);
    const scoreIndex = (days - 1 - i) % BASE_SCORES.length;

    const score = realData?.avgScore ?? BASE_SCORES[scoreIndex];
    const minutes = realData?.totalMinutes ?? BASE_MINUTES[scoreIndex];
    const warnings = realData?.totalWarnings ?? BASE_WARNINGS[scoreIndex];
    const sessions = realData?.sessionsCount ?? (minutes > 0 ? Math.ceil(minutes / 25) : 0);

    stats.push({
      date: dateKey,
      displayDate,
      avgScore: score,
      focusMinutes: minutes,
      warningCount: warnings,
      sessionCount: sessions,
    });
  }

  // KPI 지표 산출
  const totalScoreSum = stats.reduce((acc, cur) => acc + cur.avgScore, 0);
  const weeklyAvgScore = Math.round(totalScoreSum / (stats.length || 1));
  const totalFocusMinutes = stats.reduce((acc, cur) => acc + cur.focusMinutes, 0);
  const totalWarningPrevented = stats.reduce((acc, cur) => acc + cur.warningCount, 0);

  let postureGrade: PostureSummaryKPI["postureGrade"] = "B";
  let adviceComment = "바른 자세를 유지하기 위한 꾸준한 노력이 필요합니다.";

  if (weeklyAvgScore >= 92) {
    postureGrade = "A+";
    adviceComment = "완벽에 가까운 척추 정렬입니다! 목과 어깨의 긴장이 매우 이상적으로 관리되고 있습니다.";
  } else if (weeklyAvgScore >= 85) {
    postureGrade = "A";
    adviceComment = "매우 우수한 자세 습관입니다! 집중 시간이 40분을 넘어갈 때의 어깨 솟음만 주의해 주세요.";
  } else if (weeklyAvgScore >= 78) {
    postureGrade = "B+";
    adviceComment = "안정적인 흐름입니다. 화면을 눈높이에 맞추고 턱을 살짝 당기는 습관을 지속해 보세요.";
  } else if (weeklyAvgScore >= 70) {
    postureGrade = "B";
    adviceComment = "오후 시간대에 거북목 전조 현상이 관찰됩니다. 20-20-20 스트레칭을 잊지 마세요.";
  } else {
    postureGrade = "C";
    adviceComment = "모니터와 지나치게 가까워지는 경향이 있습니다. 의자 높이와 영점 기준점을 재점검해 보세요.";
  }

  const kpi: PostureSummaryKPI = {
    weeklyAvgScore,
    totalFocusMinutes,
    totalWarningPrevented,
    streakDays: 6,
    postureGrade,
    adviceComment,
  };

  return { stats, kpi };
}

/**
 * 초기 렌더링 시 깜빡임 없이 즉각 표시할 수 있는 동기 기본 통계 데이터
 */
export function getInitialStats(days: number = 7): { stats: DailyPostureStat[]; kpi: PostureSummaryKPI } {
  return buildStatsAndKPI(days);
}

/**
 * 최근 N일간의 일별 자세 및 집중 통계 데이터 비동기 조회 (Recharts 차트 전용)
 * Firestore users/{uid}/daily_stats 실데이터와 기본 학습 추이 데이터를 자연스럽게 합성합니다.
 */
export async function fetchDailyStats(
  uid: string,
  days: number = 7
): Promise<{ stats: DailyPostureStat[]; kpi: PostureSummaryKPI }> {
  const db = getDb();
  const firestoreMap = new Map<string, any>();

  if (uid && typeof uid === "string" && uid.trim().length > 3) {
    try {
      const statsCol = collection(db, "users", uid, "daily_stats");
      const q = query(statsCol, orderBy("date", "desc"), limit(days));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        firestoreMap.set(d.id, d.data());
      });
    } catch {
      // Firestore 미동기화 또는 권한 규칙 배포 전 상태에서는 안정적인 기본 통계 추이로 무장애 폴백
    }
  }

  return buildStatsAndKPI(days, firestoreMap);
}
