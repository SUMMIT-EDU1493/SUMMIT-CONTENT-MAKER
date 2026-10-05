export type SourceSection = { text: string; label?: string };

// Keep original offsets and source order. Never treat a sentence number as a question.
export function partitionSourceSections(source: string): SourceSection[] {
  const pages = Array.from(source.matchAll(/^---\s*(\d+)페이지\s*---[ \t]*$/gm));
  const pageSpans = pages.length ? pages.map((page, i) => ({
    start: page.index!, end: pages[i + 1]?.index ?? source.length,
    number: Number(page[1]),
  })) : [{ start: 0, end: source.length, number: 0 }];
  const anchors: Array<{ offset: number; label: string; signature: string }> = [];
  for (const page of pageSpans) {
    const text = source.slice(page.start, page.end);
    const headers = Array.from(text.matchAll(/^[ \t]*(\d{1,3})[ \t]*번[ \t]+([^\n]*[A-Za-z][^\n]*)/gm));
    let first = true;
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const afterHeader = text.slice(header.index! + header[0].length, headers[i + 1]?.index ?? text.length);
      // Analysis sheets have this explicit reading-area label; 01/02 sentence labels do not.
      if (!/지\s*문\s*읽\s*기/u.test(afterHeader.slice(0, 1500))) continue;
      const signature = `${header[1]}:${header[2].replace(/\s+/g, " ").trim()}`;
      const previous = anchors[anchors.length - 1];
      // Repeated heading on a continuation page belongs to the same passage.
      if (pages.length && first && previous?.signature === signature) { first = false; continue; }
      anchors.push({
        offset: pages.length && first ? page.start : page.start + header.index!,
        label: `${page.number ? `${page.number}페이지 · ` : ""}${header[1]}번 지문`,
        signature,
      });
      first = false;
    }
  }
  if (!anchors.length) return [{ text: source }];
  const sections: SourceSection[] = [];
  if (anchors[0].offset > 0) sections.push({ text: source.slice(0, anchors[0].offset) });
  anchors.forEach((anchor, i) => sections.push({
    text: source.slice(anchor.offset, anchors[i + 1]?.offset ?? source.length),
    label: anchor.label,
  }));
  if (sections.map(section => section.text).join("") !== source) {
    throw new Error("원문 분리 과정에서 누락 또는 중복이 발생했습니다.");
  }
  return sections;
}
