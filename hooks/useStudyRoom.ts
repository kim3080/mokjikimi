"use client";

import { useEffect, useRef, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import {
  HEARTBEAT_INTERVAL_MS,
  joinRoom,
  leaveRoom,
  membersCol,
  roomRef,
  sendHeartbeat,
  type Member,
  type Room,
} from "@/lib/room";

// ----------------------------------------------------
// 스터디룸 실시간 구독 + 입장/퇴장 + 접속 유지(heartbeat)
// ----------------------------------------------------
export function useStudyRoom(roomId: string, uid: string | null, nickname: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 로컬 시계와 서버 시계의 차이(ms). 서버 시각 ≈ Date.now() + serverOffsetMs
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const heartbeatSentAtRef = useRef<number | null>(null);

  const roomExists = room !== null;

  // 1. 방 문서 구독
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      roomRef(roomId),
      (snap) => {
        setIsLoading(false);
        if (!snap.exists()) {
          setNotFound(true);
          setRoom(null);
          return;
        }
        setNotFound(false);
        // 내가 방금 쓴 serverTimestamp 는 서버 확정 전까지 추정값으로 표시
        const data = snap.data({ serverTimestamps: "estimate" });
        setRoom({ id: snap.id, ...data } as Room);
      },
      (err) => {
        console.error("스터디룸 구독 실패:", err);
        setIsLoading(false);
        setError("스터디룸 정보를 불러오지 못했습니다.");
      }
    );
  }, [roomId, uid]);

  // 2. 참가자 목록 구독 (+ 내 heartbeat 가 서버에 확정되는 순간으로 시계 오차 추정)
  useEffect(() => {
    if (!uid) return;
    const q = query(membersCol(roomId), orderBy("joinedAt", "asc"));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setMembers(
          snap.docs.map((d) => ({ uid: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as Member)
        );

        const mine = snap.docs.find((d) => d.id === uid);
        const sentAt = heartbeatSentAtRef.current;
        if (mine && sentAt !== null && !mine.metadata.hasPendingWrites) {
          const serverMs = mine.get("lastSeen")?.toMillis?.();
          if (typeof serverMs === "number") {
            // 요청~응답 왕복의 중간 시점을 서버 기록 시각으로 간주
            setServerOffsetMs(serverMs - (sentAt + Date.now()) / 2);
          }
          heartbeatSentAtRef.current = null;
        }
      },
      (err) => {
        console.error("참가자 목록 구독 실패:", err);
        setError("참가자 목록을 불러오지 못했습니다.");
      }
    );
  }, [roomId, uid]);

  // 3. 입장 → heartbeat 주기 전송 → 퇴장 시 참가자 문서 삭제
  useEffect(() => {
    if (!uid || !nickname || !roomExists) return;
    let cancelled = false;

    const beat = () => {
      heartbeatSentAtRef.current = Date.now();
      sendHeartbeat(roomId, uid).catch((err) => console.error("heartbeat 실패:", err));
    };

    heartbeatSentAtRef.current = Date.now();
    joinRoom(roomId, uid, nickname).catch((err) => {
      console.error("스터디룸 입장 실패:", err);
      if (!cancelled) setError("스터디룸 입장에 실패했습니다.");
    });
    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    // 탭을 닫거나 새로고침할 때도 최대한 퇴장 처리 (실패해도 lastSeen 으로 오프라인 판정)
    const handlePageHide = () => {
      leaveRoom(roomId, uid).catch(() => {});
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("pagehide", handlePageHide);
      leaveRoom(roomId, uid).catch(() => {});
    };
  }, [roomId, uid, nickname, roomExists]);

  return { room, members, isLoading: isLoading && !!uid, notFound, error, serverOffsetMs };
}
