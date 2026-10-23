/** Subdivide a textbook passage without changing any source character or order. */
export type ComicSourceSection = { text: string; label: string };

type Heading = { offset: number; end: number; label: string };

function questionHeadings(source: string): Heading[] {
  const headings: Heading[] = [];
  const pattern = /(?:^|[\s《〈【\[「])Q\s*[:：]\s*(?=[A-Za-z])/gu;
  for (const match of source.matchAll(pattern)) {
    const qOffset = match.index! + match[0].indexOf("Q");
    const offset = qOffset > 0 && /[《〈【\[「]/u.test(source[qOffset - 1]) ? qOffset - 1 : qOffset;
    const rest = source.slice(qOffset, qOffset + 1800);
    const questionEnd = rest.indexOf("?");
    // A textbook Q heading must have a question mark and an explicit answer.
    if (questionEnd < 0 || questionEnd > 1000) continue;
    const after = rest.slice(questionEnd + 1);
    const answer = /(?:^|[\s》〉】\]」])A\s*[:：]/u.exec(after);
    if (!answer || answer.index > 700) continue;
    headings.push({
      offset,
      end: qOffset + questionEnd + 1,
      label: rest.slice(0, questionEnd + 1).replace(/\s+/gu, " ").trim(),
    });
  }
  return headings;
}

export function splitComicSourceBySubtitles(
  source: string,
  extraOffsets: number[] = [],
): ComicSourceSection[] {
  const questions = questionHeadings(source);
  const cuts = new Map<number, string>();
  // Keep a passage introduction with its first question; split at later Q headings.
  questions.slice(1).forEach(heading => cuts.set(heading.offset, heading.label));
  for (const offset of extraOffsets) {
    if (!Number.isInteger(offset) || offset <= 0 || offset >= source.length) {
      throw new Error("소제목 시작 위치가 원문 범위를 벗어났습니다.");
    }
    const heading = questions.find(item => offset >= item.offset && offset <= item.end);
    if (heading) {
      if (heading !== questions[0]) cuts.set(heading.offset, heading.label);
      continue;
    }
    cuts.set(offset, "");
  }
  const starts = [0, ...Array.from(cuts.keys()).sort((a, b) => a - b)];
  const sections = starts.map((start, index) => ({
    text: source.slice(start, starts[index + 1] ?? source.length),
    label: index === 0 ? questions[0]?.label ?? "" : cuts.get(start) ?? "",
  }));
  if (sections.some(section => !section.text.trim()) ||
      sections.map(section => section.text).join("") !== source) {
    throw new Error("소제목별 원문 분리 중 누락 또는 중복이 발생했습니다.");
  }
  return sections;
}
