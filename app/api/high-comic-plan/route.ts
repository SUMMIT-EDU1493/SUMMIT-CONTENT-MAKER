import { partitionSourceSections } from "./source-sections";
import { findVocabularyDialogueIssues } from "./vocabulary";
import { assertPlainStory, attachReviewedVocabulary, type StoryReview } from "./story-editor";

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

// Structural checks only: semantic fidelity and visible action still need review.
function findCharacterStoryIssues(plan: HighComicPlan): string[] {
  const isNarrator = (speaker: string) => /^(?:해설자|해설|내레이터|내레이션|나레이터|나레이션|내레이터|내래이터|내래이션|해설자\s*[A-Z0-9]|narrator|narration)$/iu
    .test(speaker.replace(/\([^()]*\)/gu, "").trim());
  const spoken = plan.panels.flatMap(panel => panel.dialogue.filter(line => line.text.trim()));
  const narration = spoken.filter(line => isNarrator(line.speaker));
  const characterPanels = plan.panels.filter(panel => panel.dialogue.some(line =>
    line.text.trim() && line.speaker.trim() && !isNarrator(line.speaker)));
  const issues: string[] = [];
  if (narration.length > 1) issues.push("해설자/내레이션은 전체 4컷에서 최대 한 발화만 허용한다. 나머지는 캐릭터가 상황 속에서 말하고 행동하게 다시 구성한다.");
  if (narration.some(line => line.text.replace(/\([^()]*\)/gu, "").trim().length > 60)) {
    issues.push("해설은 짧은 연결 문장만 쓴다(영어 괄호 제외 60자 이내). 핵심 내용은 캐릭터의 사건과 반응으로 전달한다.");
  }
  if (characterPanels.length < 3) issues.push("최소 세 컷은 장면 속 캐릭터가 직접 말하는 컷이어야 한다. 해설문을 학생이나 연구원 이름으로 바꾸기만 하지 않는다.");
  const appearances = new Map<string, number>();
  for (const panel of plan.panels) {
    const speakers = new Set(panel.dialogue.filter(line => line.text.trim() && !isNarrator(line.speaker))
      .map(line => line.speaker.replace(/\s+/gu, "").trim()).filter(Boolean));
    for (const speaker of speakers) appearances.set(speaker, (appearances.get(speaker) || 0) + 1);
  }
  if (![...appearances.values()].some(count => count >= 2)) {
    issues.push("주요 캐릭터가 최소 두 컷에서 이어서 등장하고 말해야 한다. 서로 무관한 네 설명 장면으로 나누지 않는다.");
  }
  if (plan.storyMode?.trim().toLowerCase() === "narrator driven") {
    issues.push("narrator driven 전개는 사용하지 않는다. 캐릭터 중심의 사건 전개를 선택한다.");
  }
  return issues;
}

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
        let draftFeedback = "";
        let editorFeedback = "";
        try {
          // Each stage has its own retry. A failed editor never regenerates a valid draft.
          const draft = await retry(async (attempt) => {
            const response = await openai.responses.create({
              model: "gpt-5-mini", reasoning: { effort: "medium" }, max_output_tokens: 8000,
              input: `작업 단계: KOREAN_STORY_DRAFT
너는 고등 영어 지문의 핵심을 캐릭터가 겪는 네 컷 이야기로 바꾸는 한국어 만화 작가다.
학교: ${schoolName || "미입력"} / 과정: ${gradeName} / 자료명: ${lessonName || "미입력"}
독립 지문 하나만 각색한다. id는 "${expectedId}"다. 한국어 해석·단어 목록은 별도 지문이 아니다.
이 단계는 영어 어휘를 고르거나 삽입하지 않는다. keyWords는 빈 배열이다. 대사는 영어 글자/괄호 없이 완성된 한국어로 쓴다.

먼저 원문의 주장·조건·부정·원인/결과·중요 사례를 이해한다. 그 뜻이 드러날 캐릭터의 상황, 행동, 반응, 결과를 정한 뒤 네 컷을 쓴다.
원문에 실제 인물과 사건이 있으면 이를 우선 재현한다. 추상 지문은 가상 일상 상황으로 보여줄 수 있지만 원문에 없는 연구 결과·수치·주장·확정적 성공/실패는 만들지 않는다.
원문 논리와 연결되는 상황 → 행동/선택 → 변화/비교 → 발견의 이야기를 구성한다. 글에 따라 순서는 바꿀 수 있다. 같은 주요 인물이 이어서 등장하고 앞 컷의 행동이 다음 컷에 영향을 줘야 한다.
인물은 실제 행동·선택을 최소 두 컷에서 한다. 장소를 바꾸고 일반론을 읽히는 것은 사건이 아니다. 눈앞에서 생긴 일에 반응하는 대사를 쓴다.
무조건 학생과 선생님을 쓰지 않는다. 실직 경험이면 직장인, 글쓰기면 작가와 독자처럼 경험에 맞는 역할을 고른다. 한 인물의 행동과 혼잣말도 가능하다.
해설자를 학생/연구원 이름으로 바꾸어 강의시키지 않는다. 설명보다 캐릭터의 행동·갈등·질문·선택·반응으로 핵심을 전달한다. 질문과 강의만 반복하지 않는다.
해설은 기본적으로 없다. 꼭 필요한 시간/장소 연결만 전체에서 한 발화, 60자 이내로 쓴다. 최소 세 컷에 캐릭터 직접 대사가 있고 같은 캐릭터 한 명이 두 컷 이상 말한다.
쉬운 생활 한국어로 쓴다. '입맛은 사회적이다' 대신 누가 무엇을 좋아해서 자기 선택이 달라졌는지 보여준다. '동일한 사람들' 대신 어떤 점이 비슷한 사람들인지 상황에 필요한 만큼 밝힌다.
대사는 입으로 말할 짧은 문장이다. 단어장 뜻, 추상 명사 나열, 바이럴/레퍼토리 같은 불필요한 음역, 원문에 없는 비꼼은 피한다. 중요한 개념은 삭제하지 말고 상황과 쉬운 말로 전달한다.
해설자·연구원·교사·상인은 항상 존댓말. 학생은 어른에게 존댓말. 친구끼리와 부모가 자녀에게 말할 때는 자연스러운 반말을 쓸 수 있다. 한 상대에게 같은 말투를 유지한다.
엄마가 아이에게 자기 신체에 대해 설명하는 번역문을 말하게 하지 않는다. 인물의 나이·경험·관계가 대사와 맞아야 한다.
한 컷 1~3개 말풍선, 한 말풍선은 짧은 1~2문장을 기본으로 한다. 원문 핵심을 빠뜨리지 않는다.
visualStyle은 "${selectedVisualStyle}". storyMode는 character dialogue, inner monologue, comparison, process sequence, cause and effect, real world example 중 고른다.
${draftFeedback}

JSON만 반환한다. plans 정확히 하나. 다음 형태에서 panels는 정확히 1컷부터 4컷까지 채운다:
{"plans":[{"id":"${expectedId}","englishTitle":"English title","koreanSubtitle":"한글 부제","blockSummary":"원문 핵심","sourceRange":"확인된 출처 또는 빈 문자열","visualStyle":"${selectedVisualStyle}","storyMode":"character dialogue","keyWords":[],"panels":[{"cut":"1컷","scene":"누가 무엇을 하고 어떤 변화가 보이는지","characters":"인물 이름과 역할","dialogue":[{"speaker":"인물 이름","text":"완성된 한국어 대사"}]}]}]}
입력 원문:
${passageText}`,
            });
            try {
              const result = parseCompleted(response);
              if (result.plans?.length !== 1) throw new Error("초안은 지문 하나여야 합니다.");
              const plan = result.plans[0];
              assertPlainStory(plan, expectedId);
              const issues = findCharacterStoryIssues(plan);
              if (issues.length) throw new Error(issues.join(" / "));
              return plan;
            } catch (error) {
              draftFeedback = `초안 검증 실패(${attempt + 1}회): ${error instanceof Error ? error.message : String(error)}. 문제를 고쳐 전체 네 컷을 다시 작성한다.`;
              throw error;
            }
          });
          batchResults[index] = await retry(async (attempt) => {
            const response = await openai.responses.create({
              model: "gpt-5-mini", reasoning: { effort: "medium" }, max_output_tokens: 12000,
              input: `작업 단계: SOURCE_DIALOGUE_EDITOR
너는 만화의 독립 편집자다. 원문과 아래 한국어 초안을 대조해 이야기·내용·말투를 검수하고, 수정한 한국어 대사와 영어 연결표를 따로 반환한다.

[먼저 이야기와 한국어를 완성한다]
핵심 주장·사례·인과·조건·부정·가능성·범위가 원문과 맞는지 확인한다. 핵심을 빠뜨리거나 원문보다 단정하는 부분은 고친다.
네 컷이 같은 인물과 상황으로 이어지는지, 인물이 최소 두 컷에서 행동/선택하는지 확인한다. 화자 이름만 바뀐 설명문이면 캐릭터의 상황과 반응으로 다시 각색한다. 학생에게 실직 경험을 주는 등 역할과 경험의 불일치를 고친다.
해설은 연결 문장 한 발화까지만, 60자 이내. 세 컷 이상은 캐릭터 대사, 주요 인물은 두 컷 이상에서 말한다.
대사는 영어와 단어장 뜻을 빼고 읽었을 때 자연스러워야 한다. '경이롭도록 만들어졌어요', '입맛이 사회적이라는 걸 알게 됐어요', '거의 동일한 사람들', '그 바이럴 다진 샐러드' 같은 번역체/불명확한 음역은 문맥에 맞는 생활 한국어로 고친다.
말투는 누가 누구에게 말하는지 기준으로 정한다. 해설자·연구원·교사·상인은 존댓말, 학생이 어른에게 말할 때도 존댓말. 친구끼리, 부모가 자녀에게 말할 때는 자연스러운 반말을 쓸 수 있다. 한 말풍선에서 반말과 존댓말을 섞지 않는다.
각 화자는 이 이야기에서 일관된 말투를 쓴다. 학생이 친구와 어른 양쪽에게 말하면 모두 자연스러운 존댓말로 일관시켜도 된다. '알았어. 그런데 불편한 게 있어요.' 같은 혼합은 금지한다.
내용에 맞는 짧은 완성 문장을 쓴다. plans의 dialogue.text는 영어 글자/영어 괄호 없이 완성된 한국어다. keyWords는 빈 배열. 화자에 '(존댓말)' 같은 메모를 넣지 않는다.
영어를 담기 위해 이야기와 한국어를 억지로 바꾸지 않는다. 수정이 필요하면 먼저 한국어 문장 전체를 자연스럽게 완성한다.

[그 다음 어휘 연결표를 만든다]
원문에 실제 있는 고등 내신/수능 수준 어휘·숙어를 5~8개 우선한다. 부족하면 적게 선택해도 되고 0개도 가능하다. 기초 단어로 수를 채우지 않는다.
pencil, pen, book, school, student, teacher, people, good, bad, food, water, day, time, happy를 단독 핵심 어휘로 선정하지 않는다. 단어를 빼도 한국어 내용은 유지한다.
각 영어는 네 컷에서 한 번만. 완성된 대사에서 영어와 의미가 정확히 대응하는 한국어 표현을 koreanPhrase에 그대로 복사한다. 문장 끝에 무관한 영어를 달지 않는다. 한국어 단어 속을 임의로 나누지 않는다.
동사는 활용된 표현 전체를 선택한다: '비난해서' 뒤에 criticize를 붙인다. '비난'만 선택하지 않는다. '낙담시킬' 뒤에 discourage를 붙인다. '낙담시키다'로 문장을 만들지 않는다.
형용사·부사·명사·숙어도 문맥 의미와 품사에 맞춘다. 예문 속 영어를 현재 원문 밖에서 가져오지 않는다. 부사 wonderfully를 한국어 동사 전체에 억지로 대응시키지 않는다.
영어는 원문에서 실제 확인한 철자/활용형을 사용한다. sourceQuote는 그 영어를 포함한 원문 연속 구절을 그대로 인용한다. 원문과 다른 동사 원형으로 임의 변경하지 않는다.
cut과 line은 1부터 시작한다. koreanPhrase는 그 대사 안에 정확히 한 번 있어야 하고, 다른 연결표 표현과 겹치지 않아야 한다. 표현 끝의 문장부호는 포함하지 않는다.
meaning은 단어장용 한국어 뜻, partOfSpeech는 noun/verb/adjective/adverb/phrase 중 하나다. 서버가 한국어를 고치지 않고 선택한 표현 바로 뒤에 영어 괄호만 삽입한다.

[원문 근거와 인물 검수 결과]
sourceChecks는 핵심 내용에 대한 서로 다른 원문 연속 인용 2~8개다. 각 인용은 12자 이상이고 반드시 입력에 실제 있어야 한다. koreanMeaning에 뜻을 적고 cuts에 해당 내용이 드러나는 컷 번호를 적는다. 인용 존재만으로 의미가 맞는 것은 아니니 직접 원문과 그림/대사를 대조한다.
cast에 모든 화자의 이름·실제 역할·이 이야기에서 쓰는 말투(polite/casual)를 적는다. 역할은 이름이 아니라 경험과 관계까지 고려한다.
id는 "${expectedId}", visualStyle은 "${selectedVisualStyle}"를 유지한다. 원문 출처를 추측하지 않는다.
${editorFeedback}

출력 JSON 형태(설명/코드블록 금지):
{"plans":[{"id":"${expectedId}","englishTitle":"title","koreanSubtitle":"부제","blockSummary":"원문 핵심","sourceRange":"","visualStyle":"${selectedVisualStyle}","storyMode":"character dialogue","keyWords":[],"panels":[{"cut":"1컷","scene":"행동과 변화","characters":"인물","dialogue":[{"speaker":"인물","text":"영어 없는 완성 한국어"}]}]}],"cast":[{"speaker":"인물","role":"실제 역할","register":"polite"}],"sourceChecks":[{"sourceQuote":"실제 원문의 연속 구절","koreanMeaning":"핵심 뜻","cuts":[1,2]}],"vocabularyLinks":[{"cut":1,"line":1,"koreanPhrase":"대사 속 활용된 표현","english":"원문 영어","sourceQuote":"그 영어가 포함된 실제 원문 연속 구절","partOfSpeech":"verb","meaning":"단어장 뜻"}]}
plans의 panels는 반드시 네 컷, sourceChecks는 서로 다른 근거 최소 두 개다. 위 형식 예시의 문장을 복사하지 않는다.
한국어 초안:
${JSON.stringify(draft)}
입력 원문:
${passageText}`,
            });
            try {
              const review = parseCompleted(response) as unknown as StoryReview;
              const plan = attachReviewedVocabulary(review, passageText, expectedId);
              const issues = [...findVocabularyDialogueIssues(plan), ...findCharacterStoryIssues(plan)];
              if (issues.length) throw new Error(issues.join(" / "));
              plan.visualStyle = selectedVisualStyle;
              plan.sourceRange = passageLabels[index] || plan.sourceRange;
              plan.sourceText = passageText;
              return { plans: [plan] };
            } catch (error) {
              editorFeedback = `편집 검증 실패(${attempt + 1}회): ${error instanceof Error ? error.message : String(error)}. 초안을 다시 생성할 필요 없이 편집 결과의 한국어/말투/근거/어휘 연결표를 수정해 전체 JSON을 반환한다.`;
              throw error;
            }
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
              "character dialogue",
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
