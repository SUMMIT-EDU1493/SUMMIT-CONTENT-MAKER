import { partitionSourceSections } from "./source-sections";
import { deduplicateHighVocabulary, findVocabularyDialogueIssues } from "./vocabulary";
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
        let verbFeedback = "";
        try {
          batchResults[index] = await retry(async (attempt) => {
            const response = await openai.responses.create({
              model: "gpt-5-mini",
        reasoning: { effort: attempt === 0 ? "low" : "medium" },
              max_output_tokens: 16000,
              input: `너는 영어 독해가 어려운 고등학생을 위해 원문의 핵심을 캐릭터가 겪는 짧은 이야기로 각색하는 만화 작가다. 설명문에 그림을 붙이는 대신 사건·행동·대화로 뜻과 논리 흐름을 전달한다.
학교: ${schoolName || "미입력"} / 과정: ${gradeName} / 자료명: ${lessonName || "미입력"}
서버가 구분한 독립 지문 하나만 입력한다. plans는 정확히 하나, id는 "${expectedId}"다.
다음 페이지로 이어진 원문과 그 한국어 해석은 같은 지문이다. 해석·단어 목록·보기·문제 머리말은 별도 만화로 만들지 않는다.

[캐릭터가 겪는 이야기 — 최우선 전개 원칙]
원문의 핵심 주장, 원인과 결과, 비교·대조, 중요한 사례와 결론을 정확히 유지한다.
원문에 없는 사실·수치·결론을 만들지 않는다. 가능성·조건·부정·범위를 확정적인 주장으로 바꾸지 않는다.
각색용 캐릭터와 일상 상황은 개념을 재현하는 가상 장치로 만들 수 있다. 이를 실제 연구 결과·역사적 사실·원문 사례인 것처럼 주장하지 않는다. 실제 인물/사건/조건이 핵심인 지문은 그것을 우선 재현한다.
출력 전에 이 지문의 중심 캐릭터, 원하는 것/문제, 행동이나 선택, 그에 따른 변화/발견을 정한다. 이 작업 메모는 출력하지 않는다.
정확히 4컷의 연결된 이야기로 만든다. 상황/문제 → 시도/선택 → 변화/비교 → 결과/깨달음을 기본으로 하되 원문 논리에 맞게 조절한다. 인물과 상황이 이어지고 앞 컷의 행동이 다음 컷에 영향을 주게 한다.
캐릭터는 직접 해 보고, 망설이고, 선택하고, 관찰하고, 상대에게 반응한다. 질문→전문가 강의만 네 번 반복하지 않는다. 억지 갈등이나 원문에 없는 실패·성공을 넣어 주장 강도를 바꾸지 않는다.
추상 개념도 그 개념이 드러나는 구체적 행동과 반응으로 보여준다. 비교 지문은 같은 인물의 두 선택이나 두 인물의 다른 행동을 보여줄 수 있다. 과정 지문은 인물이 과정을 따라가며 변화를 발견하게 한다.
무조건 학생 A/B와 연구원으로 만들지 않는다. 원문에 맞는 친구, 작가/독자, 손님/상인, 선수, 가족, 연구팀, 실제 사례 속 인물 등으로 구성한다. 한 인물의 행동과 혼잣말로도 전달할 수 있다.
최소 세 컷에 캐릭터의 직접 대사가 있어야 하고, 주요 캐릭터 최소 한 명이 두 컷 이상에서 이어서 말한다. 말풍선마다 자기 눈앞의 상황·행동·느낌·선택에 연결한다.
최소 두 컷은 캐릭터가 실제로 행동하거나 선택하는 장면이다. 장면 설명에는 누가 무엇을 하는지와 눈에 보이는 변화를 쓴다. 배경만 바꾸거나 실루엣/상징만 두고 추상 설명을 읽히지 않는다.
해설자/내레이션은 없애는 것을 기본으로 한다. 꼭 필요한 시간·장소·장면 연결에만 전체 4컷에서 최대 한 발화, 영어 괄호 제외 60자 이내로 허용한다. 해설자가 핵심 개념과 결론을 대신 설명하지 않는다.
해설자 대사를 학생·연구원 이름으로 바꾸는 우회는 금지한다. 연구원도 자기 실험·관찰·문제에 참여하고 상대의 행동에 반응한다. 네 컷 내내 일반론을 강의하면 다시 각색한다.
각 컷에 cut, scene, characters, dialogue가 필요하다. cut은 순서대로 1컷, 2컷, 3컷, 4컷이다. 장소·표정·행동·구도 중 하나 이상을 컷마다 바꾼다.

[쉽고 자연스러운 한국어 — 핵심 목표]
영어 문장 순서대로 직역하거나 PDF의 한국어 해석을 그대로 옮기지 않는다. 뜻을 이해한 후 캐릭터가 자기 상황에서 실제로 말할 한국어로 다시 쓴다.
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
pencil, pen, book, school, student, teacher, people, good, bad, food, water, day, time, happy는 단독 핵심 영어로 표시하지 않는다. 한국어 대사에서는 필요하면 그대로 말하되 영어 괄호와 keyWords에서는 제외한다.
important, make, think, learn, life 같은 쉬운 기본 뜻으로 개수를 채우지 않는다. 문맥상 고등 수준의 숙어·다의어 용법은 구 전체로 선정할 수 있다.
적절한 어휘가 5개 미만이면 실제 학습 가치가 있는 것만 선택한다. 원문에 없는 전문용어를 만들지 않는다.
keyWords는 '한글뜻(English)' 배열이다. 대소문자·복수·시제 차이도 같은 어휘로 보고 형태를 통일한다.
각 핵심 영어는 해당 만화 4컷의 대사 안에 '한글뜻(English)'으로 정확히 한 번만 표시한다. 뒤에서 다시 필요하면 영어 괄호 없이 한글만 쓴다. 배경·표지판에 중복시키지 않는다.
어휘는 컷마다 분산하고 마지막 컷에 몰아넣지 않는다. 여러 지문 사이에서는 같은 어휘를 쓸 수 있다.
keyWords에는 사전형 뜻을 써도 되지만 대사에서는 한국어 문장에 맞게 활용한 표현 뒤에 영어를 붙인다.
금지: 기억하다(remember)가 힘들어 / 적응하다(adapt)는 중 / 해결하다(solve)해야 해.
예: 기억하기(remember)가 힘들어 / 적응하는(adapt) 중이야 / 해결해야(solve) 해 / 자료를 분석하면서(analyze).
어휘를 넣으려고 부자연스러운 문장을 만들지 않는다. 영어 괄호를 지워도 조사·어미가 자연스러워야 한다.

[최종 대사 편집 순서 — 어휘 삽입보다 한국어 이해가 먼저]
아래 세 단계를 한 응답 안에서 순서대로 수행한다. 중간 초안과 검수 내용은 출력하지 않는다.
1. 뜻 파악: 영어 원문에서 누가 무엇을 하는지, 원인·결과·조건·대조·부정과 핵심 개념을 확인한다.
2. 한국어 초안: 영어 괄호와 단어장 뜻을 잠시 빼고, 장면 속 인물이 자기 행동·느낌·발견을 상대에게 말할 짧은 한국어 대사를 먼저 쓴다. 독자에게 설명하는 일반론 대신 눈앞의 상황에 반응하게 한다. 번역문의 문장 구조를 따라가지 않는다.
3. 어휘 연결: 완성한 한국어에서 해당 영어와 의미가 맞는 표현 뒤에 괄호를 붙인다. 고등 어휘는 유지하되 그 한국어 풀이를 반드시 사전의 한 단어 명사로 제한하지 않는다. 문맥에 맞는 짧은 풀이도 허용한다. 어휘를 붙인 뒤 다시 읽고 부자연스러워졌다면 대사를 다시 쓴다.

[캡처에서 확인된 실패 사례 — 이런 문장 구조를 반복하지 말 것]
- '포용(inclusion)을 받고 있는지를 평가하게 합니다.' → '사람들이 나를 받아들이는지(inclusion) 알 수 있어요.'
- '수용(acceptance)을 높이려 행동을 조정합니다.' → '사람들에게 받아들여지고(acceptance) 싶어서 행동을 바꾸는 거예요.'
- '누가 그 음식을 좋아하느냐가 영향을 줍니다.' → '누가 좋아하는 음식인지에 따라 내 취향도 달라져요.'
- '정말 바이럴(viral)했죠.' → '인터넷에서 엄청 화제였죠(viral).'
이 예시는 해당 문맥에서의 표현 방식만 보여준다. 현재 원문의 뜻과 품사를 먼저 확인하고, 무관한 사례를 넣거나 다른 뜻의 단어에 같은 풀이를 적용하지 않는다.
추상 명사+'받다/높이다/하다'로 사전 뜻을 억지로 연결하지 않는다. 실제 사람의 행동·느낌·상황이 보이게 쓴다.
'내부 자원을 동원한다'처럼 원문 핵심 개념이면 함부로 삭제하지 않는다. 원문이 뜻하는 능력·노력·자원을 짧게 풀어 설명하되, 확인되지 않은 구체적인 종류를 만들어 넣지 않는다.
'별개로/평가하게 합니다/행동을 조정합니다/정상적인 과정입니다'는 원문의 의미상 꼭 필요하지 않으면 생활 표현으로 바꾼다. 단순히 '~합니다'를 '~해요'로 바꾸는 것만으로 검수를 끝내지 않는다.
말풍선 하나에 핵심 개념을 여러 개 나열하지 않는다. 긴 설명은 컷 안의 두 발화로 나누거나 그림·행동과 연결하되 원문 논리와 핵심 어휘는 보존한다.
해설자도 독자에게 설명하는 자연스러운 해요체를 우선 쓴다. 학생이 어른에게 말할 때는 '저/저도/제' 등 문장 안의 표현도 관계에 맞춘다. 친구끼리는 자연스러운 '나/내'를 쓸 수 있다.
speaker에는 '해설자', '연구원', '학생 A'처럼 화자 이름/역할만 쓴다. '(존댓말)', '(반말)', '(존대)', 말투 지시나 편집 메모는 넣지 않는다. 말투는 실제 대사에 반영한다.
마지막으로 영어 괄호를 전부 빼고 대사를 읽어 보라. 어려운 한국어를 해석해야 뜻이 보이는 문장이 남으면 짧고 명확한 한국어로 다시 쓴다.
내용·조건·가능성·부정은 유지하고 설명을 쉽게 만든다는 이유로 주장 강도를 바꾸지 않는다.

[이번 지문 최종 검수 — 하나라도 어기면 출력 전에 고친다]
- 모든 동사: 하다뿐 아니라 억누르다·받아들이다·피하다·자르다 등도 문장에 맞게 활용한다. '억누르다(suppress) 않는' 금지 → '억누르지(suppress) 않는'. '받아들이다(accept)는 중' 금지 → '받아들이는(accept) 중'. 사전형을 없애려고 문장의 부정·시제·조건을 바꾸지 않는다.
- 영어 위치: 문장 전체 끝에 단어를 덧붙이지 않는다. 해당 영어를 풀이하는 활용된 한국어 표현 바로 뒤에 둔다. 예: '퍼졌어요(spread).'처럼 동사가 마지막이면 끝 위치도 자연스럽다. '부담을 줘서(discourage), 읽기를 망설일 수 있어요.'처럼 문장 중간에 뜻이 있으면 그 위치에 붙인다. 원문의 대상과 의미가 맞는지 확인한다.
- 쉬운 설명: '너무 많은 아주 작은 단락의 연속' 같은 명사 나열을 피한다. '짧은 단락이 너무 많이 이어지면(succession), 생각의 흐름이 뚝뚝 끊겨요(chop).'처럼 행동과 결과로 설명한다. 원문의 주장·인과·조건은 그대로 유지한다.
- 구체성: '바꿔도 괜찮다고 스스로 알 수 있을지'처럼 대상이 모호하면 원문에서 무엇을 바꾼다는 것인지 확인해 명시한다. 이미 앞 대사에서 밝혀졌다면 반복하지 않아도 된다.
- 인물 말투: 친구 A/B는 한 장면 안에서 서로 자연스러운 반말을 사용해도 된다. 어른에게는 존댓말이다. 해설자·연구원은 항상 존댓말이다. '난 ... 피했어요'처럼 인칭과 말끝을 혼합하지 않는다. 존댓말 대사는 '저는 ... 피했어요', 친구끼리 반말은 '난 ... 피했어'로 관계에 맞춘다.
- 감정: 원문에 없는 비꼼·비난·과장을 덧붙이지 않는다. '그 잘난 샐러드' 같은 표현은 원문에 그런 태도가 명확히 있을 때만 허용한다. 잘게 썬 샐러드 같은 실제 특징을 비꼬는 형용사로 바꾸지 않는다.
- 위 예문은 표현 방식 참고용이다. 현재 지문과 무관한 내용을 추가하거나 예문의 영어를 원문 밖에서 가져오지 않는다.

[그림과 전개]
visualStyle은 서버 지정값 "${selectedVisualStyle}"로 쓴다.
storyMode는 character dialogue, real world example, inner monologue, comparison, process sequence, cause and effect, documentary style 중 원문에 맞게 고른다. 어떤 방식도 캐릭터의 연결된 행동과 직접 대사가 중심이다. narrator driven은 사용하지 않는다.
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
            const dialogueIssues = [...findVocabularyDialogueIssues(plan), ...findCharacterStoryIssues(normalizedPlan)];
            if (dialogueIssues.length) {
              verbFeedback = "직전 작성 검수에서 문제가 발견됐다. 아래 항목을 수정한다. 동사는 의미·부정·시제를 유지해 자연스럽게 활용한다. 기초 단어는 한국어 내용은 유지하고 영어 병기/keyWords에서 제외한다. 대체 고등 어휘는 이 원문에 실제 있을 때만 선택하며 개수를 채우지 않는다. 인칭/말투는 인물 관계에 맞춘다. 이야기 구조 오류는 화자 이름만 바꾸지 말고 원문 핵심이 드러나는 연결된 사건·행동·캐릭터 대사로 재구성한다. 수정 설명 없이 같은 ID의 전체 4컷 JSON을 반환한다: " + JSON.stringify(dialogueIssues);
              throw new Error("대사·어휘·캐릭터 이야기 구조 검증에 실패했습니다.");
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
