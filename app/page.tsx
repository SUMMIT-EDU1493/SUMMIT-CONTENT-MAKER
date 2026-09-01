"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Dialogue = {
  title: string;
  content: string;
};

type Reading = {
  title: string;
  content: string;
};

type Grammar = {
  title: string;
  content: string;
};

type KeyExpression = {
  english: string;
  korean: string;
};

type KeyWord = {
  english: string;
  korean: string;
};

type AnalysisResult = {
  dialogues?: Dialogue[];
  reading?: Reading[];
  grammar?: Grammar[];
  keyExpressions?: KeyExpression[];
  keyWords?: KeyWord[];
};

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setPdfText("");
      setAnalysis(null);
      setErrorMessage("");

      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });

      const pdf = await loadingTask.promise;

      let fullText = "";

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
      ) {
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
        "PDF를 읽는 중 오류가 발생했어."
      );
    } finally {
      setLoadingPdf(false);
    }
  };

  const analyzePdf = async () => {
    if (!pdfText) {
      alert("먼저 PDF를 업로드해줘.");
      return;
    }

    try {
      setLoadingAi(true);
      setErrorMessage("");
      setAnalysis(null);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: pdfText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "AI 분석에 실패했습니다."
        );
      }

      setAnalysis(data);
    } catch (error) {
      console.error("AI ERROR:", error);

      setErrorMessage(
        "AI 분석 중 오류가 발생했어. 잠시 후 다시 시도해봐."
      );
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-blue-600">
          SUMMIT EDU
        </p>

        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          SUMMIT CONTENT MAKER
        </h1>

        <p className="mt-3 text-slate-600">
          교재 PDF를 업로드하면 대화문, 본문, 문법,
          핵심표현과 주요단어를 자동으로 분석해요.
        </p>

        <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            1. 교재 PDF 업로드
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
        </section>

        {loadingPdf && (
          <div className="mt-6 rounded-2xl bg-blue-50 p-6">
            <p className="font-semibold text-blue-700">
              PDF 내용을 읽는 중...
            </p>
          </div>
        )}

        {!loadingPdf && pdfText && (
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  2. PDF 텍스트 추출 완료
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  이제 AI가 교재 구조를 분석할 수 있어.
                </p>
              </div>

              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                읽기 완료
              </span>
            </div>

            <textarea
              value={pdfText}
              readOnly
              rows={12}
              className="mt-5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
            />

            <button
              onClick={analyzePdf}
              disabled={loadingAi}
              className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingAi
                ? "AI가 교재를 분석하는 중..."
                : "AI로 교재 분석하기"}
            </button>
          </section>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-700">
              오류
            </p>

            <p className="mt-2 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        )}

        {analysis && (
          <section className="mt-8 space-y-6">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                AI ANALYSIS
              </p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                교재 분석 완료
              </h2>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                💬 대화문
              </h3>

              <div className="mt-5 space-y-4">
                {analysis.dialogues &&
                analysis.dialogues.length > 0 ? (
                  analysis.dialogues.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <p className="font-bold text-blue-600">
                          대화문 {index + 1}
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {item.title}
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {item.content}
                        </p>

                        <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">
                          이 대화문으로 써밋네컷 만들기
                        </button>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-sm text-slate-400">
                    발견된 대화문이 없어.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                📘 본문
              </h3>

              <div className="mt-5 space-y-4">
                {analysis.reading &&
                analysis.reading.length > 0 ? (
                  analysis.reading.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-slate-50 p-5"
                      >
                        <p className="font-bold">
                          {item.title}
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {item.content}
                        </p>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-sm text-slate-400">
                    발견된 본문이 없어.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                🧠 문법
              </h3>

              <div className="mt-5 space-y-4">
                {analysis.grammar &&
                analysis.grammar.length > 0 ? (
                  analysis.grammar.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-slate-50 p-5"
                      >
                        <p className="font-bold">
                          {item.title}
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {item.content}
                        </p>
                      </div>
                    )
                  )
                ) : (
                  <p className="text-sm text-slate-400">
                    발견된 문법 항목이 없어.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold">
                  ⭐ 핵심표현
                </h3>

                <div className="mt-4 space-y-3">
                  {analysis.keyExpressions &&
                  analysis.keyExpressions.length > 0 ? (
                    analysis.keyExpressions.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-blue-50 p-4"
                        >
                          <p className="font-semibold">
                            {item.english}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {item.korean}
                          </p>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-sm text-slate-400">
                      핵심표현 없음
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold">
                  🔤 주요단어
                </h3>

                <div className="mt-4 space-y-3">
                  {analysis.keyWords &&
                  analysis.keyWords.length > 0 ? (
                    analysis.keyWords.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-amber-50 p-4"
                        >
                          <p className="font-semibold">
                            {item.english}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {item.korean}
                          </p>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-sm text-slate-400">
                      주요단어 없음
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}