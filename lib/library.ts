// Library (보관함): folders and saved comic pages. Metadata lives in Neon, images in Vercel Blob.
import { neon } from "@neondatabase/serverless";
import { del, put } from "@vercel/blob";
import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import sharp from "sharp";
import { ADMIN_COOKIE_NAME, cookieMatches, isAdminConfigured } from "@/lib/admin-auth";

export type LibraryFolder = { id: string; parentId: string | null; name: string; sort: number; itemCount: number };
export type LibraryItem = {
  id: string; folderId: string; kind: string; itemKey: string; title: string; subtitle: string;
  sourceRange: string; imageUrl: string; createdAt: string; updatedAt: string;
};
export type MockInfo = { grade: string; year: number; month: number; number: number };
export type LibraryTarget = {
  folderId?: string; itemKey?: string; title?: string; subtitle?: string; sourceRange?: string;
  // Auto-sort: 모의고사 / 고2 / 2023년 6월, keyed by question number.
  mock?: MockInfo;
};

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
  return neon(url);
}

/** Only the academy admin may read or write the library; local runs without ADMIN_PASSWORD are allowed. */
export async function isLibraryAllowed(): Promise<boolean> {
  if (!isAdminConfigured()) return process.env.NODE_ENV !== "production";
  const jar = await cookies();
  return cookieMatches(jar.get(ADMIN_COOKIE_NAME)?.value);
}

// Deterministic ids make the seed idempotent when two first requests race.
const folderId = (path: string) => {
  const h = createHash("sha1").update(`summit-library:${path}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// Mock-exam months per grade. The folders are editable in the library page.
const MOCK_MONTHS: Record<string, string[]> = {
  "고1": ["3월", "6월", "9월", "10월", "11월"],
  "고2": ["3월", "6월", "9월", "10월", "11월"],
  "고3": ["3월", "5월", "6월", "7월", "9월", "10월", "수능"],
};
const MOCK_YEARS = [2026, 2025, 2024];
const TEXTBOOKS: Record<string, string[]> = {
  "공통영어1": [],
  "공통영어2": ["동아(이병민)", "YBM(김)"],
  "영어Ⅰ": [],
  "영어Ⅱ": ["NE능률(오선영)", "천재(강상구)"],
};

function seedRows() {
  const rows: Array<{ id: string; parent: string | null; name: string; sort: number }> = [];
  const add = (path: string[], sort: number) => {
    rows.push({ id: folderId(path.join("/")), parent: path.length > 1 ? folderId(path.slice(0, -1).join("/")) : null,
      name: path[path.length - 1], sort });
  };
  add(["모의고사"], 1);
  Object.entries(MOCK_MONTHS).forEach(([grade, months], g) => {
    add(["모의고사", grade], g);
    MOCK_YEARS.forEach((year, y) => months.forEach((month, m) => {
      const name = month === "수능" ? `${year}년 수능(${year + 1}학년도)` : `${year}년 ${month}`;
      add(["모의고사", grade, name], y * 100 + m);
    }));
  });
  add(["교과서(22개정)"], 2);
  Object.entries(TEXTBOOKS).forEach(([subject, books], s) => {
    add(["교과서(22개정)", subject], s);
    books.forEach((book, b) => add(["교과서(22개정)", subject, book], b));
  });
  add(["기타"], 3);
  return rows;
}

let ready: Promise<void> | null = null;
export function ensureLibrary(): Promise<void> {
  if (!ready) ready = setup().catch(error => { ready = null; throw error; });
  return ready;
}
async function setup() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS library_folders (
    id UUID PRIMARY KEY,
    parent_id UUID REFERENCES library_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS library_items (
    id UUID PRIMARY KEY,
    folder_id UUID NOT NULL REFERENCES library_folders(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'comic',
    item_key TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    source_range TEXT NOT NULL DEFAULT '',
    plan JSONB,
    image_url TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS library_items_key ON library_items (folder_id, kind, item_key)`;
  // Sibling names are unique, so parallel auto-sorting cannot create the same month folder twice.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS library_folders_name
    ON library_folders (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name)`;
  // Seed only an empty library, so folders the user deleted do not come back on the next start.
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM library_folders`;
  if (Number(count) > 0) return;
  const rows = seedRows();
  // One statement: foreign keys are checked at the end, so parents and children can arrive together.
  await sql`INSERT INTO library_folders (id, parent_id, name, sort)
    SELECT * FROM UNNEST(${rows.map(r => r.id)}::uuid[], ${rows.map(r => r.parent)}::uuid[],
      ${rows.map(r => r.name)}::text[], ${rows.map(r => r.sort)}::int[])
    ON CONFLICT (id) DO NOTHING`;
}

export async function listFolders(): Promise<LibraryFolder[]> {
  await ensureLibrary();
  const rows = await db()`SELECT f.id, f.parent_id, f.name, f.sort,
      (SELECT COUNT(*)::int FROM library_items i WHERE i.folder_id = f.id) AS item_count
    FROM library_folders f ORDER BY f.sort, f.name`;
  return rows.map(r => ({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null,
    name: String(r.name), sort: Number(r.sort), itemCount: Number(r.item_count) }));
}

export async function createFolder(parentId: string | null, name: string): Promise<string> {
  await ensureLibrary();
  const id = randomUUID();
  const sql = db();
  const [{ next }] = await sql`SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM library_folders
    WHERE parent_id IS NOT DISTINCT FROM ${parentId}::uuid`;
  await sql`INSERT INTO library_folders (id, parent_id, name, sort) VALUES (${id}, ${parentId}::uuid, ${name}, ${Number(next)})`;
  return id;
}

export async function renameFolder(id: string, name: string) {
  await ensureLibrary();
  await db()`UPDATE library_folders SET name = ${name} WHERE id = ${id}::uuid`;
}

/** Deletes only empty folders so saved work is never removed by accident. */
export async function deleteFolder(id: string): Promise<string | null> {
  await ensureLibrary();
  const sql = db();
  const [{ children, items }] = await sql`SELECT
    (SELECT COUNT(*)::int FROM library_folders WHERE parent_id = ${id}::uuid) AS children,
    (SELECT COUNT(*)::int FROM library_items WHERE folder_id = ${id}::uuid) AS items`;
  if (Number(children) || Number(items)) return "안에 폴더나 저장된 자료가 있어서 지울 수 없어요. 안을 먼저 비워 주세요.";
  await sql`DELETE FROM library_folders WHERE id = ${id}::uuid`;
  return null;
}

const toItem = (r: Record<string, unknown>): LibraryItem => ({
  id: String(r.id), folderId: String(r.folder_id), kind: String(r.kind), itemKey: String(r.item_key),
  title: String(r.title), subtitle: String(r.subtitle), sourceRange: String(r.source_range),
  imageUrl: String(r.image_url), createdAt: new Date(String(r.created_at)).toISOString(),
  updatedAt: new Date(String(r.updated_at)).toISOString(),
});

export async function listItems(folderId: string): Promise<LibraryItem[]> {
  await ensureLibrary();
  const rows = await db()`SELECT * FROM library_items WHERE folder_id = ${folderId}::uuid ORDER BY sort, created_at`;
  return rows.map(toItem);
}

export async function getItem(id: string): Promise<LibraryItem | null> {
  await ensureLibrary();
  const rows = await db()`SELECT * FROM library_items WHERE id = ${id}::uuid`;
  return rows[0] ? toItem(rows[0]) : null;
}

export async function renameItem(id: string, title: string) {
  await ensureLibrary();
  await db()`UPDATE library_items SET title = ${title}, updated_at = NOW() WHERE id = ${id}::uuid`;
}

export async function deleteItem(id: string) {
  const item = await getItem(id);
  if (!item) return;
  await db()`DELETE FROM library_items WHERE id = ${id}::uuid`;
  await del(item.imageUrl).catch(() => undefined);
}

/** Find (or create) 모의고사 / 고N / YYYY년 M월 and return its id. */
export async function resolveMockFolder(info: MockInfo): Promise<string> {
  await ensureLibrary();
  const sql = db();
  const path = ["모의고사", info.grade, `${info.year}년 ${info.month}월`];
  let parentId: string | null = null;
  for (const name of path) {
    await sql`INSERT INTO library_folders (id, parent_id, name, sort)
      SELECT ${randomUUID()}::uuid, ${parentId}::uuid, ${name}::text,
        COALESCE((SELECT MAX(sort) + 1 FROM library_folders WHERE parent_id IS NOT DISTINCT FROM ${parentId}::uuid), 0)
      ON CONFLICT DO NOTHING`;
    const found: Record<string, unknown>[] = await sql`SELECT id FROM library_folders
      WHERE parent_id IS NOT DISTINCT FROM ${parentId}::uuid AND name = ${name} LIMIT 1`;
    parentId = String(found[0].id);
  }
  return parentId!;
}

// "2026년 09월 모의고사 · 22번" → 22, so mock-exam pages list in question order.
const questionNumber = (text: string) => Number(text.match(/(\d+)\s*번(?!.*\d+\s*번)/u)?.[1] || 0);

/**
 * Save one page. The same folder + key replaces the earlier image, so regenerating a passage keeps
 * only the latest version. Images are stored as JPEG to stay inside the free storage allowance.
 */
export async function saveLibraryImage(input: LibraryTarget & { kind?: string; plan?: unknown; image: Buffer }): Promise<string> {
  await ensureLibrary();
  const sql = db();
  const target = input.mock
    ? { ...input, folderId: await resolveMockFolder(input.mock), itemKey: `${input.mock.number}번`,
        title: `${input.mock.number}번 ${input.title || ""}`.trim(),
        sourceRange: `${input.mock.year}년 ${input.mock.month}월 ${input.mock.grade} 모의고사 ${input.mock.number}번` }
    : input;
  if (!target.folderId) throw new Error("저장할 보관함 폴더가 없습니다.");
  const [folder] = await sql`SELECT id FROM library_folders WHERE id = ${target.folderId}::uuid`;
  if (!folder) throw new Error("저장할 보관함 폴더를 찾지 못했습니다.");
  const kind = target.kind || "comic";
  const title = (target.title || "").trim();
  const sourceRange = (target.sourceRange || "").trim();
  const itemKey = (target.itemKey || sourceRange || title || randomUUID()).trim();
  const jpeg = await sharp(target.image).flatten({ background: "#ffffff" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const blob = await put(`library/${target.folderId}/${randomUUID()}.jpg`, jpeg, {
    access: "public", contentType: "image/jpeg", addRandomSuffix: true,
  });
  const [previous] = await sql`SELECT image_url FROM library_items
    WHERE folder_id = ${target.folderId}::uuid AND kind = ${kind} AND item_key = ${itemKey}`;
  const id = randomUUID();
  const rows = await sql`INSERT INTO library_items
      (id, folder_id, kind, item_key, title, subtitle, source_range, plan, image_url, sort)
    VALUES (${id}, ${target.folderId}::uuid, ${kind}, ${itemKey}, ${title}, ${(target.subtitle || "").trim()},
      ${sourceRange}, ${target.plan === undefined ? null : JSON.stringify(target.plan)}::jsonb, ${blob.url},
      ${questionNumber(sourceRange || title)})
    ON CONFLICT (folder_id, kind, item_key) DO UPDATE SET
      title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, source_range = EXCLUDED.source_range,
      plan = EXCLUDED.plan, image_url = EXCLUDED.image_url, sort = EXCLUDED.sort, updated_at = NOW()
    RETURNING id`;
  if (previous && previous.image_url !== blob.url) await del(String(previous.image_url)).catch(() => undefined);
  return String(rows[0].id);
}
