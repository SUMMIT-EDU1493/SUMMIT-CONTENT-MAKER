type VocabularyPlan = {
  keyWords?: string[];
  panels?: Array<{
    scene: string;
    characters: string;
    dialogue: Array<{ speaker: string; text: string }>;
  }>;
};

const englishKey = (text: string) => text.normalize("NFKC").toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim();
const isEnglish = (text: string) => /[a-z]/i.test(text) && !/[가-힣]/.test(text);


// A particle after "한글(English)" must agree with the Korean word, not the English gloss.
const hasFinalConsonant = (char: string): number => {
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : 0;
};
export function fixGlossParticles(text: string): string {
  return text.replace(/([가-힣])(\([A-Za-z][^()\n]*\))(을|를|이|가|은|는|과|와|으로|로)(?=\s|[,.!?~]|$)/gu,
    (_whole, last: string, gloss: string, particle: string) => {
      const final = hasFinalConsonant(last);
      const pick = (withFinal: string, without: string) => (final ? withFinal : without);
      const fixed = particle === "을" || particle === "를" ? pick("을", "를")
        : particle === "이" || particle === "가" ? pick("이", "가")
        : particle === "은" || particle === "는" ? pick("은", "는")
        : particle === "과" || particle === "와" ? pick("과", "와")
        : final && final !== 8 ? "으로" : "로";
      return `${last}${gloss}${fixed}`;
    });
}

// Conjugate a verb stem to its -아/어 form (나타내 → 나타내, 바꾸 → 바꿔, 억누르 → 억눌러, 잡 → 잡아).
// Returns "" when the stem is irregular or unclear, so callers leave the text for the model to fix.
const jamo = (char: string) => {
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? { initial: Math.floor(code / 588), vowel: Math.floor((code % 588) / 28), final: code % 28 } : null;
};
const syllable = (initial: number, vowel: number, final = 0) => String.fromCharCode(0xac00 + initial * 588 + vowel * 28 + final);
export function conjugateAeo(stem: string): string {
  const last = stem.slice(-1), head = stem.slice(0, -1), j = jamo(last);
  if (!j) return "";
  if (last === "하") return head + "해";
  if (last === "르" && head) {
    const p = jamo(head.slice(-1));
    if (!p || p.final) return "";
    const bright = p.vowel === 0 || p.vowel === 8; // ㅏ, ㅗ
    return head.slice(0, -1) + syllable(p.initial, p.vowel, 8) + (bright ? "라" : "러");
  }
  if (j.final) {
    // ㄷ, ㅂ, ㅅ, ㅎ stems are often irregular (듣다, 돕다, 낫다, 그렇다).
    if ([7, 17, 19, 27].includes(j.final)) return "";
    return stem + (j.vowel === 0 || j.vowel === 8 ? "아" : "어");
  }
  // ㅏ ㅐ ㅓ ㅔ ㅕ ㅖ ㅙ ㅚ stay; ㅗ→ㅘ, ㅜ→ㅝ, ㅡ→ㅓ, ㅣ→ㅕ.
  if ([0, 1, 4, 5, 6, 7, 10, 11].includes(j.vowel)) return stem;
  const merged: Record<number, number> = { 8: 9, 13: 14, 18: 4, 20: 6 };
  return merged[j.vowel] !== undefined ? head + syllable(j.initial, merged[j.vowel]) : "";
}

// "나타내다(manifest)보자", "억누르다(suppress)기만" — a dictionary form glued to more Korean.
// Nouns ending in 다 with a particle (바다(ocean)는) and quotations (~다(attract)라니) are fine.
const BROKEN_DICTIONARY_GLOSS = /[가-힣]다\s*\([A-Za-z][^()\n]*\)(?!(?:은|는|이|가|을|를|도|만|에|에서|로|으로|와|과|랑|의|처럼|보다|라니|라고|라는|라면|고\s|며|지만|니까|면|\s*[.,!?~]|\s|$))[가-힣]/u;
export function hasBrokenDictionaryGloss(text: string): boolean {
  return BROKEN_DICTIONARY_GLOSS.test(text);
}

// Last-resort repair when the model keeps a dictionary form: "(상상하다(imagine))" → "상상(imagine)".
export function fallbackVerbGloss(text: string): string {
  return text
    .replace(/\(([가-힣]{1,12})\(([A-Za-z][^()\n]*)\)\)/gu, "")
    .replace(/([가-힣]{2,})하다\(([A-Za-z][^()\n]*)\)\s*(않|못)/gu, "$1하지($2) $3")
    // "일자리를 잃다(displace)던" → "일자리를 잃던(displace)"
    .replace(/([가-힣])다\(([A-Za-z][^()\n]*)\)(던|는|은|ㄴ)(?=\s)/gu, "$1$3($2)")
    .replace(/([가-힣]{2,})하다\(([A-Za-z][^()\n]*)\)/gu, "$1($2)")
    // "억누르다(suppress)기만" → "억누르기(suppress)만"
    .replace(/([가-힣])다\(([A-Za-z][^()\n]*)\)기/gu, "$1기($2)")
    // "나타내다(manifest)보자" → "나타내(manifest) 보자", "바꾸다(change)야 해" → "바꿔(change)야 해"
    .replace(/([가-힣]+)다\(([A-Za-z][^()\n]*)\)\s?(보|봐|볼|줘|주|줄|야|서|도)/gu,
      (whole, stem: string, english: string, next: string) => {
        const form = conjugateAeo(stem);
        if (!form) return whole;
        const spaced = /^[보봐볼줘주줄]/u.test(next) ? " " : "";
        return `${form}(${english})${spaced}${next}`;
      });
}

// Repair broken glosses: "진화(evolve해)" → "진화(evolve)해", "공간(commercial space) commercial space" → "공간(commercial space)".
export function tidyGloss(text: string): string {
  return text
    .replace(/\(([A-Za-z][A-Za-z' -]*?)\s*([가-힣]+)\)/gu, "($1)$2")
    .replace(/\(([A-Za-z][^()\n]*)\)\s*\1(?![A-Za-z])/gu, "($1)");
}

// Put a gloss right after a Sino-Korean stem: 분류하세요(categorize) → 분류(categorize)하세요.
const VERB_SYLLABLES = "하해했할한합되돼됐된될됩";
export function moveVerbGloss(text: string): string {
  return text.replace(new RegExp(`(?<![가-힣])([가-힣]{2,}?)([${VERB_SYLLABLES}][가-힣]*(?: (?:해|해요|돼|돼요|봐|봐요|보세요|있어|있어요|주세요|줘))?)\\(([A-Za-z][^()\\n]*)\\)`, "gu"),
    (_whole, stem: string, rest: string, english: string) => `${stem}(${english})${rest}`);
}

// Apply only unambiguous nominal uses; do not conjugate arbitrary Korean sentences.
export function normalizeVocabularyDialogue(text: string): string {
  // Fix explicit duplicated 하다 + inflection without guessing arbitrary verb stems.
  const repaired = fixGlossParticles(text).replace(/([가-힣]+)하다\(([A-Za-z][^()\n]*)\)(돼요|돼|되어|되면|되는|되고|됐다|됩니다|해요|해!|해\?|해야|해서|해도|했어요|했다|하는|하고|하면|하니까|하니|는|고|면)/gu,
    (_whole, root: string, english: string, ending: string) => {
      const form = ending === "는" ? "하는" : ending === "고" ? "하고" : ending === "면" ? "하면" : ending;
      // Punctuation belongs after the English gloss.
      const punctuation = /[!?]$/.test(form) ? form.slice(-1) : "";
      const inflection = punctuation ? form.slice(0, -1) : form;
      return `${root}${inflection}(${english})${punctuation}`;
    });
  const expression = /([가-힣]+)다\(([A-Za-z][^()\n]*)\)/g;
  return repaired.replace(expression, (whole, stem: string, english: string, offset: number) => {
    const after = repaired.slice(offset + whole.length);
    if (/^(?:가|를|은|도|만|에|랑|이랑)(?=\s|[,.!?]|$)/u.test(after) ||
        /^\s+(?:힘들|어렵|쉽|중요|필요)/u.test(after)) {
      return `${stem}기(${english})`;
    }
    return whole;
  });
}

// Only inspect dialogue: dictionary forms in keyWords are deliberately allowed.
export function findUninflectedVocabularyDialogue(plan: VocabularyPlan): string[] {
  return (plan.panels || []).flatMap(panel => (panel.dialogue || [])
    .map(line => line.text)
    .filter(text => /[가-힣]+하다\s*\([A-Za-z][^()\n]*\)/u.test(text) ||
      // Reject dictionary forms before negation or duplicated endings, not every 다-ending.
      // Natural completed forms and nouns such as 바다(ocean)는 must remain valid.
      /[가-힣]+다\s*\([A-Za-z][^()\n]*\)\s*(?:않|못|해야|해요|하는|하고|하면|는\s*중)/u.test(text) ||
      hasBrokenDictionaryGloss(fallbackVerbGloss(text))));
}

// A small explicit exclusion list, not a CEFR classifier. Contextual idioms stay allowed.
const basicVocabulary = new Set([
  "pencil", "pen", "book", "school", "student", "teacher", "people",
  "good", "bad", "food", "water", "day", "time", "happy",
]);

export function findVocabularyDialogueIssues(plan: VocabularyPlan): string[] {
  // Inspect before English deduplication so a repeated gloss cannot hide an error.
  const inspected = { ...plan, panels: (plan.panels || []).map(panel => ({
    ...panel, dialogue: (panel.dialogue || []).map(line => ({
      ...line, text: normalizeVocabularyDialogue(line.text),
    })),
  })) };
  const issues = findUninflectedVocabularyDialogue(inspected)
    .map(text => `동사 활용 오류: ${text}`);
  const texts = (inspected.panels || []).flatMap(panel => panel.dialogue.map(line => line.text));
  for (const text of texts) {
    for (const match of text.matchAll(/\(([^()]*)\)/gu)) {
      if (isEnglish(match[1]) && basicVocabulary.has(englishKey(match[1]))) {
        issues.push(`기초 단어 영어 병기 제외: ${match[1]} — ${text}`);
      }
    }
    if (/(?:^|[\s,.!?])(?:난|나는|나도|내가|내)\s/u.test(text) &&
        /(?:어요|아요|예요|이에요|거예요|습니다|합니다)[.!?]?$/u.test(text.replace(/\([^()]*\)/gu, "").trim())) {
      issues.push(`인칭과 말투 확인: ${text}`);
    }
  }
  for (const word of plan.keyWords || []) {
    const english = word.match(/\(([^()]*)\)/u)?.[1] || word;
    if (basicVocabulary.has(englishKey(english))) issues.push(`핵심 어휘의 기초 단어 제외: ${word}`);
  }
  return [...new Set(issues)];
}

// Speech-register notes are editor metadata, never part of a character's name.
export function cleanVocabularySpeaker(speaker: string): string {
  return speaker.replace(/\s*[（(]\s*(?:존댓말|존대말|존대|반말|존댓말\s*사용|반말\s*사용)\s*[)）]/gu, "").trim();
}

// Never mutate saved plans. A separate call resets vocabulary for each comic.
export function deduplicateHighVocabulary<T extends VocabularyPlan>(plan: T): T {
  const displayed = new Set<string>();
  const stripRepeated = (text: string) => text.replace(/\(([^()]*)\)/g, (whole, english: string) => {
    if (!isEnglish(english)) return whole;
    const key = englishKey(english);
    if (displayed.has(key)) return ""; // Keep the preceding Korean meaning.
    displayed.add(key);
    return whole;
  });
  const panels = (plan.panels || []).map(panel => ({
    ...panel,
    dialogue: (panel.dialogue || []).map(line => ({ ...line, text: stripRepeated(line.text) })),
  }));
  // Dialogue gets priority; scene notes cannot reintroduce printed duplicates.
  for (const panel of panels) {
    panel.scene = stripRepeated(panel.scene);
    panel.characters = stripRepeated(panel.characters);
  }
  const listed = new Set<string>();
  const keyWords = (plan.keyWords || []).filter(word => {
    const english = word.match(/\(([^()]*)\)/)?.[1] || word;
    const key = englishKey(english);
    if (listed.has(key)) return false;
    listed.add(key);
    return true;
  });
  return { ...plan, panels, keyWords } as T;
}

// Source-restricted gloss cleanup. Keep Korean wording when a gloss is too basic or absent.
const excludedGlosses = new Set([
  ...basicVocabulary, "dream", "dreams", "brain", "brains", "information", "travel", "travels",
  "think", "learn", "make", "see", "move", "sleep", "read", "write", "like", "love", "want",
  "go", "come", "get", "give", "take", "know", "say", "tell", "help", "use", "work",
  "child", "children", "man", "woman", "boy", "girl", "friend", "family", "house", "home",
  "dog", "cat", "cake", "hat", "foot", "feet", "hand", "eye", "ear", "mouth", "body",
  "happy", "sad", "big", "small", "fast", "slow", "new", "old", "life", "world", "book", "books",
  "light", "history", "culture", "music", "star", "stars", "sky", "sun", "moon", "picture", "pictures",
  "game", "games", "money", "city", "country", "animal", "animals", "story", "idea", "question",
  "answer", "problem", "place", "way", "thing", "things", "number", "photo", "photos", "camera",
  "past", "language", "decision",
]);
const wordForms = (word: string): string[] => {
  const result = [word];
  if (/ies$/.test(word)) result.push(word.slice(0, -3) + "y");
  if (/s$/.test(word) && !/ss$/.test(word)) result.push(word.slice(0, -1));
  if (/es$/.test(word)) result.push(word.slice(0, -2));
  if (/ing$/.test(word)) result.push(word.slice(0, -3), word.slice(0, -3) + "e");
  if (/ed$/.test(word)) result.push(word.slice(0, -2), word.slice(0, -1));
  return result;
};
export function cleanSourceVocabulary<T extends VocabularyPlan>(plan: T, source: string): T {
  const tokens = Array.from(englishKey(source).matchAll(/[a-z]+(?:'[a-z]+)?/g), m => m[0]);
  const allowed = new Set(tokens.flatMap(wordForms));
  const allowedGloss = (english: string): boolean => {
    // Names (Betelgeuse, Henry) are not vocabulary; acronyms such as DNA stay allowed.
    if (/^[A-Z][a-z]/.test(english.trim())) return false;
    const key = englishKey(english);
    if (excludedGlosses.has(key)) return false;
    const words = key.match(/[a-z]+(?:'[a-z]+)?/g) || [];
    if (!words.length) return false;
    if (words.length === 1) return wordForms(words[0]).some(form => allowed.has(form));
    // A phrase must occur in source order; allow inflection of its component words.
    return tokens.some((_token, i) => words.every((word, j) =>
      tokens[i + j] !== undefined && wordForms(word).some(form => wordForms(tokens[i + j]).includes(form))));
  };
  // "지능 intelligence" → "지능(intelligence)" when the English word is a real source word.
  const wrapLooseEnglish = (text: string) => text.replace(/([가-힣]+) ([a-z][a-z-]{2,}(?: [a-z][a-z-]+){0,2})(?=[\s,.!?가-힣]|$)/g,
    (whole, korean: string, phrase: string) => {
      const words = phrase.split(" ");
      for (let n = words.length; n > 0; n--) {
        const english = words.slice(0, n).join(" ");
        if (allowedGloss(english)) {
          const rest = words.slice(n).join(" ");
          return `${korean}(${english})${rest ? ` ${rest}` : ""}`;
        }
      }
      return whole;
    });
  const clean = (text: string) => wrapLooseEnglish(text).replace(/\(([^()]*)\)/g, (whole, english: string) =>
    isEnglish(english) && !allowedGloss(english) ? "" : whole);
  const panels = (plan.panels || []).map(panel => ({
    ...panel, scene: clean(panel.scene), characters: clean(panel.characters),
    dialogue: (panel.dialogue || []).map(line => ({ ...line,
      text: fixGlossParticles(clean(fixGlossParticles(moveVerbGloss(fallbackVerbGloss(normalizeVocabularyDialogue(tidyGloss(line.text))))))),
    })),
  }));
  // Key words are nouns on the card: "인식하다(recognize)" → "인식(recognize)".
  const keyWords = (plan.keyWords || []).map(word => word.replace(/^([가-힣]{2,})(?:하다|되다|시키다)(?=\()/u, "$1")).filter(word => {
    const english = word.match(/\(([^()]*)\)/)?.[1] || word;
    return allowedGloss(english);
  });
  return deduplicateHighVocabulary(capKeyWords({ ...plan, panels, keyWords } as T));
}

// Five key words at most. Words actually glossed in the dialogue are kept first; the glosses of
// dropped words are removed from the dialogue so the cards and the speech bubbles agree.
const MAX_KEY_WORDS = 5;
export function capKeyWords<T extends VocabularyPlan>(plan: T): T {
  const words = plan.keyWords || [];
  if (words.length <= MAX_KEY_WORDS) return plan;
  const english = (word: string) => englishKey(word.match(/\(([^()]*)\)/u)?.[1] || word);
  const spoken = new Set((plan.panels || []).flatMap(panel => (panel.dialogue || [])
    .flatMap(line => Array.from(line.text.matchAll(/\(([^()]*)\)/gu), m => englishKey(m[1])))));
  const ranked = [...words.filter(w => spoken.has(english(w))), ...words.filter(w => !spoken.has(english(w)))];
  const kept = ranked.slice(0, MAX_KEY_WORDS);
  const dropped = new Set(ranked.slice(MAX_KEY_WORDS).map(english));
  const strip = (text: string) => text.replace(/\(([^()]*)\)/gu, (whole, inner: string) =>
    isEnglish(inner) && dropped.has(englishKey(inner)) ? "" : whole);
  const panels = (plan.panels || []).map(panel => ({ ...panel,
    dialogue: (panel.dialogue || []).map(line => ({ ...line, text: fixGlossParticles(strip(line.text)) })) }));
  return { ...plan, panels, keyWords: words.filter(w => kept.includes(w)) } as T;
}
