import { splitComicSourceBySubtitles } from "./subtitle-sections";
import { cleanSourceVocabulary } from "./vocabulary";
import { reviewComicAgainstSource, type GroundedComic } from "./source-grounding";
import { ensureNoContradiction } from "./fact-check";
import { rewriteForEasyReading } from "./easy-dialogue";

// Old comics varied a lot; rotating the story mode by passage number keeps a batch from looking identical.
const STORY_MODES = [
  "주인공 드라마: 지문 속 상황을 직접 겪는 인물이 주인공이다. 혼잣말, 친구·가족과의 대화로 문제를 겪고 깨닫는다.",
  "현장 체험: 학생이나 인물들이 현장(미술관, 실험실, 자연, 거리 등)에서 직접 보고 느끼며 서로 반응한다.",
  "전문가 인터뷰: 연구자·의사·전문가가 한 인물에게 자료나 물건을 직접 보여주며 1:1로 설명한다.",
  "회의·토론: 동료나 친구들이 의견을 주고받다가 하나의 결론에 이른다.",
  "대비 장면: 그때와 지금, 두 생각, 두 집단을 한 컷 안에서 나란히 대비해 보여준다.",
  "인물 등장: 원문에 나오는 인물·학자나 그 시대 사람이 직접 말한다. 원문에 인물이 없으면 다른 방식을 고른다.",
  "시각 은유: 핵심 개념을 상징적인 사물·장면(안경, 다리, 퍼즐 등)으로 보여주고 대사는 짧게 쓴다.",
  "다큐 내레이션: 인물 대사 없이 해설 자막과 장면으로 진행한다.",
];

import OpenAI from "openai";

import { createTrackedOpenAI } from "@/lib/tracked-openai";
export const maxDuration = 300;

type ComicDialogue = {
  speaker: string;
  text: string;
};

type ComicPanel = {
  cut: string;
  scene: string;
  characters: string;
  dialogue: ComicDialogue[];
};

type HighComicPlan = {
  id: string;
  englishTitle: string;
  koreanSubtitle: string;
  blockSummary: string;
  sourceRange: string;
  visualStyle?: string;
  storyMode?: string;
  keyWords: string[];
  panels: ComicPanel[];
};

type RequestBody = {
  schoolName?: string;
  gradeName?: string;
  lessonName?: string;
  sourceText?: string;
  operation?: "split" | "plan" | "factcheck";
  plan?: unknown;
  sectionIndex?: number;
  sectionLabel?: string;
  koreanReference?: string;
};

type ParsedResponse = {
  overallTitle?: string;
  overallSummary?: string;
  plans?: HighComicPlan[];
};

export async function POST(
  request: Request
) {
  try {
    if (
      !process.env.OPENAI_API_KEY
    ) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되어 있지 않습니다.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const schoolName =
      body?.schoolName?.trim() ||
      "";

    const gradeName =
      body?.gradeName?.trim() ||
      "고등부";

    const lessonName =
      body?.lessonName?.trim() ||
      "";

    const sourceText =
      body?.sourceText?.trim() ||
      "";

    if (!sourceText) {
      return Response.json(
        {
          error:
            "본문 텍스트가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const sectionIndex = body.operation === "plan" ? body.sectionIndex : 0;
    if (!Number.isInteger(sectionIndex) || sectionIndex! < 0) {
      return Response.json({ error: "지문 순서가 올바르지 않습니다." }, { status: 400 });
    }
    const idOffset = sectionIndex!;

    const openai =
      createTrackedOpenAI({
        apiKey:
          process.env.OPENAI_API_KEY,
      }, {
        route: "/api/high-comic-plan",
        feature: "고등 써밋네컷 설계안",
      });

    // Identify boundaries with a compact response; never generate all plans at once.
    const parseCompleted = (response: { status?: string; output_text?: string }): ParsedResponse => {
      if (response.status !== "completed") throw new Error("설계 응답이 완료되지 않았습니다.");
      const raw = response.output_text?.trim();
      if (!raw) throw new Error("설계 응답이 비어 있습니다.");
      return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    };
    const retry = async <T,>(task: () => Promise<T>): Promise<T> => {
      let last: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await task(); } catch (error) { last = error; }
      }
      throw last;
    };
    const askFactCheck = async (prompt: string) => {
      const response = await openai.responses.create({ model: "gpt-5-mini", max_output_tokens: 6000, input: prompt });
      if (response.status !== "completed" || !response.output_text?.trim()) {
        throw new Error("의미 검증 응답이 완료되지 않았습니다.");
      }
      return response.output_text;
    };
    // Local testing only: run the meaning check on a given English source and plan.
    if (body.operation === "factcheck") {
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 404 });
      }
      return Response.json({ plan: await ensureNoContradiction(sourceText, body.plan as GroundedComic, askFactCheck) });
    }
    let sourceSections: Array<{ text: string; label: string; koreanReference?: string }>;
    if (body.operation === "plan") {
      sourceSections = [{ text: sourceText, label: body.sectionLabel || "",
        koreanReference: typeof body.koreanReference === "string" ? body.koreanReference.slice(0, 6000) : "" }];
    } else {
    // Stable server-assigned word IDs avoid copying PDF whitespace/punctuation.
    const sourceWords = Array.from(sourceText.matchAll(/\S+/gu), match => ({
      text: match[0], offset: match.index!,
    }));
    const indexedSource = sourceWords.map((word, index) => `[${index + 1}]${word.text}`).join(" ");
    let subtitleOffsets: number[] = [];
    const boundaries = await retry(async () => {
      const response = await openai.responses.create({
        model: "gpt-5-mini",
        // Only picks word positions; the server re-checks order, range and full coverage below.
        reasoning: { effort: "low" },
        max_output_tokens: 8000,
        input: `입력은 PDF에서 추출한 고등 영어 자료다. 설계안은 만들지 말고 독립 영어 지문의 시작 위치만 찾는다.
서버가 각 단어 앞에 [1], [2]처럼 위치 번호를 붙였다. 이 번호는 문제 번호가 아니라 원문 내 단어 위치다.
각 독립 지문의 영어 원문 첫 단어 앞에 붙은 위치 번호를 startWordIds 배열에 정수로 반환한다.
지문 첫 단어 바로 앞의 문제 번호·제목·문장 번호는 선택하지 않는다. 첫 단어가 문장 번호와 붙어 있으면 그 단어 위치를 선택한다.
문제 번호, 연도, 월 모의고사, 지문 읽기 표시를 참고한다.
같은 지문의 다음 페이지·한국어 해석·해설·단어 목록·보기·선택지는 새 지문이 아니다.
같은 첫 문장이라도 서로 다른 실제 지문이면 서로 다른 위치 번호로 구분한다.
모든 독립 영어 지문을 입력 순서대로 빠짐없이 한 번씩 포함한다. 문장 복사나 제목·요약 생성은 금지한다.
교과서에서는 본문 전체의 시작과 본문 내부 소제목의 시작을 구분한다.
startWordIds에는 기존처럼 본문·추가 읽기·독립 시험 지문의 시작만 넣는다.
sectionStartWordIds에는 각 본문 내부에서 새 주제를 시작하는 명시적인 소제목의 첫 단어 위치를 넣는다.
Q: 질문 소제목, 번호가 있는 주제 소제목, 독립된 영문 소제목 등이 대상이다.
Q형은 영어 답변 첫 문장이 아니라 Q:가 붙은 단어의 위치를 선택한다.
도입부는 첫 소제목과 함께 처리하므로 각 본문의 첫 소제목은 sectionStartWordIds에서 제외한다.
하나의 질문 아래 letters, words처럼 이어지는 설명, 문장 번호, 페이지 머리말, 한국어 번역 제목은 소제목으로 분리하지 않는다.
소제목이 없는 일반 모의고사 지문은 임의로 쪼개지 않는다. sectionStartWordIds는 빈 배열이다.
각 소제목의 답변이 다음 페이지로 이어지면 끝까지 같은 단위에 포함한다.
JSON만 반환: {"startWordIds":[12,721],"sectionStartWordIds":[340,510]}
위 숫자는 형식 예시다. 반드시 실제 입력에 붙어 있는 번호를 사용한다.
입력 자료:\n${indexedSource}`,
      });
      const data = parseCompleted(response) as ParsedResponse & { startWordIds?: number[]; sectionStartWordIds?: number[] };
      if (!Array.isArray(data.startWordIds) || !data.startWordIds.length) throw new Error("지문 시작 위치 번호를 찾지 못했습니다.");
      const sectionIds = data.sectionStartWordIds ?? [];
      if (!Array.isArray(sectionIds)) throw new Error("소제목 위치 배열 형식이 올바르지 않습니다.");
      let previousSection = 0;
      const checkedSubtitleOffsets = sectionIds.map((id) => {
        if (!Number.isInteger(id) || id < 1 || id > sourceWords.length || id <= previousSection) {
          throw new Error("소제목 위치 번호가 범위를 벗어나거나 중복·역순입니다.");
        }
        previousSection = id;
        return sourceWords[id - 1].offset;
      });
      let previous = 0;
      const checkedBoundaries = data.startWordIds.map((id) => {
        if (!Number.isInteger(id) || id < 1 || id > sourceWords.length || id <= previous) {
          throw new Error("지문 시작 위치 번호가 범위를 벗어나거나 중복·역순입니다.");
        }
        previous = id;
        return sourceWords[id - 1].offset;
      });
      subtitleOffsets = checkedSubtitleOffsets;
      return checkedBoundaries;
    });
    // Contiguous slices cover every input character exactly once, including preamble.
    sourceSections = boundaries.flatMap((offset, index) => {
      const start = index === 0 ? 0 : offset;
      const end = boundaries[index + 1] ?? sourceText.length;
      return splitComicSourceBySubtitles(
        sourceText.slice(start, end),
        subtitleOffsets.filter(value => value > start && value < end).map(value => value - start),
      );
    });
    if (sourceSections.map(section => section.text).join("") !== sourceText) {
      throw new Error("전체 소제목 원문 누락·중복 검증에 실패했습니다.");
    }
    }
    if (body.operation === "split") {
      // Two-column PDFs print a page's Korean translation after all of its English.
      // Give each section the Korean lines of the pages its English is on, as wording reference only.
      const koreanLine = (line: string) => {
        const hangul = (line.match(/[가-힣]/gu) || []).length;
        return hangul >= 4 && hangul > (line.match(/[A-Za-z]/g) || []).length;
      };
      const englishLine = (line: string) => (line.match(/[A-Za-z]/g) || []).length >= 20;
      const markers = Array.from(sourceText.matchAll(/---\s*\d+페이지\s*---/gu), match => match.index!);
      const pageStarts = markers.length && markers[0] === 0 ? markers : [0, ...markers];
      const pages = pageStarts.map((start, i) => ({ start, end: pageStarts[i + 1] ?? sourceText.length }));
      let cursor = 0;
      const withReference = sourceSections.map(section => {
        const start = cursor; const end = cursor + section.text.length; cursor = end;
        const korean = pages.filter(page => page.start < end && page.end > start &&
          sourceText.slice(Math.max(page.start, start), Math.min(page.end, end)).split("\n").some(englishLine))
          .flatMap(page => sourceText.slice(page.start, page.end).split("\n").filter(koreanLine));
        return { ...section, koreanReference: korean.join("\n").slice(0, 6000) };
      });
      return Response.json({ sections: withReference });
    }
    const passages = sourceSections.map(section => section.text);
    // Two-column PDFs put a page's Korean translation after all of its English, so a
    // translation can land in the next section. Plan and review from the English lines only.
    const englishSourceOnly = (text: string): string => {
      const kept = text.split("\n").filter(line => {
        const hangul = (line.match(/[가-힣]/gu) || []).length;
        const latin = (line.match(/[A-Za-z]/g) || []).length;
        return hangul === 0 || latin > hangul;
      }).join("\n");
      return (kept.match(/[A-Za-z]/g) || []).length >= 40 ? kept : text;
    };
    const batchResults: ParsedResponse[] = new Array(passages.length);
    let nextBatch = 0;
    let batchFailed = false;
    const worker = async () => {
      while (!batchFailed && nextBatch < passages.length) {
        const index = nextBatch++;
        const passageText = englishSourceOnly(passages[index]);
        const expectedId = `passage-${idOffset + index + 1}`;
        const timing = { start: Date.now(), draft: 0, draftCalls: 0, review: 0, reviewCalls: 0, factCalls: 0 };
        try {
          batchResults[index] = await retry(async () => {
            timing.draftCalls++;
            const response = await openai.responses.create({
              model: "gpt-5-mini",
              max_output_tokens: 16000,
              input: `
너는 고등 영어 지문을 각각 "써밋네컷"으로 바꾸는 전문 편집자다.
원문에 있는 사실·과정·사례만 쉽게 재구성한다. 원문에 없는 전문지식·용어·수치·원인·경로를 추가하지 않는다.
과학적으로 맞는 상식이라도 원문에 없으면 설명에 쓰지 않는다. 비유는 원문 사실의 의미를 바꾸지 않는다.

[이해 우선 — 가장 중요]
써밋네컷의 목표는 지문을 읽지 않은 고등학생도 네 컷만 보고 주제·흐름·핵심을 바로 이해하는 것이다.
- 한글 해석 문장을 대사로 옮기지 않는다. 해석문식 한자어 표현(콘텐츠를 섭취하다, 의지의 힘이 분산된다, 배제 상태를 간과한다 등)은 고1이 바로 알아듣는 말로 풀어 쓴다.
- 네 컷은 하나의 이야기로 이어진다: 상황·문제 제시 → 핵심 → 이유나 지문 속 예시 → 정리. 이 흐름을 어떤 장면과 인물로 보여줄지는 지정된 이야기 방식을 따른다.
- 컷 사이는 '그래서, 왜냐하면, 예를 들어, 그런데, 결국' 같은 흐름으로 잇는다. 앞 컷과 연결되지 않는 새 주장을 갑자기 꺼내지 않는다(비약 금지).
- 매번 '학생이 묻고 해설자가 설명하는' 틀로 만들지 않는다. 지문 속 상황을 겪는 인물들이 직접 말하고 반응하게 한다.
- 말투는 화자에 맞춘다: 학생·친구끼리는 반말 구어체, 학생이 선생님·어른에게는 존댓말. 설명문 말투('~합니다', '결론:', '결국 ~입니다')는 학생 대사에 쓰지 않는다. 학생은 질문·반응·감정·깨달음을 자기 말로 한다.
- 해설자는 자막 상자로 한 지문에 1~2줄만 쓴다(다큐 내레이션 방식은 예외). 결론은 되도록 인물의 깨달음이나 행동으로 보여준다.
- 학생이 공감할 짧은 일상 비유는 지문당 1개까지 쓸 수 있다. '~같은 거예요', '~처럼'으로 비유임이 드러나게 쓰고, 원문의 사실·주장을 바꾸거나 새 사실을 더하지 않는다.
나쁜 예: '의지의 힘이 가상(virtual) 콘텐츠를 소화하느라 음식에서 분산됩니다.'
좋은 예: '폰 속 가상(virtual) 세상에 신경 쓰느라 정작 음식에는 집중을 못 해요.'
나쁜 예: '조직 심리학자들이 배제(exclusion) 상태를 간과해요.'
좋은 예: '단톡방에서 나만 빠진 느낌 같은 거예요. 이런 배제(exclusion)를 연구자들이 잘 안 봤대요.'
짧은 소제목은 원문에 있는 상황의 시작→정보 전달→행동→의미를 나누며, 외부 지식으로 네 컷을 채우지 않는다.
핵심 어휘는 개수보다 학습 가치를 우선한다. dream, brain, information, travel 같은 기초 단어는 한글로만 쓴다.
동사 영어를 병기할 때 한국어는 문장에 맞게 활용한다. 강화해(strengthen), 기억하기(remember)처럼 쓴다.
해설자·교사·전문가·연구자는 존댓말을 쓰고 학생도 이들에게 존댓말로 말한다. 학생·친구끼리는 반말로 말한다.

==================================================
프로젝트 정보
==================================================

학교: ${schoolName || "미입력"}
학년/과정: ${gradeName}
자료명: ${lessonName || "미입력"}

==================================================
가장 중요한 규칙
==================================================

입력 자료에는 서로 독립된 영어 지문이 여러 개 들어 있다.

반드시:

독립된 영어 지문 1개
=
써밋네컷 설계안 1개
=
plans 배열의 항목 1개

로 만들어라.

예:

영어 지문이 1개이면 plans 1개
영어 지문이 6개이면 plans 6개
영어 지문이 10개이면 plans 10개
영어 지문이 15개이면 plans 15개

지문 개수를 임의로 줄이거나 합치지 마라.

절대로 "최대 6개" 같은 제한을 두지 마라.

==================================================
독립 지문 판단 기준
==================================================

입력 PDF 텍스트에는 다음과 같은 정보가 섞여 있을 수 있다.

- 연도
- 월 모의고사
- 문제 번호
- 영어 원문
- 한국어 해석
- 문장 번호
- 페이지 번호
- 저작권 문구
- 기타 안내 문구

독립된 영어 지문은 주로 다음과 같은 형태로 시작한다.

예:

21번 I suspect fungi are...
23번 Empathy is frequently...
24번 We tend to break up time...

"21번", "23번", "24번" 등
문제 번호 뒤에 영어 문장이 시작되면
새로운 독립 영어 지문의 시작일 가능성이 매우 높다.

또한 다음 문구 이후에 나오는 영어 문단을 중요하게 보라.

"지문 읽기"

각 지문의 영어 원문은
그 지문에 딸린 한국어 해석과 구분해야 한다.

==================================================
중요: 한국어 해석 중복 금지
==================================================

각 영어 지문 뒤에는
같은 내용을 번역한 한국어 해석이 붙어 있을 수 있다.

한국어 해석을 별도의 지문으로 세지 마라.

영어 원문 1개 + 그 한국어 해석
=
지문 1개

이다.

한국어 해석은 영어 원문의 의미를 확인하는
보조 자료로만 사용한다.

==================================================
페이지가 나뉘는 경우
==================================================

한 지문의 영어 원문 또는 한국어 해석이
다음 PDF 페이지까지 이어질 수도 있다.

페이지가 바뀌었다는 이유만으로
새 지문으로 판단하지 마라.

반대로 새 페이지에서

- 새로운 모의고사 정보
- 새로운 문제 번호
- 새로운 영어 제목
- "지문 읽기"

가 나타나면
새로운 독립 지문인지 확인하라.

==================================================
써밋네컷 제작 기준
==================================================

각 독립 영어 지문 전체를 이해한 뒤
그 지문 하나를 정확히 4컷으로 재구성한다.

즉,

서버는 교과서의 명시적인 소제목을 별도 제작 단위로 먼저 나누었다.
이번 입력의 핵심 흐름을 [이해 우선]의 네 컷 구조(주제 던지기 → 핵심 주장 → 이유·예시 → 결론)로 이어지게 담아라.
학생이 꼭 알아야 할 핵심만 대사로 쓰고, 세부 과정·예시는 장면(scene) 그림으로 보여준다.

이번 입력 단위 1개당 써밋네컷 1장을 만든다.
다른 소제목의 내용을 추측하여 덧붙이거나, 도입부만 설명하고 핵심 내용을 생략하지 마라.


==================================================
시각 스타일과 스토리 전개 방식
==================================================

각 독립 영어 지문마다 아래 두 항목을 반드시 정하라.

- visualStyle
- storyMode

visualStyle은 다음 후보를 골고루 사용한다.

1. graphic novel
   - 강한 명암, 드라마틱한 구도, 그래픽노블 느낌

2. editorial illustration
   - 잡지 삽화처럼 세련되고 개념적인 시각 표현

3. cinematic storyboard
   - 영화 장면처럼 카메라 구도와 빛을 적극 활용

4. modern webtoon
   - 현대적인 한국 웹툰 스타일

5. ink drawing comic
   - 펜·잉크 드로잉과 강한 선 중심

6. painterly illustration
   - 회화적인 질감과 분위기 중심

7. collage magazine comic
   - 매거진 콜라주와 편집 디자인 감각

8. retro comic book
   - 빈티지 코믹북, 하프톤과 강한 프레이밍

9. minimal conceptual illustration
   - 인물 대화보다 개념과 상징을 시각적으로 표현

10. infographic comic
   - 정보·비교·과정을 그림 속에서 직관적으로 보여주는 방식

연속된 두 지문에 같은 visualStyle을 사용하지 마라.
전체 자료 안에서 특정 스타일만 반복하지 마라.

storyMode는 다음 방식을 골고루 섞는다.

- character dialogue
- narrator driven
- visual metaphor
- comparison
- process sequence
- cause and effect
- symbolic scene
- real world example
- documentary style
- inner monologue

매번 학생 2~3명이 서서 대화하는 구조로 만들지 마라.

중요:
4컷 모두가 인물 간 대화로만 이루어지는 plan은 금지한다.

각 plan의 4컷 중 최소 1컷,
가능하면 2컷은 다음 중 하나로 구성한다.

- 인물 없는 상징 장면
- 짧은 내레이션 중심 장면
- 개념을 시각화한 장면
- 실제 사례 재현
- 비교 장면
- 원인 → 결과 장면
- 사물이나 환경 중심 장면
- 극적인 클로즈업
- 공간 전체를 보여주는 장면

본문이 추상적인 설명문이라면
억지로 학생 두 명이 그 내용을 설명하게 하지 말고,
시각적 비유와 상황 자체로 보여줘라.


==================================================
고등 써밋네컷 스타일
==================================================

[톤]

- 고등학생 수준
- 너무 유치한 말투 금지
- 실제 대화처럼 자연스럽게
- 살짝 MZ스러운 표현 가능
- 코믹 포인트 가능
- 그러나 본문의 핵심 의미는 정확해야 함

[대사]

- 모든 대사는 실제 사람이 입으로 말할 법한 문장으로 작성한다.
- "~한다.", "~이다.", "~된다." 같은 딱딱한 설명체를 반복하지 않는다.
- 해설자, 전문가, 연구자, 과학자도 자연스럽게 말한다.
- 설명은 정확하되 실제 대화나 내레이션처럼 부드럽게 표현한다.
- 학생은 자연스러운 일상 구어체를 사용한다.
- 해설자는 짧고 리듬감 있는 내레이션을 사용한다.
- 질문, 반응, 감탄을 적절히 섞는다.
- 지나치게 유치하거나 과한 인터넷 말투는 사용하지 않는다.

좋지 않은 예:
"다양성은 조직의 적응력을 높인다."
"이 현상은 인간의 인지 과정에서 발생한다."

좋은 예:
"다양성이 있으면 변화에 훨씬 잘 적응할 수 있어요."
"이런 현상이 우리가 생각하는 과정에서도 나타나는 거죠."

- 영어 본문을 그대로 번역하지 마라.
- 만화 속 실제 대사처럼 재구성한다.
- 짧고 직관적으로 표현한다.
- 한 컷에 지나치게 많은 정보를 넣지 않는다.
- [대사 분량] 각 컷의 dialogue는 1~2줄만 쓴다. 한 줄은 한두 문장, 괄호 속 영어를 빼고 약 40자 이내로 쓴다.
- [대사 분량] 한 컷의 대사를 모두 합쳐도 약 60자 이내로 쓴다. 원문 문장을 길게 풀어 옮기지 않는다.
- [대사 분량] 모든 컷에 대사 1줄 이상을 넣는다. 인물 없는 상징 장면이면 해설자 내레이션 1줄을 넣는다.
- [영어 병기] 영어 단어만 문장 끝에 따로 붙이지 않는다. 예: '…보여요. 진화(evolution).' (X) → '환경이 그대로면 진화(evolution)가 멈춘 것처럼 보여요.' (O)
- 4컷을 모두 보면 원문의 전체 흐름이 이해되어야 한다.


==================================================
대사 말투 자연스러움 — 매우 중요
==================================================

만화 대사는 보고서 문장이나 교과서 해설문처럼 쓰지 마라.

특히 해설자, 전문가, 연구자, 과학자 등이 말한다고 해서
모든 대사를 "~한다.", "~이다.", "~된다." 같은
딱딱한 서술체로 끝내지 마라.

dialogue는 실제 사람이 입으로 말하는 문장이어야 한다.

좋지 않은 예:
"다양성은 조직의 적응력을 높인다."
"이 현상은 인간의 인지 과정에서 발생한다."
"공감은 상대방의 감정을 이해하는 능력이다."

좋은 예:
"다양성이 있으면 변화에 훨씬 잘 적응할 수 있어요."
"이런 현상이 우리 생각하는 방식에서도 나타나는 거죠."
"쉽게 말하면, 상대의 입장에서 느껴보는 게 공감이에요."

화자에 따라 말투를 자연스럽게 달리한다.

- 학생끼리 대화: 자연스러운 일상 구어체
- 교사·전문가·연구자: 설명은 정확하되 자연스러운 말투
- 해설자: 짧고 리듬감 있는 내레이션
- 혼잣말: 실제 생각처럼 자연스럽게
- 관람객·회사원 등 일반 인물: 상황에 맞는 생활 말투

모든 문장을 억지로 반말로 만들 필요는 없다.
반대로 모든 문장을 딱딱한 문어체로 만들지도 마라.

핵심은:
"이 사람이 실제 만화 속에서 이렇게 말할 법한가?"
를 기준으로 작성하는 것이다.

짧은 감탄, 질문, 반응도 적절히 섞어
4컷 전체가 설명문을 잘라놓은 것처럼 보이지 않게 한다.

단,
- 지나치게 유치한 말투 금지
- 과한 인터넷 은어 금지
- 핵심 의미 왜곡 금지
- 영어 학습 핵심어 한글뜻(English) 형식은 그대로 유지

==================================================
핵심어 삽입
==================================================

각 지문마다 영어 원문에 실제로 등장하는 고등 내신·수능 수준 핵심 어휘와 숙어만 선택한다. 보통 3~5개를 고르고, 원문에 고등 수준 어휘가 거의 없을 때만 그보다 적게 고른다. 어휘 때문에 대사가 어려워지면 어휘 수를 줄인다. 기초 단어로 개수를 채우지 않는다.
단순히 주제를 대표하는 쉬운 명사를 고르지 말고, 고등학생에게 학습 가치가 있는 추상어·학술어·다의어의 문맥상 의미·구동사·숙어를 우선한다.
important, good, bad, people, student, school, time, make, think, learn, life, light, history, culture, star, music, game 같은 기초 어휘와 사람·별·지명 같은 고유명사로 개수를 채우지 않는다.
난도가 높다는 이유만으로 원문에 없는 영어·전문용어를 새로 만들어 넣지 않는다.
적절한 고등 수준 어휘가 적으면 쉬운 단어로 채우지 말고 실제로 있는 학습 가치 높은 어휘만 선택한다.
동일 단어의 대소문자·복수형·시제형은 같은 어휘로 보고 중복 선택하지 않는다. 원문의 형태 또는 기본형 한 가지로 통일한다.
한 써밋네컷 4컷 전체에서 각 학습 영어는 한 번만 한글뜻(English)으로 표시한다.
같은 어휘가 뒤의 대사에서 다시 필요하면 괄호 속 영어 없이 자연스러운 한글 뜻만 사용한다.
같은 영어를 장면 속 표지판·설명·배경에도 다시 표시하지 않는다.
이 중복 금지는 해당 네컷 한 장 안에만 적용한다. 서로 다른 지문에서는 같은 핵심 어휘를 사용할 수 있다.

형식은 반드시:

한글뜻(English)

예:

원동력(driving force)
적응해(adapt)
회복력(resilience)

핵심어는 만화 대사 속에 자연스럽게 포함한다.

단어장처럼 마지막 컷에 몰아서 넣지 마라.

==================================================
4컷 구성
==================================================

각 plan에는 반드시 정확히 4개의 panel이 있어야 한다.

각 컷:

1컷
2컷
3컷
4컷

각 컷에는 다음 정보가 필요하다.

- cut
- scene
- characters
- dialogue

4컷 모두 같은 배경이나 같은 자세로 만들지 마라.

컷마다:

- 장소
- 표정
- 행동
- 구도

중 최소 하나 이상은 변화하도록 설계한다.

==================================================
sourceRange
==================================================

가능하면 각 지문의 출처를
sourceRange에 적어라.

예:

2023년 09월 모의고사 21번
2024년 03월 모의고사 23번
2024년 06월 모의고사 24번

입력에서 정확히 확인할 수 없는 정보는
억지로 만들어내지 마라.

==================================================
누락 방지 최종 검수
==================================================

JSON을 출력하기 전에 반드시 입력 전체를 다시 확인한다.

1. 독립된 영어 지문의 시작점을 처음부터 끝까지 센다.
2. plans의 개수를 센다.
3. 두 숫자가 같은지 확인한다.
4. 빠진 영어 지문이 있으면 plans에 추가한다.
5. 서로 다른 지문 두 개가 하나의 plan으로 합쳐지지 않았는지 확인한다.
6. 같은 영어 지문을 두 번 만들지 않았는지 확인한다.

특히 입력에 독립 영어 지문이 10개라면
plans도 반드시 10개여야 한다.


==================================================
절대 규칙: 대사 언어
==================================================

모든 panels[].dialogue[].text는 반드시 한국어로 작성한다.

영어 문장 전체를 dialogue.text에 쓰는 것은 절대 금지한다.

영어는 오직 영어 학습 핵심어를 다음 형태로 넣을 때만 허용한다.

한글뜻(English)

예:
다양성(diversity)
회복력(resilience)
객관성(objectivity)

다음은 금지:
"This makes me uneasy."
"Artists use discomfort to make us think."
"Science needs diversity."

반드시 다음처럼 작성:
"이 장면, 좀 불편하게 느껴지지?"
"그 불편함이 오히려 변화(transformation)를 만들 수도 있어."
"과학에서도 다양성(diversity)이 중요한 이유가 바로 이거야."

speaker 이름도 가능하면 한국어로 작성한다.

예:
해설자
학생
관람객
연구자
회사원
과학자

Narrator, Visitor 1, Student A 같은 영어 화자명은 사용하지 않는다.

JSON을 출력하기 직전에
모든 dialogue.text를 다시 검사하여
영어 문장으로 된 대사가 하나라도 있으면 반드시 한국어로 고친다.

==================================================
핵심 영어 어휘
==================================================

각 지문마다 keyWords는 위의 고등 수준 어휘 선택 기준에 따라 중복 없이 5~8개를 우선 선택한다.
적절한 어휘가 부족한 지문은 위 예외를 따른다.

keyWords 배열에 넣기만 하고 끝내지 마라.

선택한 핵심어는 실제 4컷 대사 안에 각각 정확히 한 번씩 자연스럽게 등장해야 한다.
동일 영어를 다시 쓰지 말고 재등장은 한글 뜻만 사용한다.

형식은 반드시:
한글뜻(English)

한 컷에 몰아넣지 말고 4컷 전체에 분산한다.

가능하면:
- 1컷 1~2개
- 2컷 1~2개
- 3컷 1~2개
- 4컷 1~2개

정도로 배치한다.

영어 학습 만화라는 점이 눈에 보여야 하지만,
단어장처럼 보이게 만들지는 않는다.

==================================================
스토리 구성 다양화
==================================================

"두 사람이 서서 설명하고 상대가 반응하는 구조"를 기본값으로 사용하지 마라.

4컷 모두 대화 장면으로 만드는 것을 금지한다.

다만 인물을 지나치게 없애는 것도 금지한다.

각 써밋네컷은 원칙적으로:
- 최소 2컷은 인물이 등장하는 생동감 있는 장면
- 최대 1컷 정도만 순수 사물/풍경/상징 장면
- 나머지는 상황 재현, 행동, 비교, 사건 전개 등

으로 구성한다.

좋은 예:
1컷: 실제 상황 또는 문제 제시
2컷: 행동이나 사건 발생
3컷: 시각적 비유 또는 결과
4컷: 인물의 반응과 핵심 결론

설명문이라도 억지로 학생들이 강의하듯 말하게 하지 말고,
본문 속 개념을 실제 사건과 장면으로 보여준다.

==================================================
출력 규칙
==================================================

반드시 JSON만 출력한다.

설명문 금지.
머리말 금지.
코드블록 금지.

형식:

{
  "overallTitle": "자료 전체 제목",
  "overallSummary": "자료 전체에 대한 짧은 설명",
  "plans": [
    {
      "id": "passage-1",
      "englishTitle": "해당 지문의 짧은 영문 제목",
      "koreanSubtitle": "해당 지문의 짧은 한글 부제",
      "blockSummary": "해당 영어 지문의 핵심 내용",
      "sourceRange": "2024년 03월 모의고사 21번",
      "visualStyle": "graphic novel",
      "storyMode": "visual metaphor",
      "keyWords": [
        "한글뜻(English)",
        "한글뜻(English)"
      ],
      "panels": [
        {
          "cut": "1컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": [
            {
              "speaker": "화자",
              "text": "자연스러운 만화 대사"
            }
          ]
        },
        {
          "cut": "2컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": [
            {
              "speaker": "화자 또는 해설자",
              "text": "짧은 대사 또는 내레이션"
            }
          ]
        },
        {
          "cut": "3컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": [
            {
              "speaker": "화자 또는 해설자",
              "text": "짧은 대사 또는 내레이션"
            }
          ]
        },
        {
          "cut": "4컷",
          "scene": "장면 설명",
          "characters": "등장인물 설명",
          "dialogue": [
            {
              "speaker": "화자 또는 해설자",
              "text": "짧은 대사 또는 내레이션"
            }
          ]
        }
      ]
    }
  ]
}

==================================================
절대 금지
==================================================

- 서로 다른 영어 지문 합치기
- 영어 지문 누락
- 한국어 해석을 별도 지문으로 계산
- 지문 수를 임의로 3~6개로 제한
- 서버가 나눈 소제목을 다른 소제목과 다시 합치기
- 본문 순서 변경
- 4컷보다 많거나 적게 만들기
- 교과서 문장 그대로 직역
- 모든 컷을 같은 구도로 구성
- 지나치게 유치한 말투
- 입력 텍스트 바깥의 설명 추가

==================================================
입력 자료
==================================================

${passageText}

이번 제작 단위의 소제목: ${sourceSections[index].label || "입력 원문 참조"}
${sourceSections[index].koreanReference ? `참고용 한글 해석 (같은 페이지에 있는 다른 지문의 해석이 섞여 있을 수 있다. 위 영어 원문에 해당하는 부분의 자연스러운 우리말 낱말·표현만 참고한다. 해석 문장·표현을 대사로 옮기지 말고 뜻만 파악해 쉬운 말로 다시 쓴다. 대사 분량 기준을 지킨다. 사실·사건·대상은 위 영어 원문에 있는 것만 쓴다):
${sourceSections[index].koreanReference}
` : ""}이번 지문의 이야기 방식(storyMode): ${STORY_MODES[(idOffset + index) % STORY_MODES.length]}\n이 방식이 지문 내용과 맞지 않을 때만 다른 방식을 고르고, 고른 방식을 storyMode에 쓴다.\n추가 필수 규칙: 이번 입력은 서버가 구분한 독립 지문 1개다. plans는 정확히 1개여야 한다.
한국어 해석과 다음 문제의 머리말은 별도 지문으로 만들지 않는다.
해당 plan의 id는 반드시 "${expectedId}"로 출력한다.`,
            });
            const result = parseCompleted(response);
            const plan = result.plans?.[0];
            if (result.plans?.length !== 1 || !plan || plan.id !== expectedId ||
                !plan.englishTitle || !plan.blockSummary || !Array.isArray(plan.keyWords) ||
                !Array.isArray(plan.panels) || plan.panels.length !== 4 ||
                plan.panels.some(panel => !panel || typeof panel.scene !== "string" ||
                  typeof panel.characters !== "string" || !Array.isArray(panel.dialogue) ||
                  panel.dialogue.some(line => !line || typeof line.speaker !== "string" || typeof line.text !== "string"))) {
              throw new Error("지문별 설계안 개수·ID·4컷 검증에 실패했습니다.");
            }
            if (sourceSections[index].label) {
              plan.sourceRange = [plan.sourceRange, sourceSections[index].label].filter(Boolean).join(" · ");
            }
            result.plans = [cleanSourceVocabulary(plan, passageText)];
            return result;
          });
          // Review only this completed draft. Audit retries never regenerate successful drafts.
          timing.draft = Date.now() - timing.start;
          const audited = await reviewComicAgainstSource(
            passageText, batchResults[index].plans![0], async (prompt) => {
              timing.reviewCalls++;
              const response = await openai.responses.create({
                // Editing pass: facts are re-checked afterwards by the separate meaning check.
                model: "gpt-5-mini", reasoning: { effort: "low" }, max_output_tokens: 10000, input: prompt,
              });
              if (response.status !== "completed" || !response.output_text?.trim()) {
                throw new Error("원문 대조 검수 응답이 완료되지 않았습니다.");
              }
              return response.output_text;
            },
            0,
          );
          timing.review = Date.now() - timing.start - timing.draft;
          // Easy-reading pass: one story flow in plain Korean. The meaning check below still guards facts.
          const easy = cleanSourceVocabulary(await rewriteForEasyReading(passageText, audited, async (prompt) => {
            const response = await openai.responses.create({ model: "gpt-5-mini", max_output_tokens: 8000, input: prompt });
            if (response.status !== "completed" || !response.output_text?.trim()) {
              throw new Error("쉬운 대사 다듬기 응답이 완료되지 않았습니다.");
            }
            return response.output_text;
            // Keep the whole passage well under the 300-second function limit.
          }, timing.start + 150_000), passageText);
          const easyMs = Date.now() - timing.start - timing.draft - timing.review;
          // Separate meaning check: lines that reverse or contradict the English source are fixed or fail.
          const verified = await ensureNoContradiction(passageText, easy, async (prompt) => {
            timing.factCalls++;
            return askFactCheck(prompt);
          });
          const seconds = (ms: number) => (ms / 1000).toFixed(0);
          console.log(`[high-comic-plan timing] ${expectedId} draft ${seconds(timing.draft)}s x${timing.draftCalls}, review ${seconds(timing.review)}s x${timing.reviewCalls}, easy ${seconds(easyMs)}s, meaning ${seconds(Date.now() - timing.start - timing.draft - timing.review - easyMs)}s x${timing.factCalls}, total ${seconds(Date.now() - timing.start)}s`);
          const checked = cleanSourceVocabulary(verified, passageText);
          // cleanSourceVocabulary already rewrites any leftover "~하다(English)" deterministically,
          // so wording never fails a whole passage here.
          batchResults[index].plans = [checked];
        } catch (error) {
          batchFailed = true;
          throw new Error(`${idOffset + index + 1}번 지문 설계 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
    // At most three paid requests in flight; settled workers finish before responding.
    const workers = await Promise.allSettled(Array.from({ length: Math.min(3, passages.length) }, () => worker()));
    const failed = workers.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    if (failed) throw failed.reason;
    const parsed: ParsedResponse = {
      overallTitle: `${lessonName || "고등 영어"} 써밋네컷`,
      overallSummary: `총 ${passages.length}개 지문의 써밋네컷 설계안`,
      plans: batchResults.flatMap(batch => batch.plans || []),
    };
    if (parsed.plans?.length !== passages.length || new Set(parsed.plans.map(plan => plan.id)).size !== passages.length) {
      throw new Error("전체 지문 수·중복 검증에 실패했습니다.");
    }

    const plans =
      Array.isArray(
        parsed?.plans
      )
        ? parsed.plans
        : [];

    if (
      plans.length ===
      0
    ) {
      throw new Error(
        "생성된 고등 설계안이 없습니다."
      );
    }

    const normalizedPlans =
      plans.map(
        (
          plan,
          index
        ) => ({
          id:
            `passage-${idOffset + index + 1}`,

          sourceText: passages[index],

          englishTitle:
            plan.englishTitle ||
            `Passage ${index + 1}`,

          koreanSubtitle:
            plan.koreanSubtitle ||
            `지문 ${index + 1}`,

          blockSummary:
            plan.blockSummary ||
            "",

          sourceRange:
            plan.sourceRange ||
            "",

          visualStyle:
            [
              "graphic novel",
              "editorial illustration",
              "cinematic storyboard",
              "modern webtoon",
              "ink drawing comic",
              "painterly illustration",
              "collage magazine comic",
              "retro comic book",
              "minimal conceptual illustration",
              "infographic comic",
            ][(idOffset + index) % 10],

          storyMode:
            plan.storyMode ||
            [
              "visual metaphor",
              "real world example",
              "comparison",
              "narrator driven",
              "cause and effect",
              "symbolic scene",
              "process sequence",
              "documentary style",
              "inner monologue",
              "character dialogue",
            ][(idOffset + index) % 10],

          keyWords:
            Array.isArray(
              plan.keyWords
            )
              ? plan.keyWords
              : [],

          panels:
            Array.isArray(
              plan.panels
            )
              ? plan.panels
                  .slice(
                    0,
                    4
                  )
                  .map(
                    (
                      panel,
                      panelIndex
                    ) => ({
                      cut:
                        `${panelIndex + 1}컷`,

                      scene:
                        panel.scene ||
                        "",

                      characters:
                        panel.characters ||
                        "",

                      dialogue:
                        Array.isArray(
                          panel.dialogue
                        )
                          ? panel.dialogue.map(
                              (
                                line
                              ) => ({
                                speaker:
                                  line.speaker ||
                                  "화자",

                                text:
                                  line.text ||
                                  "",
                              })
                            )
                          : [],
                    })
                  )
              : [],
        })
      );

    return Response.json({
      overallTitle:
        parsed.overallTitle ||
        `${lessonName || "고등 영어"} 써밋네컷`,

      overallSummary:
        parsed.overallSummary ||
        "",

      plans:
        normalizedPlans,

      blockCount:
        normalizedPlans.length,
    });
  } catch (
    error: any
  ) {
    console.error(
      "HIGH COMIC PLAN ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "고등 써밋네컷 설계안 생성 중 오류가 발생했습니다.",

        detail:
          error?.message ||
          "알 수 없는 오류",
      },
      {
        status: 500,
      }
    );
  }
}
