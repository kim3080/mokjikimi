"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { signInWithGoogle, logoutUser } from "@/lib/auth";
import {
  upsertUserProfile,
  updateUserPersona,
  type UserProfile,
  type AIPersonaType,
} from "@/lib/userService";

// ---------------------------------------------------------------------------
// 1. 로컬 저장소 기반 게스트 사용자 생성 (네트워크 지연/오류 시 즉각 연결용)
// ---------------------------------------------------------------------------
function createFallbackUser(): User {
  const localKey = "mokjikimi_local_uid";
  let uid = typeof window !== "undefined" ? localStorage.getItem(localKey) : null;
  if (!uid) {
    uid = "guest-" + Math.random().toString(36).slice(2, 10);
    if (typeof window !== "undefined") localStorage.setItem(localKey, uid);
  }
  return {
    uid,
    displayName: "지키미",
    email: null,
    photoURL: null,
    isAnonymous: true,
  } as unknown as User;
}

// ---------------------------------------------------------------------------
// 2. 전역 싱글톤 인증 상태 (모든 컴포넌트가 동일한 상태를 실시간 공유)
// ---------------------------------------------------------------------------
let globalUser: User | null = null;
let globalProfile: UserProfile | null = null;
let globalLoading: boolean = true;
let globalError: string | null = null;
let isListenerAttached = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

async function backgroundSyncProfile(user: User) {
  try {
    const p = await upsertUserProfile(user);
    globalProfile = p;
    notifySubscribers();
  } catch (err: any) {
    console.warn("프로필 동기화 (로컬 모드 유지):", err?.message || err);
  }
}

function initAuthListener() {
  if (isListenerAttached) return;
  isListenerAttached = true;

  // 1. Firebase 미설정 시 즉각 로컬 세션 활성화
  if (!isFirebaseConfigured) {
    globalUser = createFallbackUser();
    globalLoading = false;
    notifySubscribers();
    return;
  }

  // 2. [핵심] 안전 타임아웃: 네트워크 지연 시 1초 내에 무조건 로딩을 풀어 무한 대기 방지
  const timeoutId = setTimeout(() => {
    if (globalLoading) {
      console.info("[Auth] 응답 지연으로 즉각 로컬 게스트 세션으로 진입합니다.");
      if (!globalUser) globalUser = createFallbackUser();
      globalLoading = false;
      notifySubscribers();
    }
  }, 1000);

  try {
    const auth = getFirebaseAuth();

    onAuthStateChanged(auth, (current) => {
      clearTimeout(timeoutId);

      if (current) {
        globalUser = current;
        globalLoading = false;
        notifySubscribers();
        // 프로필은 백그라운드에서 비동기 처리하여 화면 렌더링을 절대 지연시키지 않음
        backgroundSyncProfile(current);
        return;
      }

      // 로그인된 사용자가 없으면 익명 로그인 시도
      signInAnonymously(auth)
        .then((cred) => {
          globalUser = cred.user;
          globalLoading = false;
          notifySubscribers();
          backgroundSyncProfile(cred.user);
        })
        .catch((err: any) => {
          console.warn("[Auth] 클라우드 인증 실패 -> 로컬 게스트로 즉시 전환:", err?.code || err);
          globalUser = createFallbackUser();
          globalLoading = false;
          notifySubscribers();
        });
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn("[Auth] 초기화 예외 발생, 로컬 모드로 작동합니다:", err);
    globalUser = createFallbackUser();
    globalLoading = false;
    notifySubscribers();
  }
}

// ---------------------------------------------------------------------------
// 3. React useAuth 커스텀 훅
// ---------------------------------------------------------------------------
export function useAuth() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    initAuthListener();
    const update = () => forceUpdate({});
    subscribers.add(update);
    return () => {
      subscribers.delete(update);
    };
  }, []);

  // Google 소셜 로그인 실행
  const handleGoogleLogin = useCallback(async () => {
    globalLoading = true;
    globalError = null;
    notifySubscribers();

    try {
      const result = await signInWithGoogle();
      globalUser = result.user;
      globalLoading = false;
      notifySubscribers();
      backgroundSyncProfile(result.user);
      return result.user;
    } catch (err: any) {
      globalLoading = false;
      if (err?.code === "auth/popup-closed-by-user") {
        console.info("사용자가 Google 로그인 팝업을 닫았습니다.");
        notifySubscribers();
        return null;
      }
      console.error("Google 로그인 실패:", err);
      globalError = err?.message || "Google 로그인에 실패했습니다.";
      notifySubscribers();
      return null;
    }
  }, []);

  // 로그아웃
  const handleLogout = useCallback(async () => {
    globalLoading = true;
    notifySubscribers();

    try {
      await logoutUser();
      globalUser = createFallbackUser();
      globalProfile = null;
    } catch (err: any) {
      console.error("로그아웃 오류:", err);
    } finally {
      globalLoading = false;
      notifySubscribers();
    }
  }, []);

  // 선호 AI 페르소나 변경
  const handleSetPersona = useCallback(async (persona: AIPersonaType) => {
    if (!globalUser) return;
    try {
      await updateUserPersona(globalUser.uid, persona);
      if (globalProfile) {
        globalProfile.preferredPersona = persona;
        notifySubscribers();
      }
    } catch (err: any) {
      console.error("페르소나 변경 실패:", err);
    }
  }, []);

  return {
    user: globalUser,
    profile: globalProfile,
    isLoading: globalLoading,
    error: globalError,
    loginWithGoogle: handleGoogleLogin,
    logout: handleLogout,
    setPersona: handleSetPersona,
    reloadProfile: () => globalUser && backgroundSyncProfile(globalUser),
  };
}
