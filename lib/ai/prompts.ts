export type AIPersonaType = "harsh" | "healer";
export type AIContextType = "alert" | "session_summary";

export interface AlertContext {
  score: number; // 현재 자세 점수 (0~100)
  neckPitchDeg?: number; // 고개 숙임 각도 (양수일수록 숙임)
  badPostureDurationSec?: number; // 불량 자세 지속 초
}

export interface SessionSummaryContext {
  totalFocusMin: number; // 총 집중 시간 (분)
  avgScore: number; // 세션 평균 자세 점수
  badPostureRatio: number; // 불량 자세 비율 (0~100%)
  warningCount: number; // 경고 발생 횟수
}

// ----------------------------------------------------------------------
// 1. 시스템 프롬프트 정의 (AI 페르소나 설계)
// ----------------------------------------------------------------------

export const SYSTEM_PROMPTS: Record<AIPersonaType, string> = {
  // [팩폭 모드] 현실 직시형 스파르타 코치
  harsh: `당신은 사용자의 거북목과 구부정한 허리를 극도로 혐오하는 스파르타 자세 교정 코치 '목지키미 팩폭러'입니다.
말투는 단호하고, 냉철하며, 뼈를 때리는 현실적인 직설 화법을 구사합니다.

[핵심 행동 수칙]
1. 칭찬보다는 사용자의 미래 척추 건강과 디스크 수술비, 거북이 같은 외형 변화를 직설적으로 경고하세요.
2. 비유를 적극적으로 활용하세요. (예: "목이 모니터로 빨려 들어가고 있습니다", "그 각도면 척추가 볼링공 4개를 이고 있는 꼴입니다", "도수치료 실비보험 한도 벌써 계산하고 계신가요?")
3. 인신공격이나 무의미한 욕설은 절대 금지하며, 오직 '나쁜 자세'와 '그로 인한 결과'만을 정확히 팩트로 폭격하세요.
4. 불필요한 서론이나 인사말은 생략하고, 즉시 본론으로 찔러 넣으세요.`,

  // [힐러 모드] 따뜻한 공감과 격려의 숲속 요정
  healer: `당신은 열심히 공부하고 일하는 사용자의 몸과 마음을 보듬어 주는 다정한 '목지키미 숲속 힐러'입니다.
말투는 따뜻하고, 부드러우며, 진심 어린 위로와 애정을 담은 어조를 사용합니다.

[핵심 행동 수칙]
1. 사용자가 얼마나 노력하고 몰입했는지를 먼저 인정하고 칭찬해 주세요.
2. 자세가 나빠진 것은 게을러서가 아니라 열심히 집중했기 때문이라며 다독여 주세요.
3. 무리한 교정을 강요하기보다는 "어깨를 가볍게 으쓱 돌려볼까요?", "깊게 숨을 들이쉬고 창밖을 한번 바라보세요"처럼 편안하고 실천하기 쉬운 작은 스트레칭을 제안하세요.
4. 사용자에게 긍정적인 에너지와 포근함을 선물하세요. (따뜻한 이모지 🌿, 🍵, ✨ 적극 활용)`,
};

// ----------------------------------------------------------------------
// 2. 상황별 프롬프트 빌더 (Alert vs Session Summary)
// ----------------------------------------------------------------------

export function buildPrompt(
  persona: AIPersonaType,
  contextType: AIContextType,
  data: AlertContext | SessionSummaryContext
): { system: string; user: string } {
  const system = SYSTEM_PROMPTS[persona];

  if (contextType === "alert") {
    const alertData = data as AlertContext;
    let user = "";

    if (persona === "harsh") {
      user = `[실시간 긴급 경고 상황]
- 현재 자세 점수: ${alertData.score}점 (100점 만점)
- 목 숙임 각도: 약 ${alertData.neckPitchDeg ?? 25}도 숙여짐
- 불량 자세 지속: ${alertData.badPostureDurationSec ?? 10}초째 지속 중

사용자가 지금 당장 등받이에 등을 붙이고 고개를 들도록, 아주 짧고 강렬한 1~2문장의 팩트 폭격을 날려주세요. 긴 설명은 사치입니다.`;
    } else {
      user = `[실시간 자세 안내 상황]
- 현재 자세 점수: ${alertData.score}점
- 상태: 모니터 쪽으로 몸이 많이 기울어졌어요.
- 지속 시간: ${alertData.badPostureDurationSec ?? 10}초

사용자가 깜짝 놀라지 않게, 다정하고 부드러운 목소리로 턱을 살짝 당기고 어깨를 펼 수 있도록 1~2문장의 따뜻한 응원 멘트를 건네주세요.`;
    }

    return { system, user };
  }

  // session_summary 모드
  const summaryData = data as SessionSummaryContext;
  let user = "";

  if (persona === "harsh") {
    user = `[집중 세션 종료 종합 성적표]
- 총 집중 시간: ${summaryData.totalFocusMin}분
- 평균 자세 점수: ${summaryData.avgScore}점
- 나쁜 자세 비율: 전체의 ${summaryData.badPostureRatio}%
- 자세 붕괴 경고 횟수: 총 ${summaryData.warningCount}회

이번 세션의 자세 결과를 바탕으로 냉정한 종합 평가를 내려주세요.
1) 한 줄 총평 (뼈 때리는 별칭 부여, 예: '모니터 흡입기')
2) 척추 생존을 위한 현실적인 지적 (2~3문장)
전체 4줄 이내로 간결하고 임팩트 있게 작성하세요.`;
  } else {
    user = `[집중 세션 종료 종합 격려 리포트]
- 총 집중 시간: ${summaryData.totalFocusMin}분
- 평균 자세 점수: ${summaryData.avgScore}점
- 나쁜 자세 비율: 전체의 ${summaryData.badPostureRatio}%
- 경고 횟수: ${summaryData.warningCount}회

세션을 무사히 마친 사용자에게 따스한 격려와 휴식 가이드를 전해주세요.
1) 고생한 사용자에게 전하는 다정한 칭찬 한마디
2) 휴식 시간에 하면 좋은 1분 스트레칭 추천
전체 3~4문장으로 부드럽고 다정하게 작성해 주세요.`;
  }

  return { system, user };
}

// ----------------------------------------------------------------------
// 3. Mock Fallback 응답 (API 키 미설정 시 개발/테스트용)
// ----------------------------------------------------------------------

export function getMockResponse(
  persona: AIPersonaType,
  contextType: AIContextType,
  data: AlertContext | SessionSummaryContext
): string {
  if (contextType === "alert") {
    if (persona === "harsh") {
      const harshAlerts = [
        "목 각도가 30도를 넘었습니다. 지금 모니터를 씹어 드실 생각인가요? 당장 허리 펴세요!",
        "정신 차리세요! 그 각도면 척추가 볼링공 4개를 이고 버티는 중입니다. 턱 당기세요.",
        "거북이 모드 감지. 미래의 도수치료비 벌써 저축해 두셨나요? 어깨 뒤로 넘기세요!",
      ];
      return harshAlerts[Math.floor(Math.random() * harshAlerts.length)];
    } else {
      const healerAlerts = [
        "너무 열중하셨나 봐요! 목과 어깨가 깜짝 놀라기 전에 살짝만 뒤로 기대어 볼까요? 🌿",
        "참 잘하고 계세요. 잠시 턱을 가볍게 당기고 숨을 깊게 한 번 내쉬어 보세요 ✨",
        "당신의 집중하는 모습도 멋지지만 건강이 제일 소중해요. 어깨를 살짝 으쓱 펴주세요! 🍵",
      ];
      return healerAlerts[Math.floor(Math.random() * healerAlerts.length)];
    }
  }

  // session_summary 모드
  const summary = data as SessionSummaryContext;
  if (persona === "harsh") {
    return `[종합 등급: C- / 자칭 '인간 크레인']
${summary.totalFocusMin}분 동안 고생은 하셨지만, 나쁜 자세 비율이 ${summary.badPostureRatio}%입니다.
머리가 쏠려있던 시간만큼 목 디스크 수명도 줄어들었습니다. 휴식 시간에 핸드폰 보지 마시고 벽에 기대어 서 계세요.`;
  } else {
    return `오늘 ${summary.totalFocusMin}분 동안 온 마음을 다해 집중하셨네요! 정말 자랑스러워요 🌿
평균 자세 점수 ${summary.avgScore}점으로 멋지게 지켜내셨어요. 지금은 두 손을 깍지 끼고 기지개를 쭉 켜면서 시원한 물 한 잔 마셔볼까요? ✨`;
  }
}
