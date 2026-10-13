import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

// ----------------------------------------------------
// Firestore 데이터 구조
//   rooms/{roomId}                 : 방 정보 + 공동 타이머 상태 (roomId = 6자리 방 코드)
//   rooms/{roomId}/members/{uid}   : 참가자 닉네임, 자세 상태, 접속 heartbeat
// ----------------------------------------------------
export type TimerMode = "work" | "break";
export type PostureStatus = "perfect" | "warning" | "danger";

// 타이머는 매초 쓰지 않고 "기준 시각 + 남은 시간"만 저장합니다.
// 각 클라이언트가 현재 시각과의 차이로 남은 시간을 직접 계산하므로 쓰기 횟수가 최소화됩니다.
export interface TimerState {
  mode: TimerMode;
  status: "running" | "paused";
  remainingMs: number; // running: startedAt 시점의 남은 시간 / paused: 멈춘 시점의 남은 시간
  startedAt: Timestamp | null; // running 일 때만 존재 (서버 시각)
  version: number; // 타이머가 바뀔 때마다 +1 (페이즈 자동 전환 중복 방지용)
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  workSec: number;
  breakSec: number;
  createdAt: Timestamp | null;
  timer: TimerState;
}

export interface Member {
  uid: string;
  nickname: string;
  posture: PostureStatus | null; // null = 카메라 꺼짐
  joinedAt: Timestamp | null;
  lastSeen: Timestamp | null;
}

// Firestore 에 쓰는 타이머 (startedAt 에 serverTimestamp() 를 넣을 수 있음)
type TimerWrite = Omit<TimerState, "startedAt"> & { startedAt: Timestamp | FieldValue | null };

export const HEARTBEAT_INTERVAL_MS = 20_000;
export const ONLINE_THRESHOLD_MS = 50_000;

const roomRef = (roomId: string) => doc(getDb(), "rooms", roomId);
const memberRef = (roomId: string, uid: string) => doc(getDb(), "rooms", roomId, "members", uid);
export const membersCol = (roomId: string) => collection(getDb(), "rooms", roomId, "members");
export { roomRef };

// ----------------------------------------------------
// 남은 시간 계산 (nowMs 는 서버 시각 보정이 적용된 현재 시각)
// ----------------------------------------------------
export function getRemainingMs(timer: TimerState, nowMs: number): number {
  if (timer.status === "paused" || !timer.startedAt) return Math.max(0, timer.remainingMs);
  return Math.max(0, timer.remainingMs - (nowMs - timer.startedAt.toMillis()));
}

const phaseDurationMs = (room: Pick<Room, "workSec" | "breakSec">, mode: TimerMode) =>
  (mode === "work" ? room.workSec : room.breakSec) * 1000;

const nextMode = (mode: TimerMode): TimerMode => (mode === "work" ? "break" : "work");

// ----------------------------------------------------
// 방 생성 / 입장 / 퇴장
// ----------------------------------------------------
// 헷갈리는 문자(0/O, 1/I)를 뺀 방 코드 문자 집합
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

function generateRoomCode(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => ROOM_CODE_ALPHABET[n % ROOM_CODE_ALPHABET.length]
  ).join("");
}

// 방 코드를 문서 ID 로 사용합니다. 드물게 코드가 겹치면 새 코드로 다시 시도합니다.
export async function createRoom(params: {
  name: string;
  hostId: string;
  workMin: number;
  breakMin: number;
}): Promise<string> {
  const workSec = Math.round(params.workMin * 60);
  const breakSec = Math.round(params.breakMin * 60);
  const timer: TimerWrite = {
    mode: "work",
    status: "paused",
    remainingMs: workSec * 1000,
    startedAt: null,
    version: 0,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const created = await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(roomRef(code));
      if (snap.exists()) return false;
      tx.set(roomRef(code), {
        name: params.name,
        hostId: params.hostId,
        workSec,
        breakSec,
        createdAt: serverTimestamp(),
        timer,
      });
      return true;
    });
    if (created) return code;
  }
  throw new Error("방 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
}

export async function roomExists(code: string): Promise<boolean> {
  return (await getDoc(roomRef(code))).exists();
}

export async function joinRoom(roomId: string, uid: string, nickname: string) {
  await setDoc(memberRef(roomId, uid), {
    nickname,
    posture: null,
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  });
}

export async function leaveRoom(roomId: string, uid: string) {
  await deleteDoc(memberRef(roomId, uid));
}

export async function sendHeartbeat(roomId: string, uid: string) {
  await updateDoc(memberRef(roomId, uid), { lastSeen: serverTimestamp() });
}

export async function updatePosture(roomId: string, uid: string, posture: PostureStatus | null) {
  await updateDoc(memberRef(roomId, uid), { posture });
}

// ----------------------------------------------------
// 공동 타이머 조작 (모두 트랜잭션: 동시에 눌러도 최신 상태 기준으로 한 번만 반영)
// ----------------------------------------------------
async function mutateTimer(
  roomId: string,
  next: (room: Room) => Omit<TimerWrite, "version"> | null
): Promise<boolean> {
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(roomRef(roomId));
    if (!snap.exists()) throw new Error("존재하지 않는 스터디룸입니다.");
    const room = { id: snap.id, ...snap.data() } as Room;
    const timer = next(room);
    if (!timer) return false;
    const write: TimerWrite = { ...timer, version: room.timer.version + 1 };
    tx.update(roomRef(roomId), { timer: write });
    return true;
  });
}

export function startTimer(roomId: string) {
  return mutateTimer(roomId, (room) => {
    if (room.timer.status === "running") return null;
    return { ...room.timer, status: "running", startedAt: serverTimestamp() };
  });
}

export function pauseTimer(roomId: string, nowMs: number) {
  return mutateTimer(roomId, (room) => {
    if (room.timer.status === "paused") return null;
    return {
      ...room.timer,
      status: "paused",
      remainingMs: getRemainingMs(room.timer, nowMs),
      startedAt: null,
    };
  });
}

export function resetTimer(roomId: string) {
  return mutateTimer(roomId, (room) => ({
    mode: "work",
    status: "paused",
    remainingMs: phaseDurationMs(room, "work"),
    startedAt: null,
  }));
}

// 집중/휴식 모드 전환: 선택한 모드의 처음 상태(정지)로 초기화
export function setTimerMode(roomId: string, mode: TimerMode) {
  return mutateTimer(roomId, (room) => {
    if (room.timer.mode === mode) return null;
    return {
      mode,
      status: "paused",
      remainingMs: phaseDurationMs(room, mode),
      startedAt: null,
    };
  });
}

// 스터디룸 내부에서 타이머 주기(50분/10분 vs 90분/30분 등) 즉시 변경
export async function updateTimerRhythm(roomId: string, workMin: number, breakMin: number) {
  const workSec = Math.round(workMin * 60);
  const breakSec = Math.round(breakMin * 60);

  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(roomRef(roomId));
    if (!snap.exists()) throw new Error("존재하지 않는 스터디룸입니다.");
    const room = { id: snap.id, ...snap.data() } as Room;

    const currentMode = room.timer.mode;
    const newRemainingMs = (currentMode === "work" ? workSec : breakSec) * 1000;

    const write: TimerWrite = {
      mode: currentMode,
      status: "paused",
      remainingMs: newRemainingMs,
      startedAt: null,
      version: room.timer.version + 1,
    };

    tx.update(roomRef(roomId), {
      workSec,
      breakSec,
      timer: write,
    });
    return true;
  });
}

// 시간이 다 되면 모든 참가자가 호출하지만, version 이 일치하는 첫 호출만 반영됩니다.
export function advanceIfExpired(roomId: string, expectedVersion: number, nowMs: number) {
  return mutateTimer(roomId, (room) => {
    const { timer } = room;
    if (timer.version !== expectedVersion || timer.status !== "running") return null;
    if (getRemainingMs(timer, nowMs) > 0) return null;
    const mode = nextMode(timer.mode);
    return {
      mode,
      status: "running",
      remainingMs: phaseDurationMs(room, mode),
      startedAt: serverTimestamp(),
    };
  });
}

// 초대 링크 또는 방 코드 입력값에서 방 코드 추출 (소문자 입력 허용)
export function parseRoomCode(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/room\/([A-Za-z0-9]+)/);
  const code = (fromLink ? fromLink[1] : trimmed).toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

// ----------------------------------------------------
// 입력 검증 (UI 편의용. 실제 보호는 firestore.rules 가 담당)
// ----------------------------------------------------
export const NICKNAME_MAX_LENGTH = 12;
export const ROOM_NAME_MAX_LENGTH = 30;

export function validateNickname(value: string): string | undefined {
  if (!value.trim()) return "닉네임을 입력해 주세요.";
  if (value.trim().length > NICKNAME_MAX_LENGTH) return `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`;
}

export function validateRoomName(value: string): string | undefined {
  if (!value.trim()) return "방 이름을 입력해 주세요.";
  if (value.trim().length > ROOM_NAME_MAX_LENGTH) return `방 이름은 ${ROOM_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`;
}

export function validateRoomCode(value: string): string | undefined {
  if (!parseRoomCode(value)) return "방 코드는 영문·숫자 6자리로 입력해 주세요.";
}
