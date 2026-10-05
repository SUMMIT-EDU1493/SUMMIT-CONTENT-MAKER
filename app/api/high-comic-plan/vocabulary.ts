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
  const expression = /([가-힣]+)다\(([A-Za-z][^()\n]*)\)/g;
  return text.replace(expression, (whole, stem: string, english: string, offset: number) => {
    const after = text.slice(offset + whole.length);
    if (/^(?:가|를|은|도|만|에|랑|이랑)(?=\s|[,.!?]|$)/u.test(after) ||
        /^\s+(?:힘들|어렵|쉽|중요|필요)/u.test(after)) {
      return `${stem}기(${english})`;
    }
    return whole;
  });
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
    dialogue: (panel.dialogue || []).map(line => ({ ...line, text: stripRepeated(normalizeVocabularyDialogue(line.text)) })),
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
