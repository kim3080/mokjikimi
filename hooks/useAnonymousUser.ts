"use client";

import { useAuth } from "@/hooks/useAuth";

// useAuth 와 통합하여 단일 인증 리스너 및 세션을 유지합니다.
export function useAnonymousUser() {
  const { user, isLoading, error } = useAuth();
  return { user, isLoading, error };
}
