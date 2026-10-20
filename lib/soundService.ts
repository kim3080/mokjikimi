/**
 * 목지키미 Web Audio API 기반 오프라인 사운드 알림 서비스
 * - 외부 음원 파일(.mp3, .wav 등) 다운로드 불필요 (네트워크 단절 EXPO 현장 100% 무장애 작동)
 * - 브라우저 자체 주파수 발진기(OscillatorNode)를 통한 초경량/초고속 무지연 신디사이징
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * 사운드 활성화 여부 확인 (기본값: true)
 */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem("mokjikimi_sound_enabled");
    return val !== "false";
  } catch {
    return true;
  }
}

/**
 * 사운드 On/Off 토글 및 설정
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("mokjikimi_sound_enabled", enabled ? "true" : "false");
  } catch {}
}

/**
 * 1. ⚠️ 거북목/자세 붕괴 감지 알림음
 * - D5(587Hz) -> A5(880Hz)의 소프트한 2단 스마트 차임벨
 */
export function playPostureAlertSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // 2단 주파수 슬라이드 (주의 환기형 스마트 톤)
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

    // 부드러운 볼륨 감쇄 (귀에 거슬리지 않는 편안한 알림)
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.33);
  } catch (err) {
    console.warn("오디오 알림 재생 알림:", err);
  }
}

/**
 * 2. 🎯 영점 조절 완료 확인음
 * - C5(523Hz) -> G5(784Hz)의 밝고 경쾌한 상승 톤
 */
export function playCalibrationSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.1); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.29);
  } catch (err) {
    console.warn("영점 확인음 재생 알림:", err);
  }
}

/**
 * 3. ⏱️ 뽀모도로 세션 완료(집중/휴식 전환) 알림음
 * - 싱잉볼 명상 차임벨 느낌의 3단 화음 (C5 -> E5 -> G5 -> C6)
 */
export function playTimerChimeSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const baseTime = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = baseTime + idx * 0.08;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  } catch (err) {
    console.warn("타이머 차임벨 재생 알림:", err);
  }
}
