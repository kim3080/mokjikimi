import { NextResponse } from "next/server";
import { generateAICoachFeedback, type AICoachRequest } from "@/lib/ai/openai";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AICoachRequest;

    if (!body || !body.persona || !body.contextType) {
      return NextResponse.json(
        { ok: false, error: "잘못된 요청 형식입니다. persona와 contextType은 필수입니다." },
        { status: 400 }
      );
    }

    if (!["harsh", "healer"].includes(body.persona)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 persona 입니다. ('harsh' 또는 'healer')" },
        { status: 400 }
      );
    }

    if (!["alert", "session_summary"].includes(body.contextType)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 contextType 입니다. ('alert' 또는 'session_summary')" },
        { status: 400 }
      );
    }

    const feedback = await generateAICoachFeedback(body);

    return NextResponse.json({ ok: true, data: feedback });
  } catch (error: any) {
    console.error("[API /api/ai/coach] 내부 처리 오류:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
