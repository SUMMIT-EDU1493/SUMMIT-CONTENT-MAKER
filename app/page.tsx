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

type AnalysisResult = {
  dialogues?: Dialogue[];
};

type ComicDialogue = {
  speaker: string;
  text: string;
};

type ComicPanel = {
  cut: string;
  scene: string;
  characters: string;
  dialogue: ComicDialogue[];
};

type ComicPlan = {
  title: string;
  summary: string;
  panels: ComicPanel[];
};

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingComic, setLoadingComic] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [comicPlan, setComicPlan] = useState<ComicPlan | null>(null);

  const [selectedDialogueTitle, setSelectedDialogueTitle] = useState("");
  const [generatedComicImage, setGeneratedComicImage] = useState("");

  const readPdf = async (file: File) => {
    try {
      setLoadingPdf(true);
      setErrorMessage("");
      setPdfText("");
      setAnalysis(null);
      setComicPlan(null);
      setGeneratedComicImage("");

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
          "PDF는 열렸지만 텍스트를 찾지 못했어. 스캔 PDF일 가능성이 있어."
        );
        return;
      }

      setPdfText(fullText.trim());
    } catch (error) {
      console.error(error);
      setErrorMessage("PDF를 읽는 중 오류가 발생했어.");
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
      setComicPlan(null);
      setGeneratedComicImage("");

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
          data?.detail || data?.error || "교재 분석에 실패했습니다."
        );
      }

      setAnalysis(data);
    } catch (error: any) {
      setErrorMessage(error?.message || "교재 분석 중 오류가 발생했어.");
    } finally {
      setLoadingAi(false);
    }
  };

  const makeComicPlan = async (title: string, content: string) => {
    try {
      setLoadingComic(true);
      setErrorMessage("");
      setComicPlan(null);
      setGeneratedComicImage("");
      setSelectedDialogueTitle(title);

      const response = await fetch("/api/comic-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.error || "써밋네컷 설계안 생성에 실패했습니다."
        );
      }

      setComicPlan(data);

      setTimeout(() => {
        document.getElementById("comic-plan-result")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "써밋네컷 설계안 생성 중 오류가 발생했어."
      );
    } finally {
      setLoadingComic(false);
    }
  };

  const updateSummary = (value: string) => {
    if (!comicPlan) return;

    setComicPlan({
      ...comicPlan,
      summary: value,
    });
  };

  const updatePanelScene = (panelIndex: number, value: string) => {
    if (!comicPlan) return;

    const newPanels = [...comicPlan.panels];
    newPanels[panelIndex] = {
      ...newPanels[panelIndex],
      scene: value,
    };

    setComicPlan({
      ...comicPlan,
      panels: newPanels,
    });
  };

  const updateSpeaker = (
    panelIndex: number,
    dialogueIndex: number,
    value: string
  ) => {
    if (!comicPlan) return;

    const newPanels = [...comicPlan.panels];
    const newDialogue = [...newPanels[panelIndex].dialogue];

    newDialogue[dialogueIndex] = {
      ...newDialogue[dialogueIndex],
      speaker: value,
    };

    newPanels[panelIndex] = {
      ...newPanels[panelIndex],
      dialogue: newDialogue,
    };

    setComicPlan({
      ...comicPlan,
      panels: newPanels,
    });
  };

  const updateDialogueText = (
    panelIndex: number,
    dialogueIndex: number,
    value: string
  ) => {
    if (!comicPlan) return;

    const newPanels = [...comicPlan.panels];
    const newDialogue = [...newPanels[panelIndex].dialogue];

    newDialogue[dialogueIndex] = {
      ...newDialogue[dialogueIndex],
      text: value,
    };

    newPanels[panelIndex] = {
      ...newPanels[panelIndex],
      dialogue: newDialogue,
    };

    setComicPlan({
      ...comicPlan,
      panels: newPanels,
    });
  };

  const addDialogue = (panelIndex: number) => {
    if (!comicPlan) return;

    const newPanels = [...comicPlan.panels];

    newPanels[panelIndex] = {
      ...newPanels[panelIndex],
      dialogue: [
        ...newPanels[panelIndex].dialogue,
        {
          speaker: "",
          text: "",
        },
      ],
    };

    setComicPlan({
      ...comicPlan,
      panels: newPanels,
    });
  };

  const removeDialogue = (panelIndex: number, dialogueIndex: number) => {
    if (!comicPlan) return;

    const newPanels = [...comicPlan.panels];

    newPanels[panelIndex] = {
      ...newPanels[panelIndex],
      dialogue: newPanels[panelIndex].dialogue.filter(
        (_, index) => index !== dialogueIndex
      ),
    };

    setComicPlan({
      ...comicPlan,
      panels: newPanels,
    });
  };

  const generateComicImage = async () => {
    if (!comicPlan) {
      alert("먼저 써밋네컷 설계안을 만들어줘.");
      return;
    }

    try {
      setLoadingImage(true);
      setErrorMessage("");
      setGeneratedComicImage("");

      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(comicPlan),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.error || "만화 이미지 생성에 실패했습니다."
        );
      }

      setGeneratedComicImage(data.image);

      setTimeout(() => {
        document.getElementById("generated-comic-result")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "만화 이미지 생성 중 오류가 발생했어."
      );
    } finally {
      setLoadingImage(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold text-blue-600">SUMMIT EDU</p>

        <h1 className="mt-2 text-4xl font-black text-slate-900">
          SUMMIT CONTENT MAKER
        </h1>

        <p className="mt-3 text-slate-600">
          교재 PDF에서 대화문을 찾아 써밋네컷으로 만들어보자.
        </p>

        <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">1. 교재 PDF 업로드</h2>

          <label className="mt-5 inline-block cursor-pointer rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white">
            PDF 선택

            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (!file) return;

                setFileName(file.name);
                readPdf(file);
              }}
            />
          </label>

          {fileName && (
            <div className="mt-5 rounded-xl bg-slate-100 p-4">
              <p className="text-xs text-slate-500">선택된 파일</p>
              <p className="mt-1 font-semibold">{fileName}</p>
            </div>
          )}
        </section>

        {loadingPdf && (
          <div className="mt-6 rounded-2xl bg-blue-50 p-6 font-semibold text-blue-700">
            PDF 읽는 중...
          </div>
        )}

        {!loadingPdf && pdfText && (
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">2. 대화문 찾기</h2>

            <p className="mt-2 text-sm text-slate-500">
              PDF에서 대화문만 찾아낼게.
            </p>

            <button
              type="button"
              onClick={analyzePdf}
              disabled={loadingAi}
              className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white disabled:opacity-50"
            >
              {loadingAi ? "대화문 찾는 중..." : "대화문 분석하기"}
            </button>
          </section>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {errorMessage}
          </div>
        )}

        {analysis && (
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-bold">발견된 대화문</h2>

            <div className="mt-6 space-y-4">
              {analysis.dialogues?.map((dialogue, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-sm font-bold text-blue-600">
                    대화문 {index + 1}
                  </p>

                  <p className="mt-1 text-lg font-bold">{dialogue.title}</p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {dialogue.content}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      makeComicPlan(dialogue.title, dialogue.content)
                    }
                    disabled={loadingComic}
                    className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50"
                  >
                    {loadingComic &&
                    selectedDialogueTitle === dialogue.title
                      ? "설계안 만드는 중..."
                      : "이 대화문으로 써밋네컷 만들기"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {comicPlan && (
          <section id="comic-plan-result" className="mt-10 space-y-6">
            <div>
              <p className="text-sm font-bold text-purple-600">
                SUMMIT FOUR-CUT EDITOR
              </p>

              <h2 className="mt-1 text-3xl font-black">써밋네컷 설계안 편집</h2>

              <p className="mt-2 text-slate-600">
                이상한 대사가 있으면 여기서 바로 고치고 이미지로 만들면 돼.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <label className="text-sm font-bold text-slate-700">
                만화 상단 한줄 제목
              </label>

              <input
                value={comicPlan.summary}
                onChange={(e) => updateSummary(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-xl font-bold"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {comicPlan.panels.map((panel, panelIndex) => (
                <div
                  key={panelIndex}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 font-bold text-white">
                      {panelIndex + 1}
                    </div>

                    <h3 className="text-xl font-bold">{panel.cut}</h3>
                  </div>

                  <div className="mt-5">
                    <label className="text-sm font-bold text-slate-700">
                      장면 설명
                    </label>

                    <textarea
                      value={panel.scene}
                      onChange={(e) =>
                        updatePanelScene(panelIndex, e.target.value)
                      }
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                  </div>

                  <div className="mt-6 space-y-5">
                    {panel.dialogue.map((dialogue, dialogueIndex) => (
                      <div
                        key={dialogueIndex}
                        className="rounded-xl bg-purple-50 p-4"
                      >
                        <div>
                          <label className="text-xs font-bold text-purple-700">
                            화자
                          </label>

                          <input
                            value={dialogue.speaker}
                            onChange={(e) =>
                              updateSpeaker(
                                panelIndex,
                                dialogueIndex,
                                e.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-purple-200 bg-white px-3 py-2"
                          />
                        </div>

                        <div className="mt-3">
                          <label className="text-xs font-bold text-purple-700">
                            말풍선 대사
                          </label>

                          <textarea
                            value={dialogue.text}
                            onChange={(e) =>
                              updateDialogueText(
                                panelIndex,
                                dialogueIndex,
                                e.target.value
                              )
                            }
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-lg font-semibold"
                          />
                        </div>

                        {panel.dialogue.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeDialogue(panelIndex, dialogueIndex)
                            }
                            className="mt-3 text-sm font-semibold text-red-500"
                          >
                            이 대사 삭제
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addDialogue(panelIndex)}
                      className="w-full rounded-xl border-2 border-dashed border-purple-300 py-3 font-bold text-purple-600"
                    >
                      + 대사 추가
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-purple-50 p-6 ring-1 ring-purple-200">
              <h3 className="text-xl font-black">대사 확인 끝났어?</h3>

              <p className="mt-2 text-sm text-slate-600">
                위 내용을 직접 수정한 뒤 아래 버튼을 누르면 수정된 내용 그대로
                이미지 제작에 사용돼.
              </p>

              <button
                type="button"
                onClick={generateComicImage}
                disabled={loadingImage}
                className="mt-5 w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
              >
                {loadingImage
                  ? "써밋네컷 이미지 생성 중..."
                  : "수정된 설계안으로 만화 생성"}
              </button>
            </div>
          </section>
        )}

        {loadingImage && (
          <div className="mt-8 rounded-2xl bg-amber-50 p-6 font-semibold text-amber-700">
            AI가 최종 네컷 만화를 만드는 중...
          </div>
        )}

        {generatedComicImage && (
          <section
            id="generated-comic-result"
            className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <img
              src={generatedComicImage}
              alt="써밋네컷"
              className="w-full rounded-xl"
            />

            <a
              href={generatedComicImage}
              download="summit-four-cut.png"
              className="mt-5 inline-block rounded-xl bg-slate-900 px-6 py-3 font-bold text-white"
            >
              PNG 다운로드
            </a>
          </section>
        )}
      </div>
    </main>
  );
}