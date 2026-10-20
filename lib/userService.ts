import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "@/lib/firebase";

// ----------------------------------------------------
// 1. 사용자 프로필 및 환경설정 타입
// ----------------------------------------------------
export type AIPersonaType = "harsh" | "healer";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  preferredPersona: AIPersonaType; // 'harsh' (팩폭) | 'healer' (힐러)
  totalFocusMinutes: number; // 누적 집중 시간(분)
  totalSessions: number; // 완료한 총 세션 수
  avgPostureScore: number; // 누적 평균 자세 점수 (0~100)
  streakDays: number; // 연속 출석 일수
  lastActiveDate: string | null; // 'YYYY-MM-DD'
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ----------------------------------------------------
// 2. 자세 점수 및 캡처 로그 타입
// ----------------------------------------------------
export type PostureLevel = "perfect" | "warning" | "danger";

export interface PostureMetrics {
  neckPitchDeg?: number; // 목 숙임 각도 (피치)
  shoulderTiltDeg?: number; // 어깨 기울기 각도 (롤)
  distanceRatio?: number; // 권장 거리 대비 비율
}

export interface PostureLog {
  id?: string;
  uid: string;
  roomId?: string;
  score: number; // 자세 점수 (0~100)
  level: PostureLevel; // 'perfect' | 'warning' | 'danger'
  metrics: PostureMetrics;
  snapshotUrl?: string; // 캡처 스냅샷 이미지 URL (Firebase Storage 등)
  detectedAt: Timestamp | null;
  triggerReason?: string; // 'timer_interval' | 'bad_posture_alert' | 'session_end'
}

// ----------------------------------------------------
// Firestore 레퍼런스 헬퍼
// ----------------------------------------------------
const userRef = (uid: string) => doc(getDb(), "users", uid);
const logsCol = (uid: string) => collection(getDb(), "users", uid, "posture_logs");

/**
 * 로그인 시 사용자 프로필 자동 동기화 (없으면 신규 생성, 있으면 최신 정보 갱신)
 */
export async function upsertUserProfile(user: User): Promise<UserProfile> {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);

  const todayStr = new Date().toISOString().split("T")[0];

  if (!snap.exists()) {
    const newProfile: Omit<UserProfile, "createdAt" | "updatedAt"> & {
      createdAt: any;
      updatedAt: any;
    } = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || (user.isAnonymous ? "익명 지키미" : "바른이"),
      photoURL: user.photoURL,
      isAnonymous: user.isAnonymous,
      preferredPersona: "healer", // 기본값은 따뜻한 힐러 모드
      totalFocusMinutes: 0,
      totalSessions: 0,
      avgPostureScore: 100,
      streakDays: 1,
      lastActiveDate: todayStr,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, newProfile);
    return newProfile as unknown as UserProfile;
  }

  // 기존 사용자: 기본 정보(이름, 사진, 최근 활동일) 갱신
  const existing = snap.data() as UserProfile;
  let streak = existing.streakDays || 1;

  if (existing.lastActiveDate && existing.lastActiveDate !== todayStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (existing.lastActiveDate === yesterdayStr) {
      streak += 1;
    } else {
      streak = 1;
    }
  }

  const updates = {
    email: user.email ?? existing.email,
    displayName: user.displayName ?? existing.displayName,
    photoURL: user.photoURL ?? existing.photoURL,
    isAnonymous: user.isAnonymous,
    streakDays: streak,
    lastActiveDate: todayStr,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, updates);
  return { ...existing, ...updates } as UserProfile;
}

/**
 * 사용자 프로필 조회
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/**
 * AI 페르소나 설정 변경 ('harsh' 팩폭 vs 'healer' 힐러)
 */
export async function updateUserPersona(uid: string, persona: AIPersonaType): Promise<void> {
  await updateDoc(userRef(uid), {
    preferredPersona: persona,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 자세 및 캡처 로그 저장 + 사용자 평균 점수 자동 재계산 트랜잭션
 */
export async function recordPostureLog(
  uid: string,
  logData: Omit<PostureLog, "id" | "uid" | "detectedAt">
): Promise<string> {
  const db = getDb();
  const uRef = userRef(uid);
  const logDocRef = doc(logsCol(uid));

  await runTransaction(db, async (txn) => {
    const userSnap = await txn.get(uRef);
    const currentData = userSnap.data() as UserProfile | undefined;

    // 1. 로그 문서 작성
    txn.set(logDocRef, {
      ...logData,
      uid,
      detectedAt: serverTimestamp(),
    });

    // 2. 사용자 평균 점수 갱신 (지수가중평균 또는 누적 갱신)
    if (currentData) {
      const prevAvg = currentData.avgPostureScore ?? 100;
      // 점수 업데이트 가중치 (신규 측정 점수 15% 반영)
      const newAvg = Math.round(prevAvg * 0.85 + logData.score * 0.15);

      txn.update(uRef, {
        avgPostureScore: newAvg,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return logDocRef.id;
}

/**
 * 집중 세션 완료 후 세션 시간 및 점수 누적 반영
 */
export async function finishFocusSession(
  uid: string,
  focusMinutes: number,
  sessionAvgScore: number
): Promise<void> {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as UserProfile;
  const currentTotalMin = (data.totalFocusMinutes || 0) + focusMinutes;
  const currentTotalSessions = (data.totalSessions || 0) + 1;
  const newAvg = Math.round(((data.avgPostureScore || 100) * 0.8) + (sessionAvgScore * 0.2));

  await updateDoc(ref, {
    totalFocusMinutes: currentTotalMin,
    totalSessions: currentTotalSessions,
    avgPostureScore: newAvg,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 최근 자세/캡처 로그 목록 조회 (최신순)
 */
export async function getRecentPostureLogs(uid: string, count = 20): Promise<PostureLog[]> {
  const q = query(logsCol(uid), orderBy("detectedAt", "desc"), limit(count));
  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<PostureLog, "id">),
  }));
}
