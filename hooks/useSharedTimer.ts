"use client";

import { useEffect, useState } from "react";
import { advanceIfExpired, getRemainingMs, type Room } from "@/lib/room";

const TICK_MS = 250;

// ----------------------------------------------------
// 공동 뽀모도로 타이머 표시 + 페이즈 자동 전환
// ----------------------------------------------------
export function useSharedTimer(room: Room | null, serverOffsetMs: number) {
  const [localNow, setLocalNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setLocalNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const serverNow = localNow + serverOffsetMs;
  const remainingMs = room ? getRemainingMs(room.timer, serverNow) : 0;
  const isExpired = !!room && room.timer.status === "running" && remainingMs <= 0;
  const roomId = room?.id;
  const version = room?.timer.version;

  // 시간이 다 되면 다음 페이즈로 전환. 참가자 모두 시도하지만 트랜잭션이 한 번만 반영합니다.
  // (동시 충돌을 줄이려고 참가자마다 0~0.6초 랜덤 지연)
  useEffect(() => {
    if (!isExpired || !roomId || version === undefined) return;
    const timeoutId = setTimeout(() => {
      advanceIfExpired(roomId, version, Date.now() + serverOffsetMs).catch((err) =>
        console.error("타이머 페이즈 전환 실패:", err)
      );
    }, Math.random() * 600);
    return () => clearTimeout(timeoutId);
  }, [isExpired, roomId, version, serverOffsetMs]);

  return { remainingMs, serverNow };
}

export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
