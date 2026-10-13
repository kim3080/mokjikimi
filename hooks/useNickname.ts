"use client";

import { useCallback, useSyncExternalStore } from "react";

// ----------------------------------------------------
// 닉네임은 브라우저(localStorage)에 저장해 다음 입장 때 재사용합니다.
// ----------------------------------------------------
const STORAGE_KEY = "mokjikimi:nickname";
const listeners = new Set<() => void>();
let memoryValue = ""; // localStorage 를 쓸 수 없을 때의 대체 저장소

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memoryValue;
  } catch {
    return memoryValue;
  }
}

const getServerSnapshot = () => "";

export function useNickname() {
  const nickname = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setNickname = useCallback((value: string) => {
    memoryValue = value.trim();
    try {
      localStorage.setItem(STORAGE_KEY, memoryValue);
    } catch {
      // 저장소 접근이 막힌 환경(시크릿 모드 등)에서는 무시
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [nickname, setNickname] as const;
}
