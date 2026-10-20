"use client";

import { useAICoach } from "@/hooks/useAICoach";
import { useAuth } from "@/hooks/useAuth";
import type { AIPersonaType } from "@/lib/ai/prompts";

export function AICoachCard() {
  const { profile, setPersona: savePersonaPreference } = useAuth();
  const currentPersona = profile?.preferredPersona || "healer";

  const {
    persona,
    setPersona,
    feedback,
    isLoading,
    error,
    requestAlertFeedback,
    requestSessionSummary,
  } = useAICoach(currentPersona);

  const handlePersonaChange = (next: AIPersonaType) => {
    setPersona(next);
    savePersonaPreference(next);
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
      {/* 헤더: 타이틀 & 페르소나 토글 */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{persona === "harsh" ? "💥" : "🌿"}</span>
          <div>
            <h3 className="font-bold text-neutral-800 text-sm">
              AI 자세 코치 ({persona === "harsh" ? "팩폭 모드" : "힐러 모드"})
            </h3>
            <p className="text-[11px] text-neutral-400">
              {persona === "harsh"
                ? "뼈를 때리는 냉철한 스파르타 직설 코칭"
                : "마음을 다독이는 따스한 공감 힐링 코칭"}
            </p>
          </div>
        </div>

        {/* 팩폭 vs 힐러 탭 */}
        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => handlePersonaChange("healer")}
            className={`px-2.5 py-1 rounded-md transition-all ${
              persona === "healer"
                ? "bg-white text-emerald-700 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            🌿 힐러
          </button>
          <button
            type="button"
            onClick={() => handlePersonaChange("harsh")}
            className={`px-2.5 py-1 rounded-md transition-all ${
              persona === "harsh"
                ? "bg-white text-rose-700 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            💥 팩폭
          </button>
        </div>
      </div>

      {/* AI 피드백 메시지 박스 */}
      <div
        className={`rounded-xl p-4 text-sm leading-relaxed transition-colors border ${
          persona === "harsh"
            ? "bg-rose-50/70 border-rose-200/80 text-rose-950"
            : "bg-emerald-50/70 border-emerald-200/80 text-emerald-950"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-neutral-500 py-2">
            <span className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">
              {persona === "harsh"
                ? "팩트 폭격 준비 중..."
                : "따뜻한 격려 메시지 작성 중..."}
            </span>
          </div>
        ) : feedback ? (
          <div className="space-y-1.5">
            <p className="whitespace-pre-line font-medium text-xs md:text-sm">
              {feedback.message}
            </p>
            <div className="flex items-center justify-between pt-1 text-[10px] text-neutral-400">
              <span>엔진: {feedback.model}</span>
              <span>
                {feedback.contextType === "alert" ? "실시간 경고" : "세션 요약"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic py-1">
            {persona === "harsh"
              ? "“허리 펴세요. 디스크 터지면 후회해도 늦습니다.” — 아래 피드백 버튼을 눌러 자세 코칭을 받아보세요."
              : "“무리하지 말고 편안하게 호흡하세요. 당신의 건강이 가장 소중해요.” — 아래 피드백 버튼을 눌러 자세 코칭을 받아보세요."}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-rose-600">⚠️ {error}</p>}

      {/* 시연 및 테스트 버튼 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() =>
            requestAlertFeedback({
              score: 45,
              neckPitchDeg: 32,
              badPostureDurationSec: 15,
            })
          }
          disabled={isLoading}
          className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs py-2 px-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          🚨 불량 자세 경고 피드백
        </button>
        <button
          type="button"
          onClick={() =>
            requestSessionSummary({
              totalFocusMin: 25,
              avgScore: 78,
              badPostureRatio: 22,
              warningCount: 4,
            })
          }
          disabled={isLoading}
          className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs py-2 px-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          📊 세션 완료 총평 받기
        </button>
      </div>
    </div>
  );
}
