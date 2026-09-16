export type DialogueCandidateResult = {
  candidateText: string;
  candidateBlocks: number;
  rawCandidateChars: number;
  deduplicatedCandidateChars: number;
  candidateBlocksBeforeDedupe: number;
  candidateBlocksAfterDedupe: number;
  fallbackReason: string;
  confidence: number;
  useFallback: boolean;
  debug: {
    totalLines: number;
    nonEmptyLines: number;
    averageLineLength: number;
    maxLineLength: number;
    shortLines: number;
    speakerPatternLines: number;
    questionLines: number;
    keywordHits: number;
    separators: number;
  };
};

type ScoredBlock = {
  start: number;
  end: number;
  score: number;
  reason: string;
};

const PAGE_MARKER = /---\s*\d+\s*페이지\s*---/gi;
const ACTIVITY_SIGNAL =
  /\b(listen(?:\s+and)?\s+(?:talk|speak|write)|speak|conversation|dialogue|dialog|role[- ]?play|pair work|real life talk)\b|대화|회화|말하기/gi;
const SPEAKER_LABEL_SIGNAL =
  /(?:^|[\s|])(?:[A-Z][A-Za-z]{0,14}|[가-힣]{1,8}|학생|선생님|남자|여자)\s*:\s*/;
const SPEAKER_LABEL_GLOBAL_SIGNAL =
  /(?:^|[\s|])(?:[A-Z][A-Za-z]{0,14}|[가-힣]{1,8}|학생|선생님|남자|여자)\s*:\s*/g;
const QUOTE_SIGNAL = /["“”]/g;
const QUESTION_SIGNAL = /\?/g;
const SHORT_SENTENCE_SIGNAL = /[^.!?]{8,90}[.!?]/g;
const SENTENCE_SIGNAL = /[^.!?]+[.!?]+|[^.!?]+$/g;

function normalizeBlock(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function scoreText(text: string) {
  const activityHits = text.match(ACTIVITY_SIGNAL)?.length ?? 0;
  const speakerHits = text.match(SPEAKER_LABEL_GLOBAL_SIGNAL)?.length ?? 0;
  const quoteHits = text.match(QUOTE_SIGNAL)?.length ?? 0;
  const questionHits = text.match(QUESTION_SIGNAL)?.length ?? 0;
  const shortSentenceHits = text.match(SHORT_SENTENCE_SIGNAL)?.length ?? 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const firstPersonHits =
    text.match(/\b(?:I|I'm|I've|I'll|you|your|we|our|my|me)\b/gi)?.length ?? 0;
  const sentenceCount = text.match(SENTENCE_SIGNAL)?.length ?? 0;

  let score = 0;
  if (activityHits > 0) score += 3;
  if (speakerHits >= 2) score += 4;
  if (quoteHits >= 2) score += 2;
  if (questionHits >= 1 && shortSentenceHits >= 2) score += 2;
  if (shortSentenceHits >= 4 && wordCount <= 180) score += 1;
  if (firstPersonHits >= 3 && sentenceCount >= 3) score += 1;
  if (wordCount >= 12 && wordCount <= 260) score += 1;

  const reason = [
    activityHits > 0 ? "keyword" : "",
    speakerHits >= 2 ? "speaker" : "",
    quoteHits >= 2 ? "quote" : "",
    questionHits >= 1 ? "question" : "",
    firstPersonHits >= 3 ? "pronoun" : "",
  ]
    .filter(Boolean)
    .join(",");

  return { score, reason };
}

function getSentenceRanges(text: string, offset: number) {
  const ranges: Array<{ start: number; end: number }> = [];
  const sentencePattern = new RegExp(SENTENCE_SIGNAL.source, "g");
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(text)) !== null) {
    if (match[0].trim().length > 0) {
      ranges.push({
        start: offset + match.index,
        end: offset + match.index + match[0].length,
      });
    }
  }

  return ranges;
}

function getDebugStats(text: string, separators: number) {
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const lengths = nonEmptyLines.map((line) => line.trim().length);

  return {
    totalLines: lines.length,
    nonEmptyLines: nonEmptyLines.length,
    averageLineLength:
      lengths.length > 0
        ? Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length)
        : 0,
    maxLineLength: Math.max(0, ...lengths),
    shortLines: nonEmptyLines.filter((line) => line.trim().length < 40).length,
    speakerPatternLines: nonEmptyLines.filter((line) =>
      SPEAKER_LABEL_SIGNAL.test(line)
    ).length,
    questionLines: nonEmptyLines.filter((line) => line.includes("?")).length,
    keywordHits: text.match(ACTIVITY_SIGNAL)?.length ?? 0,
    separators,
  };
}

export function extractDialogueCandidates(
  text: string
): DialogueCandidateResult {
  const originalText = text.trim();
  const separators = originalText.match(PAGE_MARKER)?.length ?? 0;
  const debug = getDebugStats(originalText, separators);
  const pageParts = originalText
    .split(PAGE_MARKER)
    .map((part) => normalizeBlock(part))
    .filter((part) => part.length > 0);

  if (pageParts.length === 0) {
    return {
      candidateText: originalText,
      candidateBlocks: 0,
      rawCandidateChars: 0,
      deduplicatedCandidateChars: 0,
      candidateBlocksBeforeDedupe: 0,
      candidateBlocksAfterDedupe: 0,
      fallbackReason: "no candidates",
      confidence: 0,
      useFallback: true,
      debug,
    };
  }

  const pageRanges: Array<{ start: number; end: number }> = [];
  let pageSearchStart = 0;
  let pagePartsWithOffsets: Array<{ text: string; start: number; end: number }> = [];
  const pageMarkerPattern = new RegExp(PAGE_MARKER.source, "gi");
  let pageMarker: RegExpExecArray | null;
  const markerRanges: Array<{ start: number; end: number }> = [];

  while ((pageMarker = pageMarkerPattern.exec(originalText)) !== null) {
    markerRanges.push({
      start: pageMarker.index,
      end: pageMarker.index + pageMarker[0].length,
    });
  }

  const boundaries = [
    0,
    ...markerRanges.map((range) => range.end),
    originalText.length,
  ];
  pagePartsWithOffsets = boundaries
    .slice(0, -1)
    .map((start, index) => ({
      text: originalText.slice(start, boundaries[index + 1]),
      start,
      end: boundaries[index + 1],
    }))
    .filter((page) => page.text.trim().length > 0);

  const rawCandidates: ScoredBlock[] = pagePartsWithOffsets.flatMap((page) => {
    const sentences = getSentenceRanges(page.text, page.start);
    const pageScore = scoreText(normalizeBlock(page.text));
    const candidates: ScoredBlock[] = [];

    if (page.text.length <= 6000 && pageScore.score >= 8) {
      candidates.push({
        start: page.start,
        end: page.end,
        score: pageScore.score,
        reason: `page:${pageScore.reason}`,
      });
      return candidates;
    }

    sentences.forEach((sentence, index) => {
      const sentenceText = originalText.slice(sentence.start, sentence.end);
      const signal =
        ACTIVITY_SIGNAL.test(sentenceText) ||
        SPEAKER_LABEL_SIGNAL.test(sentenceText) ||
        QUESTION_SIGNAL.test(sentenceText) ||
        QUOTE_SIGNAL.test(sentenceText);

      ACTIVITY_SIGNAL.lastIndex = 0;
      SPEAKER_LABEL_SIGNAL.lastIndex = 0;
      QUESTION_SIGNAL.lastIndex = 0;
      QUOTE_SIGNAL.lastIndex = 0;

      if (!signal) return;

      const startSentence = Math.max(0, index - 2);
      const endSentence = Math.min(sentences.length - 1, index + 2);
      const start = sentences[startSentence].start;
      const end = sentences[endSentence].end;
      const text = normalizeBlock(originalText.slice(start, end));
      const scored = scoreText(text);

      if (text.length >= 80 && scored.score >= 3) {
        candidates.push({
          start,
          end,
          score: scored.score,
          reason: scored.reason || "sentence-signal",
        });
      }
    });

    return candidates;
  });

  const sortedCandidates = rawCandidates.sort((left, right) => right.score - left.score);
  const selectedCandidates: ScoredBlock[] = [];
  const selectedPages = new Set<number>();

  for (const candidate of sortedCandidates) {
    const overlaps = selectedCandidates.some(
      (selected) => candidate.start < selected.end && selected.start < candidate.end
    );
    if (overlaps) continue;

    const pageIndex = pagePartsWithOffsets.findIndex(
      (page) => candidate.start >= page.start && candidate.start < page.end
    );
    if (pageIndex >= 0 && selectedPages.has(pageIndex) && selectedCandidates.length >= 6) {
      continue;
    }

    selectedCandidates.push(candidate);
    if (pageIndex >= 0) selectedPages.add(pageIndex);
    if (selectedCandidates.length >= 12) break;
  }

  selectedCandidates.sort((left, right) => left.start - right.start);
  const rawCandidateChars = rawCandidates.reduce(
    (sum, candidate) => sum + candidate.end - candidate.start,
    0
  );
  const candidateText = selectedCandidates
    .map((candidate, index) => `--- 후보 블록 ${index + 1} ---\n${originalText.slice(candidate.start, candidate.end).trim()}`)
    .join("\n\n");

  const candidateChars = candidateText.length;
  const reduction =
    originalText.length > 0
      ? 1 - candidateChars / originalText.length
      : 0;
  const averageScore =
    selectedCandidates.length > 0
      ? selectedCandidates.reduce((sum, block) => sum + block.score, 0) /
        selectedCandidates.length
      : 0;
  const confidence =
    selectedCandidates.length === 0
      ? 0
      : Math.min(1, 0.35 + Math.min(0.5, averageScore / 20) + (separators > 0 ? 0.1 : 0));

  let fallbackReason = "";
  if (selectedCandidates.length === 0) fallbackReason = "no candidates";
  else if (candidateChars < 400) fallbackReason = "candidate chars too small";
  else if (reduction < 0.2) fallbackReason = "reduction below threshold";
  else if (confidence < 0.65) fallbackReason = "low confidence";

  const useFallback = Boolean(fallbackReason) ||
    candidateChars < 400 ||
    reduction < 0.2 ||
    confidence < 0.65;

  return {
    candidateText: useFallback ? originalText : candidateText,
    candidateBlocks: selectedCandidates.length,
    rawCandidateChars,
    deduplicatedCandidateChars: candidateChars,
    candidateBlocksBeforeDedupe: rawCandidates.length,
    candidateBlocksAfterDedupe: selectedCandidates.length,
    fallbackReason: useFallback ? fallbackReason : "none",
    confidence: selectedCandidates.length === 0 ? 0 : confidence,
    useFallback,
    debug,
  };
}
