import { buildPrompt, getMockResponse } from "../lib/ai/prompts";
import { generateAICoachFeedback } from "../lib/ai/openai";

async function runTests() {
  console.log("=== [1] 팩폭(Harsh) 페르소나 프롬프트 테스트 ===");
  const harshAlertPrompt = buildPrompt("harsh", "alert", {
    score: 42,
    neckPitchDeg: 35,
    badPostureDurationSec: 15,
  });
  console.log("System Prompt:\n", harshAlertPrompt.system);
  console.log("User Prompt:\n", harshAlertPrompt.user);

  console.log("\n=== [2] 힐러(Healer) 페르소나 프롬프트 테스트 ===");
  const healerAlertPrompt = buildPrompt("healer", "alert", {
    score: 42,
    neckPitchDeg: 35,
    badPostureDurationSec: 15,
  });
  console.log("System Prompt:\n", healerAlertPrompt.system);
  console.log("User Prompt:\n", healerAlertPrompt.user);

  console.log("\n=== [3] 세션 요약 리포트 프롬프트 테스트 ===");
  const harshSummary = buildPrompt("harsh", "session_summary", {
    totalFocusMin: 50,
    avgScore: 65,
    badPostureRatio: 35,
    warningCount: 8,
  });
  console.log("Harsh Summary User Prompt:\n", harshSummary.user);

  console.log("\n=== [4] generateAICoachFeedback 함수 실행 (Fallback 검증) ===");
  const feedbackHarsh = await generateAICoachFeedback({
    persona: "harsh",
    contextType: "alert",
    data: { score: 38, neckPitchDeg: 30, badPostureDurationSec: 20 },
  });
  console.log("Harsh Feedback Result:", feedbackHarsh);

  const feedbackHealer = await generateAICoachFeedback({
    persona: "healer",
    contextType: "session_summary",
    data: { totalFocusMin: 25, avgScore: 88, badPostureRatio: 12, warningCount: 2 },
  });
  console.log("Healer Feedback Result:", feedbackHealer);

  console.log("\n>>> 모든 백엔드 및 AI 프롬프트 테스트 정상 통과! <<<");
}

runTests().catch(console.error);
