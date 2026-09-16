import OpenAI from "openai";

import { createTrackedOpenAI } from "@/lib/tracked-openai";
import { extractDialogueCandidates } from "@/lib/middle-dialogue-candidates";

export async function POST(request: Request) {
  const totalStartedAt = performance.now();

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = createTrackedOpenAI({ apiKey }, {
        route: "/api/analyze",
        feature: "중등 대화문 추출",
      });

    const body = await request.json();
    const text = body.text;

    const promptStartedAt = performance.now();

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "분석할 교재 텍스트가 없습니다." },
        { status: 400 }
      );
    }

    const candidateResult = extractDialogueCandidates(text);
    const sourceText = candidateResult.candidateText;
    const reductionBeforeFallback =
      text.length > 0
        ? Math.max(
            0,
            1 -
              candidateResult.deduplicatedCandidateChars / text.length
          )
        : 0;
    const finalReduction =
      text.length > 0
        ? Math.max(0, 1 - sourceText.length / text.length)
        : 0;
    const mode = candidateResult.useFallback
      ? "fallback"
      : "candidate";

    console.info(
      `[middle analyze] original text chars: ${text.length}`
    );
    console.info(
      `[middle analyze] raw candidate chars before fallback: ${candidateResult.rawCandidateChars}`
    );
    console.info(
      `[middle analyze] deduplicated candidate chars: ${candidateResult.deduplicatedCandidateChars}`
    );
    console.info(
      `[middle analyze] final sent chars: ${sourceText.length}`
    );
    console.info(
      `[middle analyze] reduction before fallback: ${Math.round(
        reductionBeforeFallback * 100
      )}%`
    );
    console.info(
      `[middle analyze] final reduction: ${Math.round(finalReduction * 100)}%`
    );
    console.info(
      `[middle analyze] fallback reason: ${candidateResult.fallbackReason}`
    );
    console.info(
      `[middle analyze] candidate blocks before dedupe: ${candidateResult.candidateBlocksBeforeDedupe}`
    );
    console.info(
      `[middle analyze] candidate blocks after dedupe: ${candidateResult.candidateBlocksAfterDedupe}`
    );
    console.info(
      `[middle analyze] mode: ${mode} confidence=${candidateResult.confidence.toFixed(2)}`
    );
    console.info(
      `[middle analyze debug] total lines: ${candidateResult.debug.totalLines}`
    );
    console.info(
      `[middle analyze debug] non-empty lines: ${candidateResult.debug.nonEmptyLines}`
    );
    console.info(
      `[middle analyze debug] avg line length: ${candidateResult.debug.averageLineLength}`
    );
    console.info(
      `[middle analyze debug] max line length: ${candidateResult.debug.maxLineLength}`
    );
    console.info(
      `[middle analyze debug] short lines: ${candidateResult.debug.shortLines}`
    );
    console.info(
      `[middle analyze debug] speaker-pattern lines: ${candidateResult.debug.speakerPatternLines}`
    );
    console.info(
      `[middle analyze debug] question lines: ${candidateResult.debug.questionLines}`
    );
    console.info(
      `[middle analyze debug] keyword hits: ${candidateResult.debug.keywordHits}`
    );
    console.info(
      `[middle analyze debug] block separators: ${candidateResult.debug.separators}`
    );

    const prompt = `
아래는 중학교 영어 교과서 PDF에서 추출한 텍스트다.

목표:
교재 안에 있는 영어 대화문을 가능한 한 빠짐없이 찾아서 각각 분리한다.

중요 규칙:
1. 인물 두 명 이상이 서로 주고받는 실제 대화문을 찾아라.
2. Listen and Talk, Listen & Write, Real Life Talk뿐 아니라 다른 대화 활동도 포함한다.
3. 대화문이 여러 개면 각각 별도의 항목으로 분리한다.
4. 원문의 대화 순서는 절대 바꾸지 않는다.
5. 영어 문장은 가능한 한 원문 그대로 보존한다.
6. 본문 독해 지문은 제외한다.
7. 문법 설명, 단어 목록, 문제 지시문, 보기, 선택지, 해설은 제외한다.
8. 한두 문장짜리 단순 예문은 가능한 한 제외한다.
9. 실제 대화문인지 애매하면 대화 형식이 명확한 경우만 포함한다.
10. 없는 대화를 만들어내지 않는다.

각 대화문에는 내용 파악용으로 짧은 한글 제목을 하나 붙인다.

반드시 JSON만 출력한다.

형식:

{
  "dialogues": [
    {
      "title": "짧은 한글 제목",
      "content": "실제 영어 대화문"
    }
  ]
}

분석 대상 텍스트:
${sourceText}
`;

    console.info(
      `[middle analyze] prompt preparation: ${Math.round(
        performance.now() - promptStartedAt
      )}ms (text=${sourceText.length} chars, mode=${mode})`
    );

    const openaiStartedAt = performance.now();
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt,
      max_output_tokens: 6000,
    });

    console.info(
      `[middle analyze] OpenAI request: ${Math.round(
        performance.now() - openaiStartedAt
      )}ms`
    );

    const parseStartedAt = performance.now();
    const raw = response.output_text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    console.info(
      `[middle analyze] parse/result: ${Math.round(
        performance.now() - parseStartedAt
      )}ms`
    );
    console.info(
      `[middle analyze] total: ${Math.round(
        performance.now() - totalStartedAt
      )}ms`
    );

    return Response.json(parsed);
  } catch (error: any) {
    console.error("ANALYZE ERROR:", error);

    return Response.json(
      {
        error: "교재 분석 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}