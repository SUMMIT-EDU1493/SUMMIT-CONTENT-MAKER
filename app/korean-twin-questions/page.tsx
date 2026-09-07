"use client";

import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type SourceQuestion = {
  number: string;
  stem: string;
  bogi: string;
  choices: string[];
};

type TwinPassageGroup = {
  id: string;
  title: string;
  source: string;
  questions: SourceQuestion[];
};

export default function KoreanTwinQuestionsPage() {
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");

  const [groups, setGroups] = useState<TwinPassageGroup[]>([]);

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);

  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  /*
  ==================================================
  PDF 읽기
  ==================================================
  */

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setGroups([]);
      setPdfText("");

      setFileName(file.name);
      setStatusText("PDF를 읽는 중...");

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
        setStatusText(
          `${pageNumber}/${pdf.numPages} 페이지 읽는 중...`
        );

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

        fullText += `

--- ${pageNumber}페이지 ---

${pageText}
`;
      }

      const cleanedText = fullText.trim();

      if (!cleanedText) {
        throw new Error(
          "PDF에서 텍스트를 읽지 못했습니다."
        );
      }

      setPdfText(cleanedText);

      await analyzeTwinSource(cleanedText);
    } catch (error: any) {
      console.error("PDF READ ERROR:", error);

      setErrorMessage(
        error?.message ||
          "PDF를 읽는 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingPdf(false);
    }
  };

  /*
  ==================================================
  쌍둥이 문제 원본 분석
  ==================================================
  */

  const analyzeTwinSource = async (text: string) => {
    try {
      setLoadingAnalyze(true);
      setErrorMessage("");

      const cleanedText = text.trim();

      if (!cleanedText) {
        throw new Error(
          "분석할 텍스트가 없습니다."
        );
      }

      setStatusText(
        "지문과 원본 문제를 묶는 중..."
      );

      const response = await fetch(
        "/api/korean-twin-passages",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            text: cleanedText,
            pdfText: cleanedText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "원본 문제 분석에 실패했습니다."
        );
      }

      const foundGroups: TwinPassageGroup[] =
        Array.isArray(data?.groups)
          ? data.groups
          : [];

      if (foundGroups.length === 0) {
        throw new Error(
          "지문과 문제 세트를 찾지 못했습니다."
        );
      }

      setGroups(foundGroups);

      const totalQuestions =
        foundGroups.reduce(
          (sum, group) =>
            sum + group.questions.length,
          0
        );

      setStatusText(
        `${foundGroups.length}개 지문 · ${totalQuestions}문항 분석 완료`
      );
    } catch (error: any) {
      console.error("TWIN ANALYZE ERROR:", error);

      setErrorMessage(
        error?.message ||
          "원본 문제 분석 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingAnalyze(false);
    }
  };

  /*
  ==================================================
  파일 선택
  ==================================================
  */

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("PDF 파일을 선택해줘.");
      return;
    }

    await readPdf(file);
  };

  /*
  ==================================================
  문제 카드
  ==================================================
  */

  const renderQuestion = (
    question: SourceQuestion
  ) => {
    return (
      <article
        key={question.number}
        className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200"
      >
        {/* 문제번호 + 발문 */}

        <div className="flex items-start gap-4">
          <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-base font-black text-white">
            {question.number}
          </div>

          <p className="pt-1 text-[17px] font-bold leading-8 text-slate-900">
            {question.stem}
          </p>
        </div>

        {/* 보기 */}

        {question.bogi && (
          <div className="mx-auto mt-7 max-w-3xl border-y border-slate-400 px-7 py-5">
            <p className="text-center text-sm font-black tracking-widest text-slate-700">
              &lt; 보 기 &gt;
            </p>

            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
              {question.bogi}
            </p>
          </div>
        )}

        {/* 선택지 */}

        {question.choices.length > 0 && (
          <div className="mt-7 space-y-3 pl-2">
            {question.choices.map(
              (choice, choiceIndex) => (
                <p
                  key={`${question.number}-${choiceIndex}`}
                  className="text-[16px] leading-7 text-slate-900"
                >
                  {choice}
                </p>
              )
            )}
          </div>
        )}
      </article>
    );
  };

  const totalQuestions =
    groups.reduce(
      (sum, group) =>
        sum + group.questions.length,
      0
    );

  /*
  ==================================================
  화면
  ==================================================
  */

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div>
          <p className="text-sm font-black tracking-widest text-purple-600">
            SUMMIT KOR MOCK TEST LAB
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-900">
            국어 쌍둥이 문제
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            원본 모의고사의 지문과 문제 형식을 먼저
            분석한 뒤, 같은 틀을 유지한 쌍둥이 문제를
            제작합니다.
          </p>
        </div>

        {/* UPLOAD */}

        <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black text-blue-600">
            STEP 1
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-900">
            원본 국어 시험 PDF 업로드
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            먼저 지문과 해당 지문에 딸린 원본 문제를
            정확하게 묶어냅니다.
          </p>

          <label className="mt-6 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-purple-400 hover:bg-purple-50">
            <div>
              <p className="text-lg font-black text-slate-800">
                PDF 파일 선택
              </p>

              <p className="mt-2 text-sm text-slate-500">
                고등 국어 모의고사 PDF
              </p>

              {fileName && (
                <p className="mt-4 font-bold text-purple-600">
                  {fileName}
                </p>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {(loadingPdf || loadingAnalyze) && (
            <div className="mt-5 rounded-2xl bg-blue-50 px-5 py-4 font-bold text-blue-700">
              {statusText}
            </div>
          )}

          {!loadingPdf &&
            !loadingAnalyze &&
            groups.length > 0 && (
              <div className="mt-5 rounded-2xl bg-emerald-50 px-5 py-4 font-bold text-emerald-700">
                {groups.length}개 지문 ·{" "}
                {totalQuestions}문항 분석 완료
              </div>
            )}
        </section>

        {/* ERROR */}

        {errorMessage && (
          <div className="mt-8 rounded-2xl bg-red-50 p-5 font-bold text-red-700 ring-1 ring-red-200">
            {errorMessage}
          </div>
        )}

        {/* RESULT */}

        {groups.length > 0 && (
          <section className="mt-10">
            <div>
              <p className="text-sm font-black text-purple-600">
                SOURCE FORMAT CHECK
              </p>

              <h2 className="mt-2 text-3xl font-black text-slate-900">
                원본 문제 구조 확인
              </h2>

              <p className="mt-3 text-slate-600">
                여기서 지문과 문제 번호, 발문, 보기,
                선택지가 원본과 제대로 묶였는지 먼저
                확인하면 돼.
              </p>
            </div>

            <div className="mt-8 space-y-12">
              {groups.map(
                (group, groupIndex) => (
                  <section
                    key={group.id}
                    className="overflow-hidden rounded-[32px] bg-slate-50 shadow-sm ring-1 ring-slate-200"
                  >
                    {/* 지문 헤더 */}

                    <div className="bg-slate-900 px-7 py-6 text-white">
                      <p className="text-xs font-black tracking-widest text-purple-300">
                        PASSAGE {groupIndex + 1}
                      </p>

                      <h3 className="mt-2 text-2xl font-black">
                        {group.title}
                      </h3>

                      <p className="mt-2 text-sm text-slate-300">
                        원본문제{" "}
                        {group.questions
                          .map(
                            (question) =>
                              question.number
                          )
                          .join(" · ")}
                      </p>
                    </div>

                    {/* 지문 */}

                    <div className="border-b border-slate-200 bg-white px-8 py-8">
                      <p className="text-xs font-black tracking-widest text-slate-400">
                        지문
                      </p>

                      <p className="mt-5 whitespace-pre-wrap text-[16px] leading-8 text-slate-900">
                        {group.source}
                      </p>
                    </div>

                    {/* 문제들 */}

                    <div className="space-y-6 p-6 md:p-8">
                      {group.questions.map(
                        (question) =>
                          renderQuestion(question)
                      )}
                    </div>
                  </section>
                )
              )}
            </div>
          </section>
        )}

        {/* 아직 숨겨둔 원문 텍스트 */}

        {false && (
          <pre>{pdfText}</pre>
        )}
      </div>
    </main>
  );
}
