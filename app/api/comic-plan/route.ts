import OpenAI from "openai";

import { createTrackedOpenAI } from "@/lib/tracked-openai";
export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }
    const openai = createTrackedOpenAI({
      apiKey,
    }, {
        route: "/api/comic-plan",
        feature: "중등 대화문 설계안",
      });

    const body = await request.json();

    const title = body.title;
    const content = body.content;
    const requestedVisualStyle =
      typeof body.visualStyle === "string"
        ? body.visualStyle
        : "modern webtoon";

    const batchItems = Array.isArray(body.items)
      ? body.items
          .slice(0, 6)
          .filter(
            (item: any) =>
              typeof item?.content === "string" &&
              item.content.trim()
          )
          .map((item: any, index: number) => ({
            index,
            title: String(item.title || `대화문 ${index + 1}`),
            content: item.content.trim(),
            visualStyle:
              typeof item.visualStyle === "string"
                ? item.visualStyle
                : "modern webtoon",
          }))
      : [];

    if (batchItems.length > 0) {
      const batchStartedAt = performance.now();
      const response = await openai.responses.create({
        model: "gpt-5-mini",
        max_output_tokens: Math.min(16000, 3200 * batchItems.length),
        input: `
너는 중학생 영어 교재를 자연스럽고 재미있는 4컷 학습만화로 재구성하는 전문 작가다.

아래 대화문 ${batchItems.length}개를 각각 독립된 설계안으로 만들어라.
입력 순서와 출력 plans 순서를 반드시 유지하라. 하나의 대화문을 합치거나 누락하지 마라.

각 plan은 반드시 정확히 4개의 panel을 가진다.
원문 정보 순서와 화자 소유권을 유지하고, 학생이 부모·교사·성인에게는 존댓말을 사용한다.
각 panel에는 다음 필드를 모두 채운다:
shotType, cameraAngle, characterAction, visualFocus, propOrObject,
setting, panelRole, reactionBeat, humorBeat, scene, characters, dialogue.

각 만화 안에서:
- 4컷 모두 같은 two-shot 대화 구도를 사용하지 않는다.
- 최소 2종 이상의 shotType을 사용한다.
- 최소 1컷은 대화보다 행동·소품·환경이 중심이다.
- 인접한 컷에서 같은 인물 배치를 반복하지 않는다.
- 내용에 맞을 때만 작은 유머나 리액션을 넣고 핵심 의미를 왜곡하지 않는다.
- 지정 visualStyle을 선, 채색, 질감, 조명, 구도에 실제로 반영한다.

visualStyle 후보 해석:
modern webtoon=crisp digital lineart and cel shading
clean graphic novel=varied ink contours and restrained palette
soft editorial illustration=soft hand-drawn shapes and paper texture
cinematic storyboard=dynamic perspective and directional lighting
expressive ink comic=lively ink strokes and energetic expressions
painterly educational illustration=painted brush texture and rich environments
collage magazine comic=mixed-media cut-paper shapes, never photographs
retro comic book=vintage print texture and halftone-inspired illustration
minimal conceptual comic=simplified forms and generous negative space
infographic comic=structured diagrams, objects and comic composition

반드시 JSON만 출력한다.
{
  "plans": [
    {
      "title": "원 대화문 제목",
      "summary": "짧은 한글 제목",
      "visualStyle": "지정 스타일",
      "storyMode": "선택한 전개 방식",
      "panels": [
        {
          "cut": "1컷",
          "scene": "장면",
          "characters": "외형과 관계",
          "shotType": "wide",
          "cameraAngle": "구도",
          "characterAction": "행동",
          "visualFocus": "초점",
          "propOrObject": "소품 또는 없음",
          "setting": "장소",
          "panelRole": "역할",
          "reactionBeat": "반응",
          "humorBeat": "유머 또는 없음",
          "dialogue": [{ "speaker": "화자", "text": "자연스러운 한국어 대사" }]
        }
      ]
    }
  ]
}

입력 대화문:
${batchItems
  .map(
    (item: any) => `
=== ITEM ${item.index + 1} ===
TITLE: ${item.title}
VISUAL STYLE: ${item.visualStyle}
CONTENT:
${item.content}`
  )
  .join("\n")}
`,
      });

      const raw = response.output_text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(raw);
      const plans = Array.isArray(parsed?.plans) ? parsed.plans : [];

      console.info(
        `[middle dialogue plan] batch OpenAI request: ${Math.round(
          performance.now() - batchStartedAt
        )}ms (items=${batchItems.length})`
      );

      return Response.json({
        plans: batchItems.map((item: any, index: number) => {
          const plan = plans[index];
          return plan && Array.isArray(plan.panels) && plan.panels.length === 4
            ? {
                ...plan,
                visualStyle: plan.visualStyle || item.visualStyle,
                storyMode: plan.storyMode || "character dialogue",
              }
            : {
                error: "설계안이 정확히 4컷으로 생성되지 않았습니다.",
              };
        }),
      });
    }

    if (
      !content ||
      typeof content !== "string"
    ) {
      return Response.json(
        {
          error:
            "만들 대화문 내용이 없습니다.",
        },
        { status: 400 }
      );
    }

    const response =
      await openai.responses.create({
        model: "gpt-5-mini",

        input: `
너는 중학생 영어 교재를
자연스럽고 재미있는 4컷 학습만화
"써밋네컷"으로 재구성하는
전문 작가다.

아래 영어 대화문을 바탕으로
정확히 4컷의 만화 설계안을 만들어라.

==================================================
[가장 중요한 목표]
==================================================

1. 원문의 대화 흐름과 정보 순서를 유지한다.
2. 한국 중학생이 실제로 말할 법한
   자연스러운 한국어 대사로 바꾼다.
3. 등장인물 관계에 맞는 말투를 사용한다.
4. 네 컷의 장면과 구도가 반복되지 않게 한다.
5. 등장인물들이 서로 확실히 구분되도록
  외형 특징을 설계한다.
6. 중요한 영어 학습어를
  한글뜻(English) 형식으로 자연스럽게 넣는다.

7. 지정된 visualStyle을 선, 채색, 질감, 조명, 구도에 실제로 반영한다.

지정 visualStyle:
${requestedVisualStyle}

==================================================
[원문 순서 - 절대 중요]
==================================================

원문의 대화 진행 순서를 절대 바꾸지 마라.

- 1컷 = 원문의 초반
- 2컷 = 그다음
- 3컷 = 그다음
- 4컷 = 원문의 후반

뒤에 나온 정보를 앞 컷으로 옮기지 않는다.

앞에서 나온 내용을 뒤로 이동시키지 않는다.

일부 문장을 생략하거나 자연스럽게
줄이는 것은 가능하지만,
남은 정보의 순서는 반드시 원문과 같아야 한다.

대화 순서 문제가 출제될 수 있으므로
흐름 재배치는 금지한다.

==================================================
[등장인물 관계 분석]
==================================================

대사를 만들기 전에
먼저 등장인물 사이의 관계를 판단하라.

가능한 관계 예:

- 친구
- 같은 반 학생
- 형제자매
- 엄마와 자녀
- 아빠와 자녀
- 선생님과 학생
- 직원과 손님
- 낯선 어른과 학생
- 또래 처음 만난 사람

관계에 따라 말투를 결정한다.

[친구 / 또래]
자연스러운 반말을 사용한다.

예:
"이거 너한테 잘 맞겠다."
"오, 괜찮은데?"
"너 이거 좋아하잖아."

[엄마 / 아빠 / 선생님 / 어른]
학생이 어른에게 말할 때는
자연스러운 존댓말을 사용한다.

예:
"엄마, 저 이거 해 보고 싶어요."
"선생님, 이건 무슨 뜻이에요?"
"네, 알겠습니다."보다는
상황에 맞게 자연스럽게
"네, 알겠어요."처럼 말할 수 있다.

부모가 자녀에게 말하는 대사는
자연스러운 반말이 가능하다.

절대로 모든 등장인물에게
일괄적으로 반말을 사용하지 마라.

==================================================
[한국어 대사 스타일]
==================================================

직역투 금지.

교과서 번역체 금지.

보고서 같은 말투 금지.

실제로 학생들이 말할 법한
짧고 자연스러운 대사를 사용한다.

어색한 예:
"너라면 진짜 될 거야."
"너면 꼭 될 거야."
"추천직업이 실용적인 편이야."
"나는 네가 성공할 수 있다고 확신해."
"그것은 좋은 선택인 것 같아."

자연스러운 예:
"오, 이거 너한테 딱인데?"
"넌 진짜 잘할 것 같아!"
"와, 이 직업(job) 괜찮다!"
"네 성격(personality)이랑 잘 맞네."
"이거 한번 해 보고 싶어."
"엄마, 저 이거 해 보고 싶어요."

==================================================
[영어 학습어 삽입 - 필수]
==================================================



전체 4컷에 영어 핵심 단어 또는 짧은 표현을 반드시 총 4~6개 넣는다.
형식은 반드시 한글뜻(English)이다.

예:
직업(job)
성격(personality)
흥미(interest)
조언(advice)
선택(choice)

규칙:

- 영어만 따로 문장 끝에 붙이지 않는다.
- 영어 한 줄 / 한국어 한 줄 형태 금지.
- 반드시 자연스러운 한국어 문장 안에서
  한글뜻 바로 뒤에 괄호로 넣는다.

- 최소 3개 이상의 서로 다른 컷에 영어 표현이 들어가야 한다.
- 0개, 1개, 2개만 넣는 것은 금지한다.
- 출력 전에 실제 개수를 세어라.

==================================================
[장면 연출 - 매우 중요]
==================================================

4컷이 전부 두 사람이 같은 배경에서 나란히 서서 말하는 장면이 되면 안 된다.

각 panel은 대사와 장소만 적지 말고 아래 시각 설계 필드를 모두 작성한다.
- shotType: wide, medium, close-up, over-the-shoulder 중 하나
- cameraAngle: 정면, 측면, 위에서, 아래에서, 대각선 등
- characterAction: 인물이 실제로 하는 행동
- visualFocus: 이 컷에서 가장 먼저 보이는 대상
- propOrObject: 의미 있는 소품 또는 없음
- setting: 구체적인 장소와 배경
- panelRole: 시작, 행동, 발견, 반응, 결과, 마무리 중 하나
- reactionBeat: 표정이나 감정 변화
- humorBeat 또는 emotionalBeat: 자연스러운 웃음/감정 포인트 또는 없음

네 컷 규칙:
- 4컷 모두 같은 two-shot 대화 구도를 사용하지 않는다.
- 최소 2종 이상의 shotType을 사용한다.
- 최소 1컷은 대화보다 행동, 소품 또는 환경이 중심이다.
- 인접한 두 컷에서 같은 인물 배치를 반복하지 않는다.

각 컷의 시각적 연출을 다양하게 한다.

예:

- 함께 걷기
- 의자에 앉아서 이야기하기
- 휴대폰 화면 보여주기
- 책이나 종이 가리키기
- 가방을 들고 이동하기
- 물건을 들여다보기
- 창밖을 바라보기
- 한 인물 표정 클로즈업
- 상대방 뒤에서 보는 오버숄더 구도
- 허리 위 구도
- 전신 구도
- 한 인물이 앞, 다른 인물이 뒤
- 행동하면서 말하기

같은 장소의 대화여도
각 컷의 카메라 거리와 행동을 바꿔라.

단, 원문에 없는 사건을 새로 만들어
내용을 왜곡하지 않는다.

==================================================
[4컷 전개 방식 다양화]
==================================================

이번 만화에 가장 어울리는 storyMode를 하나 선택한다.
가능한 방식:

- 상황 시작 → 예상 밖 반응 → 설명 또는 발견 → 재치 있는 마무리
- 질문 → 잘못된 추측 → 실제 예시 → 이해 또는 웃음
- 문제 발생 → 행동 → 결과 → 짧은 반전
- 일상 상황 → 정보 발견 → 실제 적용 → 자연스러운 결론
- 즉각적인 사건 → 리액션 → 대화 확장 → 기억에 남는 엔딩
- 이동 또는 행동 중심 → 관찰 → 대화 → 결과
- 한 인물의 오해 → 상대의 설명 → 시각적 예시 → 납득 또는 유머

내용에 맞지 않으면 억지 유머나 반전을 넣지 않는다.
4컷 모두를 두 사람이 서서 설명하는 장면으로 만들지 않는다.

==================================================
[등장인물 외형 구분 - 매우 중요]
==================================================

서로 다른 등장인물이 비슷한 복제 인간처럼 보이지 않게 한다.

특히 두 명이 모두 남학생,
또는 모두 여학생인 경우
명확하게 구별되도록 설계한다.

각 등장인물에게
다음 요소 중 최소 3개 이상 차이를 준다.

- 머리 모양
- 머리 길이
- 얼굴형
- 안경 유무
- 키
- 체형
- 상의 스타일
- 겉옷
- 가방
- 액세서리
- 전체적인 분위기

예:

민수:
짧은 검은 머리,
둥근 얼굴,
후드티,
백팩

준호:
살짝 긴 앞머리,
각진 얼굴,
안경,
맨투맨

단,
과장된 외모 묘사나 불필요한 신체 평가를 하지 않는다.

한 번 정한 외형은 4컷 내내 동일하게 유지한다.

[장면 설명 작성법]
==================================================

각 panel의 scene에는
그림 생성 AI가 이해할 수 있게
구체적으로 작성한다.

포함하면 좋은 것:

- 장소
- 누가 어디에 있는지
- 무엇을 하고 있는지
- 표정
- 손동작
- 소품
- 카메라 구도
- 이전 컷과 다른 시각적 변화

==================================================
[characters 작성법]
==================================================

각 컷의 characters에는
등장하는 인물의 외형 특징을
간결하지만 명확하게 적는다.

같은 인물은 모든 컷에서
같은 특징을 유지한다.

다른 인물은 서로 다른 외형을 가진다.

==================================================
[요약 제목]
==================================================

summary는
만화 위에 들어갈 짧은 한글 제목이다.

약 8~18자 정도.

예:
성격 유형과 직업
주말 계획 이야기
엄마와 진로 상담
좋아하는 활동 찾기

==================================================
[출력 형식]
==================================================

반드시 JSON만 출력한다.

마크다운 코드블록 금지.

형식:

{
  "title": "원 대화문 제목",
  "summary": "짧은 한글 제목",
  "visualStyle": "${requestedVisualStyle}",
  "storyMode": "선택한 전개 방식",
  "panels": [
    {
      "cut": "1컷",
      "scene": "구체적인 장면과 구도 설명",
      "characters": "등장인물 외형 특징",
      "shotType": "wide",
      "cameraAngle": "카메라 구도",
      "characterAction": "인물의 행동",
      "visualFocus": "시각적 초점",
      "propOrObject": "소품 또는 없음",
      "setting": "장소와 배경",
      "panelRole": "시작",
      "reactionBeat": "표정 또는 없음",
      "humorBeat": "유머 또는 없음",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "자연스러운 한국어 대사"
        }
      ]
    },
    {
      "cut": "2컷",
      "scene": "구체적인 장면과 구도 설명",
      "characters": "등장인물 외형 특징",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "자연스러운 한국어 대사"
        }
      ]
    },
    {
      "cut": "3컷",
      "scene": "구체적인 장면과 구도 설명",
      "characters": "등장인물 외형 특징",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "자연스러운 한국어 대사"
        }
      ]
    },
    {
      "cut": "4컷",
      "scene": "구체적인 장면과 구도 설명",
      "characters": "등장인물 외형 특징",
      "dialogue": [
        {
          "speaker": "화자",
          "text": "자연스러운 한국어 대사"
        }
      ]
    }
  ]
}

==================================================
[최종 자체 검수]
==================================================

JSON을 출력하기 전에 반드시 확인:

1. 정확히 4컷인가?
2. 원문 정보 순서가 바뀌지 않았는가?
3. 관계에 맞는 말투인가?
4. 부모/선생님/어른에게 학생이
   무조건 반말하고 있지는 않은가?
5. 영어 표현이 총 4~6개인가?
6. 영어 표현이 최소 3개 컷에 분산됐는가?
7. 모두 한글뜻(English) 형식인가?
8. 네 컷의 장면/행동/카메라 구도가
   지나치게 반복되지 않는가?
9. 서로 다른 등장인물의 외형이
   확실히 구분되는가?
10. 같은 인물의 외형은
    4컷 내내 일관적인가?

원 대화문 제목:
${title || "대화문"}

원 영어 대화문:
${content}
`,
      });

    const raw =
      response.output_text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const parsed =
      JSON.parse(raw);

    parsed.visualStyle =
      typeof parsed.visualStyle === "string"
        ? parsed.visualStyle
        : requestedVisualStyle;
    parsed.storyMode =
      typeof parsed.storyMode === "string"
        ? parsed.storyMode
        : "character dialogue";

    if (
      !parsed?.panels ||
      !Array.isArray(
        parsed.panels
      ) ||
      parsed.panels.length !== 4
    ) {
      throw new Error(
        "설계안이 정확히 4컷으로 생성되지 않았습니다."
      );
    }

    return Response.json(parsed);
  } catch (error: any) {
    console.error(
      "COMIC PLAN ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "써밋네컷 설계안 생성 중 오류가 발생했습니다.",
        detail:
          error?.message ||
          error?.error?.message ||
          "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}