import { partitionSourceSections } from "./source-sections";
import { deduplicateHighVocabulary, findUninflectedVocabularyDialogue } from "./vocabulary";
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
  sourceText?: string;
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

    const openai =
      createTrackedOpenAI({
        apiKey:
          process.env.OPENAI_API_KEY,
      }, {
        route: "/api/high-comic-plan",
        feature: "고등 써밋네컷 설계안",
      });

    const startedAt = Date.now();
    // Identify boundaries with a compact response; never generate all plans at once.
    const parseCompleted = (response: { status?: string; output_text?: string }): ParsedResponse => {
      if (response.status !== "completed") throw new Error("설계 응답이 완료되지 않았습니다.");
      const raw = response.output_text?.trim();
      if (!raw) throw new Error("설계 응답이 비어 있습니다.");
      return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    };
    const retry = async <T,>(task: (attempt: number) => Promise<T>): Promise<T> => {
      let last: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await task(attempt); } catch (error) { last = error; }
      }
      throw last;
    };
    const discoverBoundaries = async (regionText: string): Promise<number[]> => {
    const sourceWords = Array.from(regionText.matchAll(/\S+/gu), match => ({
      text: match[0], offset: match.index!,
    }));
    const indexedSource = sourceWords.map((word, index) => `[${index + 1}]${word.text}${regionText.slice(word.offset + word.text.length, sourceWords[index + 1]?.offset ?? regionText.length)}`).join("");
    return await retry(async (attempt) => {
      const response = await openai.responses.create({
        model: "gpt-5-mini",
        reasoning: { effort: attempt === 0 ? "low" : "medium" },
        max_output_tokens: 8000,
        input: `입력은 PDF에서 추출한 고등 영어 자료다. 설계안은 만들지 말고 독립 영어 지문의 시작 위치만 찾는다.
서버가 각 단어 앞에 [1], [2]처럼 위치 번호를 붙였다. 이 번호는 문제 번호가 아니라 원문 내 단어 위치다.
각 독립 지문의 영어 원문 첫 단어 앞에 붙은 위치 번호를 startWordIds 배열에 정수로 반환한다.
지문 첫 단어 바로 앞의 문제 번호·제목·문장 번호는 선택하지 않는다. 첫 단어가 문장 번호와 붙어 있으면 그 단어 위치를 선택한다.
문제 번호, 연도, 월 모의고사, 지문 읽기 표시를 참고한다.
같은 지문의 다음 페이지·한국어 해석·해설·단어 목록·보기·선택지는 새 지문이 아니다.
같은 첫 문장이라도 서로 다른 실제 지문이면 서로 다른 위치 번호로 구분한다.
모든 독립 영어 지문을 입력 순서대로 빠짐없이 한 번씩 포함한다. 문장 복사나 제목·요약 생성은 금지한다.
JSON만 반환: {"startWordIds":[12,340,721]}
위 숫자는 형식 예시다. 반드시 실제 입력에 붙어 있는 번호를 사용한다.
입력 자료:\n${indexedSource}`,
      });
      const data = parseCompleted(response) as ParsedResponse & { startWordIds?: number[] };
      if (!Array.isArray(data.startWordIds) || !data.startWordIds.length) throw new Error("지문 시작 위치 번호를 찾지 못했습니다.");
      let previous = 0;
      return data.startWordIds.map((id) => {
        if (!Number.isInteger(id) || id < 1 || id > sourceWords.length || id <= previous) {
          throw new Error("지문 시작 위치 번호가 범위를 벗어나거나 중복·역순입니다.");
        }
        previous = id;
        return sourceWords[id - 1].offset;
      });
    });
    };
    const passages: string[] = [];
    const passageLabels: string[] = [];
    for (const section of partitionSourceSections(sourceText)) {
      if (section.label) {
        // A known question never shares a design request with another question.
        passages.push(section.text);
        passageLabels.push(section.label);
        continue;
      }
      const boundaries = await discoverBoundaries(section.text);
      for (let i = 0; i < boundaries.length; i++) {
        passages.push(section.text.slice(i === 0 ? 0 : boundaries[i], boundaries[i + 1] ?? section.text.length));
        passageLabels.push("");
      }
    }
    if (passages.join("") !== sourceText) throw new Error("지문 분리 후 원문 누락·중복 검증에 실패했습니다.");
    const visualStyles = ["graphic novel", "editorial illustration", "cinematic storyboard",
      "modern webtoon", "ink drawing comic", "painterly illustration", "collage magazine comic",
      "retro comic book", "minimal conceptual illustration", "infographic comic"];
    console.info("[high-comic-plan] boundaries", { passages: passages.length, elapsedMs: Date.now() - startedAt });
    const batchResults: ParsedResponse[] = new Array(passages.length);
    let nextBatch = 0;
    let batchFailed = false;
    const worker = async () => {
      while (!batchFailed && nextBatch < passages.length) {
        const index = nextBatch++;
        const passageText = passages[index];
        const expectedId = `passage-${index + 1}`;
        const selectedVisualStyle = visualStyles[index % visualStyles.length];
        let verbFeedback = "";
        try {
          batchResults[index] = await retry(async (attempt) => {
            const response = await openai.responses.create({
              model: "gpt-5-mini",
        reasoning: { effort: attempt === 0 ? "low" : "medium" },
              max_output_tokens: 16000,
              input: `너는 영어 독해가 어려운 고등학생도 만화로 원문의 뜻과 논리 흐름을 이해하게 돕는 편집자다.
학교: ${schoolName || "미입력"} / 과정: ${gradeName} / 자료명: ${lessonName || "미입력"}
서버가 구분한 독립 지문 하나만 입력한다. plans는 정확히 하나, id는 "${expectedId}"다.
다음 페이지로 이어진 원문과 그 한국어 해석은 같은 지문이다. 해석·단어 목록·보기·문제 머리말은 별도 만화로 만들지 않는다.

[내용과 4컷]
원문의 핵심 주장, 원인과 결과, 비교·대조, 중요한 사례와 결론을 정확히 유지한다.
원문에 없는 사실·수치·결론을 만들지 않는다. 가능성·조건·부정·범위를 확정적인 주장으로 바꾸지 않는다.
정확히 4컷으로 문제/상황 → 사건/설명 → 변화/비교 → 핵심 결론이 드러나게 구성한다. 글의 논리에 맞춰 순서는 조절할 수 있다.
각 컷에 cut, scene, characters, dialogue가 필요하다. cut은 순서대로 1컷, 2컷, 3컷, 4컷이다.
4컷 모두 사람들이 서서 강의하는 모습은 금지한다. 최소 2컷에는 인물이 등장하고, 최소 1컷은 행동·상황 재현·비교·시각적 비유로 보여준다. 순수 사물/풍경 컷은 최대 1컷이다.
장소·표정·행동·구도 중 하나 이상을 컷마다 바꾼다. 본문 밖 비유는 개념을 보여주는 장치로만 사용하고 실제 사실처럼 제시하지 않는다.

[쉽고 자연스러운 한국어 — 핵심 목표]
영어 문장 순서대로 직역하거나 PDF의 한국어 해석을 그대로 옮기지 않는다. 뜻을 이해한 후 실제 사람이 입으로 설명할 한국어로 다시 쓴다.
고등 수준의 내용은 유지하되 문장 자체는 짧고 쉽게 쓴다. 어려운 개념은 상황이나 쉬운 풀이로 먼저 이해시키고 필요한 용어를 붙인다.
문장 하나에는 주된 내용 하나만 담는다. 한 말풍선은 보통 짧은 1~2문장, 한 컷은 보통 말풍선 1~3개로 구성하되 핵심 논리를 빠뜨리지 않는다.
명사를 길게 연결하는 표현, 불필요한 수동태, '이러한/그것/이는'만으로 대상을 가리키는 표현을 줄이고 누가 무엇을 하는지 드러낸다.
'~에 대한 인식을 가지다', '~하는 경향성을 보이다', '~의 영향을 받는 것을 경험하다'처럼 번역체를 쓰지 않는다.
예: '우리의 의사결정에 영향을 미치는 요소예요.' → '이런 것 때문에 우리가 고르는 게 달라질 수 있어요.'
예: '정보를 기억하기 어려움을 경험해요.' → '배운 내용이 잘 기억나지 않아요.'
예: '자원의 가용성이 행동을 제한해요.' → '쓸 수 있는 자원이 적으면 할 수 있는 일도 줄어요.'
위 예시는 문체 예시일 뿐이며 입력 지문에 없는 내용을 가져오지 않는다.
짧은 질문·반응은 이해를 도울 때만 쓴다. 의미 없는 감탄으로 핵심 설명을 대신하거나 유치한 말투·과한 은어를 쓰지 않는다.
blockSummary와 koreanSubtitle도 번역체 없이 핵심을 쉽게 설명한다.
최종 출력 전에 대사를 괄호 속 영어 없이 읽어 보고, 학생이 한 번 읽고 뜻을 이해할 표현으로 다듬는다. 검수 과정은 출력하지 않는다.

[관계에 맞는 말투 — 모든 컷에서 유지]
해설자·내레이터·연구원·연구자·과학자·전문가·교사는 항상 자연스러운 존댓말이다. 내레이션도 '~해요/~입니다/~죠'로 쓴다.
학생이 연구원·상인·교사·부모 등 성인에게 질문·감탄·응답할 때도 존댓말이다. 상인은 학생·손님에게 존댓말이다.
명확한 학생 친구끼리만 자연스러운 반말을 쓴다. 관계가 불명확하면 존댓말이다. 같은 상대에게 반말과 존댓말을 섞지 않는다.
연구원: '이게 핵심이야' 금지 → '이게 핵심이에요'. 학생이 어른에게 '왜 그래?' 금지 → '왜 그런 거예요?'.
speaker와 dialogue.text는 한국어다. 영어 문장 전체를 대사로 쓰지 않는다.

[동사 활용 검수 — 반드시 지킬 것]
keyWords의 사전형 뜻을 대사에 복사하지 않는다. 먼저 자연스러운 한국어 문장을 쓰고 그 문장의 활용된 동사에 영어 괄호를 붙인다.
dialogue.text에는 '기억하다(remember)', '분석하다(analyze)', '기여하다(contribute)' 같은 사전형 하다를 그대로 넣지 않는다.
금지: 분석하다(analyze)해요 / 기여하다(contribute)는 중이에요 / 해결하다(solve)해야 해요.
올바른 예: 분석해요(analyze) / 기여하는(contribute) 중이에요 / 해결해야(solve) 해요.
금지: 기억하다(remember)가 어려워요. 올바른 예: 기억하기(remember)가 어려워요.
문장 끝도 사전형으로 끝내지 않는다. 발화자·상대에 맞는 자연스러운 어미를 포함한다.
영어 괄호를 지워서 소리 내어 읽어도 문장이 자연스러워야 한다. 영어·원문 의미·존댓말은 유지한다.
${verbFeedback}

[고등 수준 핵심 영어 어휘]
영어 원문에 실제 있는 내신·수능 수준 어휘/숙어 5~8개를 우선 고른다. 학습 가치 있는 추상어·학술어·다의어의 문맥상 의미·구동사·동사·숙어를 우선한다.
important, good, bad, people, student, school, time, make, think, learn, life 같은 쉬운 단어로 개수를 채우지 않는다.
적절한 어휘가 5개 미만이면 실제 학습 가치가 있는 것만 선택한다. 원문에 없는 전문용어를 만들지 않는다.
keyWords는 '한글뜻(English)' 배열이다. 대소문자·복수·시제 차이도 같은 어휘로 보고 형태를 통일한다.
각 핵심 영어는 해당 만화 4컷의 대사 안에 '한글뜻(English)'으로 정확히 한 번만 표시한다. 뒤에서 다시 필요하면 영어 괄호 없이 한글만 쓴다. 배경·표지판에 중복시키지 않는다.
어휘는 컷마다 분산하고 마지막 컷에 몰아넣지 않는다. 여러 지문 사이에서는 같은 어휘를 쓸 수 있다.
keyWords에는 사전형 뜻을 써도 되지만 대사에서는 한국어 문장에 맞게 활용한 표현 뒤에 영어를 붙인다.
금지: 기억하다(remember)가 힘들어 / 적응하다(adapt)는 중 / 해결하다(solve)해야 해.
예: 기억하기(remember)가 힘들어 / 적응하는(adapt) 중이야 / 해결해야(solve) 해 / 자료를 분석하면서(analyze).
어휘를 넣으려고 부자연스러운 문장을 만들지 않는다. 영어 괄호를 지워도 조사·어미가 자연스러워야 한다.

[그림과 전개]
visualStyle은 서버 지정값 "${selectedVisualStyle}"로 쓴다.
storyMode는 character dialogue, narrator driven, visual metaphor, comparison, process sequence, cause and effect, symbolic scene, real world example, documentary style, inner monologue 중 원문의 논리에 맞게 고른다.
sourceRange는 입력에서 확인한 출처만 쓰고 추측하지 않는다.

[출력]
설명·검수·코드블록 없이 JSON만 반환한다. 다음 필드를 모두 채운다.
{"overallTitle":"짧은 제목","overallSummary":"짧은 요약","plans":[{"id":"${expectedId}","englishTitle":"짧은 영문 제목","koreanSubtitle":"쉬운 한글 부제","blockSummary":"핵심 내용","sourceRange":"확인된 출처 또는 빈 문자열","visualStyle":"${selectedVisualStyle}","storyMode":"전개 방식","keyWords":["한글뜻(English)"],"panels":[{"cut":"1컷","scene":"장면 설명","characters":"등장인물","dialogue":[{"speaker":"화자","text":"자연스러운 한국어 대사"}]},{"cut":"2컷","scene":"장면 설명","characters":"등장인물","dialogue":[]},{"cut":"3컷","scene":"장면 설명","characters":"등장인물","dialogue":[]},{"cut":"4컷","scene":"장면 설명","characters":"등장인물","dialogue":[]}]}]}

입력 지문:
${passageText}
`,
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
            plan.visualStyle = selectedVisualStyle;
            plan.sourceRange = passageLabels[index] || plan.sourceRange;
            plan.sourceText = passageText;
            const normalizedPlan = deduplicateHighVocabulary(plan);
            const badLines = findUninflectedVocabularyDialogue(normalizedPlan);
            if (badLines.length) {
              verbFeedback = "직전 작성에서 사전형 동사 오류가 발견됐다. 아래 대사의 뜻과 영어는 유지하면서 한국어 동사를 문장에 맞게 활용해서 새 설계안에 반영한다: " + JSON.stringify(badLines);
              throw new Error("대사에 사전형 ~하다(영어)가 남아 있습니다.");
            }
            result.plans = [normalizedPlan];
            return result;
          });
        } catch (error) {
          batchFailed = true;
          throw new Error(`${index + 1}번 지문 설계 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
    // At most three paid requests in flight; settled workers finish before responding.
    const workers = await Promise.allSettled(Array.from({ length: Math.min(3, passages.length) }, () => worker()));
    const failed = workers.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    if (failed) throw failed.reason;
    console.info("[high-comic-plan] completed", { passages: passages.length, elapsedMs: Date.now() - startedAt });
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
            `passage-${index + 1}`,

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

          sourceText: plan.sourceText || "",

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
            ][index % 10],

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
            ][index % 10],

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
