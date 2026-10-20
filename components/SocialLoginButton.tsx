"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function SocialLoginButton() {
  const [mounted, setMounted] = useState(false);
  const { user, profile, isLoading, loginWithGoogle, logout } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-400" suppressHydrationWarning>
        <span className="inline-block w-3 h-3 rounded-full border-2 border-neutral-300 border-t-neutral-600 animate-spin" />
        계정 확인 중...
      </div>
    );
  }

  // Google 소셜 계정으로 로그인된 상태
  if (user && !user.isAnonymous) {
    return (
      <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-full px-3 py-1.5 shadow-sm text-sm">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || "프로필"}
            className="w-6 h-6 rounded-full object-cover border border-neutral-300"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">
            {user.displayName?.[0] || "U"}
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-medium text-neutral-800 leading-tight">
            {user.displayName || "구글 사용자"}
          </span>
          {profile?.streakDays ? (
            <span className="text-[10px] text-emerald-600 font-semibold">
              🔥 {profile.streakDays}일 연속 바른자세
            </span>
          ) : null}
        </div>
        <button
          onClick={logout}
          className="ml-2 text-xs text-neutral-500 hover:text-red-500 transition-colors"
          title="로그아웃"
        >
          로그아웃
        </button>
      </div>
    );
  }

  // 익명 로그인 상태 또는 미로그인 상태 -> Google 로그인/연동 유도
  return (
    <button
      onClick={loginWithGoogle}
      disabled={isLoading}
      className="flex items-center gap-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
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
      <span>Google 계정 연동</span>
    </button>
  );
}
