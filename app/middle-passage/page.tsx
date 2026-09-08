python - <<'PY'
from pathlib import Path

p = Path("app/middle-passage/page.tsx")
text = p.read_text(encoding="utf-8")

old = '''              <button
                type="button"
                onClick={
                  downloadLessonPdf
                }
                disabled={
                  makingPdf ||
                  !frontCoverImage ||
                  !backCoverImage
                }
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:opacity-40"
              >
                {makingPdf
                  ? "PDF 만드는 중..."
                  : `PDF 다운로드 · 총 ${totalPdfPages}페이지`}
              </button>'''

new = '''              {(!frontCoverImage ||
                !backCoverImage) && (
                <div className="mt-5 rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-center">
                  <p className="font-black text-amber-200">
                    표지를 자동으로 준비하고 있습니다.
                  </p>

                  <p className="mt-1 text-sm text-amber-100/80">
                    앞표지와 뒷표지가 모두 완성되면 PDF 다운로드 버튼이 자동으로 활성화됩니다.
                  </p>

                  <div className="mx-auto mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-amber-300" />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={
                  downloadLessonPdf
                }
                disabled={
                  makingPdf ||
                  !frontCoverImage ||
                  !backCoverImage
                }
                className="mt-5 w-full rounded-xl bg-purple-500 px-6 py-4 text-lg font-black text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
              >
                {makingPdf
                  ? "PDF 만드는 중..."
                  : !frontCoverImage ||
                    !backCoverImage
                  ? "표지 자동 완성 대기 중..."
                  : `PDF 다운로드 · 총 ${totalPdfPages}페이지`}
              </button>'''

if old not in text:
    raise SystemExit("최종 PDF 버튼 위치를 찾지 못했어.")

text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8")
print("PDF 대기 안내 적용 완료")
PY

npm run build