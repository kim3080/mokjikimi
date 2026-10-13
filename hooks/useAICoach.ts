"use client";

import { useState, useCallback } from "react";
import type {
  AIPersonaType,
  AIContextType,
  AlertContext,
  SessionSummaryContext,
} from "@/lib/ai/prompts";
import type { AICoachResponse } from "@/lib/ai/openai";

export function useAICoach(initialPersona: AIPersonaType = "healer") {
  const [persona, setPersona] = useState<AIPersonaType>(initialPersona);
  const [feedback, setFeedback] = useState<AICoachResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestFeedback = useCallback(
    async (contextType: AIContextType, data: AlertContext | SessionSummaryContext) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona,
            contextType,
            data,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "AI 코칭 메시지를 가져오지 못했습니다.");
        }

        setFeedback(json.data as AICoachResponse);
        return json.data as AICoachResponse;
      } catch (err: any) {
        console.error("AI Coach 요청 실패:", err);
        setError(err.message || "오류가 발생했습니다.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [persona]
  );

  return {
    persona,
    setPersona,
    feedback,
    isLoading,
    error,
    requestAlertFeedback: (data: AlertContext) => requestFeedback("alert", data),
    requestSessionSummary: (data: SessionSummaryContext) =>
      requestFeedback("session_summary", data),
    clearFeedback: () => setFeedback(null),
  };
}
