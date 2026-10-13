import OpenAI from "openai";
import {
  buildPrompt,
  getMockResponse,
  type AIContextType,
  type AIPersonaType,
  type AlertContext,
  type SessionSummaryContext,
} from "./prompts";

// API Key 가 있을 때만 실제 OpenAI 클라이언트 생성
const apiKey = process.env.OPENAI_API_KEY?.trim();
const client = apiKey ? new OpenAI({ apiKey }) : null;

export interface AICoachRequest {
  persona: AIPersonaType;
  contextType: AIContextType;
  data: AlertContext | SessionSummaryContext;
}

export interface AICoachResponse {
  message: string;
  persona: AIPersonaType;
  contextType: AIContextType;
  isMock: boolean;
  model: string;
  timestamp: string;
}

/**
 * AI 코칭 피드백 생성 (OpenAI API 연동 + 미설정 시 Mock Fallback)
 */
export async function generateAICoachFeedback(
  req: AICoachRequest
): Promise<AICoachResponse> {
  const { persona, contextType, data } = req;
  const now = new Date().toISOString();

  // 1. OpenAI API 키가 없는 경우 -> 정교한 룰 기반 Mock 응답 반환
  if (!client) {
    console.info(
      "[AI Coach] OPENAI_API_KEY 환경변수가 설정되지 않아 페르소나 Fallback 응답을 사용합니다."
    );
    return {
      message: getMockResponse(persona, contextType, data),
      persona,
      contextType,
      isMock: true,
      model: "mock-persona-engine",
      timestamp: now,
    };
  }

  // 2. OpenAI API 호출
  try {
    const { system, user } = buildPrompt(persona, contextType, data);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // 빠르고 비용 효율적인 최신 소형 모델
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: contextType === "alert" ? 100 : 250,
      temperature: persona === "harsh" ? 0.8 : 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    return {
      message: reply || getMockResponse(persona, contextType, data),
      persona,
      contextType,
      isMock: false,
      model: "gpt-4o-mini",
      timestamp: now,
    };
  } catch (error: any) {
    console.error("[AI Coach] OpenAI API 호출 중 오류 발생:", error?.message || error);
    // 에러 발생 시 사용자 경험이 깨지지 않도록 Fallback 응답 제공
    return {
      message: getMockResponse(persona, contextType, data),
      persona,
      contextType,
      isMock: true,
      model: "fallback-after-error",
      timestamp: now,
    };
  }
}
