export type StoryPlan = {
  id: string; englishTitle: string; koreanSubtitle: string; blockSummary: string;
  sourceRange: string; sourceText?: string; visualStyle?: string; storyMode?: string;
  keyWords: string[];
  panels: Array<{ cut: string; scene: string; characters: string;
    dialogue: Array<{ speaker: string; text: string }> }>;
};
type VocabularyLink = {
  cut: number; line: number; koreanPhrase: string; english: string;
  sourceQuote: string; partOfSpeech: string; meaning: string;
};
export type StoryReview = {
  plans: StoryPlan[];
  cast: Array<{ speaker: string; role: string; register: "polite" | "casual" }>;
  sourceChecks: Array<{ sourceQuote: string; koreanMeaning: string; cuts: number[] }>;
  vocabularyLinks: VocabularyLink[];
};
const normalized = (text: string) => text.normalize("NFKC").toLowerCase()
  .replace(/[’‘]/gu, "'").replace(/[‐‑–—]/gu, "-").replace(/\s+/gu, " ").trim();
const englishGloss = /[（(][^()（）]*[A-Za-z][^()（）]*[)）]/u;
const basic = new Set(["pencil", "pen", "book", "school", "student", "teacher", "people", "good", "bad", "food", "water", "day", "time", "happy"]);
const narration = /^(?:해설자|해설|내레이터|내레이션|나레이터|나레이션|내래이터|내래이션|narrator|narration)(?:\s*[A-Z0-9]+)?$/iu;
const professional = /해설|내레|나레|연구|과학자|전문가|선생|교사|교수|상인|점원/u;
// Unknown endings are left to the language editor; absence from a list is not an error.
const politeEnd = /(?:요|니다|니까|시오|죠)[.!?…]*$/u;
const clearCasualEnd = /(?:했어|됐어|있어|없어|할게|할래|하자|해보자|했지|했잖아|했네|했구나|한다|했다|된다|됐다|이다)[.!?…]*$/u;

export function assertPlainStory(value: unknown, expectedId: string): asserts value is StoryPlan {
  const p = value as StoryPlan;
  if (!p || p.id !== expectedId || typeof p.englishTitle !== "string" || !p.englishTitle.trim() ||
      typeof p.koreanSubtitle !== "string" || typeof p.blockSummary !== "string" || !p.blockSummary.trim() ||
      typeof p.sourceRange !== "string" || !Array.isArray(p.keyWords) || p.keyWords.length !== 0 ||
      !Array.isArray(p.panels) || p.panels.length !== 4) {
    throw new Error("한국어 이야기의 ID·제목·요약·4컷·빈 어휘 배열을 확인하세요.");
  }
  for (const [i, panel] of p.panels.entries()) {
    if (!panel || panel.cut !== `${i + 1}컷` || typeof panel.scene !== "string" || !panel.scene.trim() ||
        typeof panel.characters !== "string" || !panel.characters.trim() ||
        !Array.isArray(panel.dialogue) || panel.dialogue.length > 3 ||
        panel.dialogue.some(line => !line || typeof line.speaker !== "string" || !line.speaker.trim() ||
          typeof line.text !== "string" || !line.text.trim())) {
      throw new Error(`${i + 1}컷의 장면·인물·대사 형식을 확인하세요.`);
    }
    for (const line of panel.dialogue) {
      if (englishGloss.test(line.text) || /[A-Za-z]/u.test(line.text)) {
        throw new Error("이야기와 편집 대사는 영어 없이 완성된 한국어로만 작성하세요.");
      }
      if (/[가-힣]+다\s+(?:수\s|않|못|는\s*중|해야|해요)/u.test(line.text)) {
        throw new Error(`사전형 동사가 문장에 잘못 이어졌습니다: ${line.text}`);
      }
      if (/[()（）]/u.test(line.speaker)) throw new Error("화자 이름에 말투 메모를 넣지 마세요.");
    }
  }
}

function checkRegister(plan: StoryPlan, cast: StoryReview["cast"]): void {
  if (!Array.isArray(cast) || cast.length === 0) throw new Error("화자 역할과 말투 표가 없습니다.");
  const voices = new Map<string, StoryReview["cast"][number]>();
  for (const voice of cast) {
    if (!voice || typeof voice.speaker !== "string" || !voice.speaker.trim() || typeof voice.role !== "string" ||
        !voice.role.trim() || !["polite", "casual"].includes(voice.register) || voices.has(voice.speaker.trim())) {
      throw new Error("화자 역할·말투 표의 빈 값이나 중복을 확인하세요.");
    }
    if (professional.test(voice.role + voice.speaker) && voice.register !== "polite") {
      throw new Error("해설자·연구원·교사·상인은 존댓말을 사용해야 합니다.");
    }
    voices.set(voice.speaker.trim(), voice);
  }
  for (const panel of plan.panels) for (const line of panel.dialogue) {
    const voice = voices.get(line.speaker.trim());
    if (!voice) throw new Error(`말투 표에 없는 화자입니다: ${line.speaker}`);
    const sentences = line.text.split(/(?<=[.!?…])\s*/u).map(s => s.trim()).filter(Boolean);
    for (const sentence of sentences) {
      // Only complete declarative sentences; short questions/fragments are reviewed by the editor.
      if (!/[.!?…]$/u.test(sentence)) continue;
      const polite = politeEnd.test(sentence);
      if (voice.register === "casual" && polite) throw new Error(`친구/가족의 반말 대사에 존댓말이 섞였습니다: ${line.text}`);
      if (voice.register === "polite" && !polite && clearCasualEnd.test(sentence)) throw new Error(`존댓말 대사의 문장 끝을 확인하세요: ${line.text}`);
    }
  }
}

export function attachReviewedVocabulary(review: StoryReview, sourceText: string, expectedId: string): StoryPlan {
  if (!review || !Array.isArray(review.plans) || review.plans.length !== 1) throw new Error("편집 결과는 지문 하나여야 합니다.");
  const original = review.plans[0];
  assertPlainStory(original, expectedId);
  checkRegister(original, review.cast);
  const source = normalized(sourceText);
  if (!Array.isArray(review.sourceChecks) || review.sourceChecks.length < 2 || review.sourceChecks.length > 8) {
    throw new Error("핵심 내용의 원문 근거 2~8개가 필요합니다.");
  }
  const evidence = new Set<string>();
  for (const check of review.sourceChecks) {
    if (!check || typeof check.sourceQuote !== "string" || normalized(check.sourceQuote).length < 12 ||
        !source.includes(normalized(check.sourceQuote)) || typeof check.koreanMeaning !== "string" || !check.koreanMeaning.trim() ||
        !Array.isArray(check.cuts) || !check.cuts.length || check.cuts.some(c => !Number.isInteger(c) || c < 1 || c > 4)) {
      throw new Error("원문 근거 인용과 연결된 컷 번호를 확인하세요.");
    }
    evidence.add(normalized(check.sourceQuote));
  }
  if (evidence.size < 2) throw new Error("같은 원문 근거를 중복하지 마세요.");
  if (!Array.isArray(review.vocabularyLinks) || review.vocabularyLinks.length > 8) throw new Error("어휘 연결은 0~8개여야 합니다.");
  const plan: StoryPlan = { ...original, keyWords: [], panels: original.panels.map(panel => ({
    ...panel, dialogue: panel.dialogue.map(line => ({ ...line })),
  })) };
  const used = new Set<string>();
  const spans = new Map<string, Array<{ start: number; end: number; english: string }>>();
  for (const link of review.vocabularyLinks) {
    if (!link || !Number.isInteger(link.cut) || link.cut < 1 || link.cut > 4 ||
        !Number.isInteger(link.line) || link.line < 1 || typeof link.koreanPhrase !== "string" || !link.koreanPhrase.trim() ||
        typeof link.english !== "string" || !/^[A-Za-z][A-Za-z ’‘'‐‑–—-]*$/u.test(link.english) ||
        typeof link.sourceQuote !== "string" || typeof link.meaning !== "string" || !link.meaning.trim() ||
        !["noun", "verb", "adjective", "adverb", "phrase"].includes(link.partOfSpeech)) {
      throw new Error("어휘 연결의 컷·대사 번호·한국어 표현·영어·품사를 확인하세요.");
    }
    const english = normalized(link.english);
    if (basic.has(english) || used.has(english)) throw new Error(`기초 또는 중복 어휘입니다: ${link.english}`);
    const quote = normalized(link.sourceQuote);
    const escaped = english.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    if (quote.length < 12 || !source.includes(quote) || !new RegExp(`(?:^|[^a-z])${escaped}(?=$|[^a-z])`, "u").test(quote)) {
      throw new Error(`원문에서 정확히 확인되지 않는 영어입니다: ${link.english}`);
    }
    const line = plan.panels[link.cut - 1].dialogue[link.line - 1];
    if (!line) throw new Error("어휘가 연결된 대사가 없습니다.");
    const phrase = link.koreanPhrase;
    const start = line.text.indexOf(phrase);
    if (start < 0 || line.text.indexOf(phrase, start + 1) >= 0 || /[()（）.!?]/u.test(phrase)) {
      throw new Error(`영어를 붙일 한국어 표현은 해당 대사에 정확히 한 번 있어야 합니다: ${phrase}`);
    }
    if (link.partOfSpeech === "verb") {
      // Do not guess Korean conjugation from a suffix allowlist: 해보자/하렴/했네 etc. are valid.
      // Reject only a copied dictionary form, or the bare noun from an explicit 하다 gloss.
      const dictionaryForms = link.meaning.match(/[가-힣]+다(?=$|[\s,/·;])/gu) || [];
      const copiedDictionary = dictionaryForms.some(form => phrase.endsWith(form));
      const bareActionNoun = dictionaryForms.some(form => form.endsWith("하다") &&
        form.length > 2 && phrase.endsWith(form.slice(0, -2)));
      if (copiedDictionary || bareActionNoun) {
        throw new Error(`동사는 명사나 사전형 대신 활용된 한국어 표현에 연결하세요: ${phrase}`);
      }
    }
    const key = `${link.cut}:${link.line}`;
    const parts = spans.get(key) || [];
    const end = start + phrase.length;
    if (parts.some(part => start < part.end && end > part.start)) throw new Error("서로 겹치는 표현에 영어를 붙일 수 없습니다.");
    parts.push({ start, end, english: link.english.trim() }); spans.set(key, parts);
    used.add(english); plan.keyWords.push(`${link.meaning.trim()}(${link.english.trim()})`);
  }
  for (const [key, parts] of spans) {
    const [cut, index] = key.split(":").map(Number);
    const line = plan.panels[cut - 1].dialogue[index - 1];
    // Insert from right to left; never rewrite a Korean character or punctuation.
    for (const part of parts.sort((a, b) => b.end - a.end)) {
      line.text = line.text.slice(0, part.end) + `(${part.english})` + line.text.slice(part.end);
    }
  }
  return plan;
}
