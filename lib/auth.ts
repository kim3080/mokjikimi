import {
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signInWithCredential,
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
 * 팝업 중복 호출(로그인 요청 2회 발생)을 원천 차단하고, 단 1회의 팝업으로 로그인을 완료합니다.
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
      // 사용자가 직접 팝업 창을 닫은 경우 즉시 종료
      if (linkError.code === "auth/popup-closed-by-user") {
        throw linkError;
      }

      // 이미 해당 Google 계정이 별도로 등록되어 있는 경우 (credential-already-in-use)
      // 중요: 2번째 팝업 창을 띄우지 않고, 1번째 팝업에서 이미 획득한 Google Credential로 백그라운드 전환 로그인!
      if (linkError.code === "auth/credential-already-in-use") {
        const credential = GoogleAuthProvider.credentialFromError(linkError);
        if (credential) {
          const cred = await signInWithCredential(auth, credential);
          return { user: cred.user, isLinked: false };
        }
      }
      throw linkError;
    }
  }

  // 2. 로그인되어 있지 않거나 이미 일반 계정인 경우 -> Google 단일 팝업 로그인
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
