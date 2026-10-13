import {
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

// Google Auth Provider 설정
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");
googleProvider.setCustomParameters({
  prompt: "select_account",
  client_id:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_CLIENT_ID ??
    "759112410336-obehvfk8bsljceubufptto4p3cro2fbi.apps.googleusercontent.com",
});

/**
 * Google 소셜 로그인 실행
 * 만약 현재 사용자가 익명 로그인 상태라면, 기존 uid와 데이터를 보존하기 위해 linkWithPopup을 우선 시도합니다.
 */
export async function signInWithGoogle(): Promise<{ user: User; isNewUser?: boolean; isLinked?: boolean }> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase 설정값이 없습니다. .env.local 설정을 확인하세요.");
  }

  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  // 1. 현재 익명 사용자로 로그인되어 있는 경우 -> Google 계정과 연동(Link) 시도
  if (currentUser && currentUser.isAnonymous) {
    try {
      const cred: UserCredential = await linkWithPopup(currentUser, googleProvider);
      return { user: cred.user, isLinked: true };
    } catch (linkError: any) {
      // 이미 해당 Google 계정이 별도로 등록되어 있는 경우 (credential-already-in-use)
      // 링크 대신 해당 Google 계정으로 직접 로그인 진행
      if (linkError.code === "auth/credential-already-in-use") {
        console.warn("해당 Google 계정이 이미 존재하므로 직접 로그인을 진행합니다.");
        const cred = await signInWithPopup(auth, googleProvider);
        return { user: cred.user, isLinked: false };
      }
      throw linkError;
    }
  }

  // 2. 로그인되어 있지 않거나 이미 일반 계정인 경우 -> Google 팝업 로그인
  const cred = await signInWithPopup(auth, googleProvider);
  return { user: cred.user, isLinked: false };
}

/**
 * 로그아웃
 */
export async function logoutUser(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const auth = getFirebaseAuth();
  await signOut(auth);
}
