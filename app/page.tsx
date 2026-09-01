"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const readPdf = async (file: File) => {
    try {
      setLoading(true);
      setPdfText("");
      setErrorMessage("");

      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });

      const pdf = await loadingTask.promise;

      let fullText = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => {
            if ("str" in item) {
              return item.str;
            }
            return "";
          })
          .join(" ");

        fullText += `\n\n--- ${pageNumber}페이지 ---\n\n${pageText}`;
      }

      if (!fullText.trim()) {
        setErrorMessage(
          "PDF는 열렸지만 텍스트를 찾지 못했어. 스캔본 PDF일 가능성이 있어."
        );
        return;
      }

      setPdfText(fullText.trim());
    } catch (error) {
      console.error("PDF ERROR:", error);

      setErrorMessage(
        "PDF를 읽는 중 오류가 발생했어. 아래 단계에서 오류 내용을 확인해보자."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold text-blue-600">
          SUMMIT EDU
        </p>

        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          SUMMIT CONTENT MAKER
        </h1>

        <p className="mt-3 text-slate-600">
          교재 PDF 텍스트 추출 테스트
        </p>

        <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            교재 PDF 업로드
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            대화문, 본문, 문법이 함께 들어있는 PDF도 괜찮아.
          </p>

          <label className="mt-5 inline-block cursor-pointer rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white">
            PDF 선택

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (!file) {
                  return;
                }

                setFileName(file.name);
                readPdf(file);
              }}
            />
          </label>

          {fileName && (
            <div className="mt-5 rounded-xl bg-slate-100 p-4">
              <p className="text-sm text-slate-500">
                선택된 파일
              </p>

              <p className="mt-1 font-semibold text-slate-800">
                {fileName}
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl bg-blue-50 p-6">
            <p className="font-semibold text-blue-700">
              PDF 내용을 읽는 중...
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-700">
              PDF 읽기 실패
            </p>

            <p className="mt-2 text-sm text-red-600">
              {errorMessage}
            </p>

            <p className="mt-4 text-sm text-slate-600">
              터미널이나 브라우저 개발자 콘솔에
              <b> PDF ERROR:</b> 뒤에 나오는 내용을 보내줘.
            </p>
          </div>
        )}

        {!loading && pdfText && (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              PDF 텍스트 추출 성공
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              PDF에서 읽어낸 전체 내용이야.
            </p>

            <textarea
              value={pdfText}
              readOnly
              rows={22}
              className="mt-5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
            />
          </div>
        )}
      </div>
    </main>
  );
}