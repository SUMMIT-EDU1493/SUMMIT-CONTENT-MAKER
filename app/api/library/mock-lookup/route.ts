import { findMockItems, type MockInfo } from "@/lib/library";
import { bad, guarded } from "../guard";

export const runtime = "nodejs";

const validMock = (value: unknown): value is MockInfo => {
  const mock = value as MockInfo;
  return Boolean(mock) && /^고[123]$/.test(String(mock.grade)) && Number.isInteger(mock.year) && mock.year >= 2000 &&
    Number.isInteger(mock.month) && mock.month >= 1 && mock.month <= 12 &&
    Number.isInteger(mock.number) && mock.number >= 1 && mock.number <= 45;
};

/** Which of these mock-exam passages are already in the library (checked by question and by text). */
export async function POST(request: Request) {
  return guarded(async () => {
    const body = await request.json().catch(() => ({}));
    const entries = Array.isArray(body?.entries) ? body.entries : null;
    if (!entries || entries.length > 60 ||
        entries.some((entry: any) => !validMock(entry?.mock) || typeof entry?.text !== "string")) {
      return bad("찾을 지문 정보를 확인해 주세요.");
    }
    const results = await findMockItems(entries.map((entry: any) => ({
      mock: { grade: entry.mock.grade, year: entry.mock.year, month: entry.mock.month, number: entry.mock.number },
      text: entry.text.slice(0, 20000),
    })));
    return Response.json({ results });
  });
}
