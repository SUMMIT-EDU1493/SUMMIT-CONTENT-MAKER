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


// Apply only unambiguous nominal uses; do not conjugate arbitrary Korean sentences.
export function normalizeVocabularyDialogue(text: string): string {
  // Fix explicit duplicated 하다 + inflection without guessing arbitrary verb stems.
  const repaired = text.replace(/([가-힣]+)하다\(([A-Za-z][^()\n]*)\)(해요|해!|해\?|해야|해서|해도|했어요|했다|하는|하고|하면|하니까|하니|는|고|면)/gu,
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
    .filter(text => /[가-힣]+하다\s*\([A-Za-z][^()\n]*\)/u.test(text)));
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
    dialogue: (panel.dialogue || []).map(line => ({ ...line, speaker: cleanVocabularySpeaker(line.speaker), text: stripRepeated(normalizeVocabularyDialogue(line.text)) })),
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
