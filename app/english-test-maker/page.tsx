"use client";

import { useEffect, useMemo, useState } from "react";
import HomeButton from "../components/HomeButton";

type SavedPassage = {
  id: string;
  title: string;
  source: string;
  createdAt: string;
};

const QUESTION_TYPES = [
  "주제·제목",
  "내용 일치·불일치",
  "빈칸 추론",
  "어휘",
  "어법",
  "요약문 완성",
  "문장 삽입",
  "글의 순서",
  "서술형",
  "학교시험형 종합",
];

const COLORS = [
  { name: "민트", value: "#8FE7C1" },
  { name: "레몬", value: "#F6E77A" },
  { name: "블루", value: "#A9D8FF" },
  { name: "라벤더", value: "#D9C6FF" },
  { name: "코랄", value: "#FFB7A6" },
  { name: "그레이", value: "#CBD5E1" },
];

export default function EnglishTestMakerPage() {
  const [schoolName, setSchoolName] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [rangeName, setRangeName] = useState("");

  const [savedPassages, setSavedPassages] = useState<SavedPassage[]>([]);
  const [selectedPassageIds, setSelectedPassageIds] = useState<string[]>([]);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "주제·제목",
    "내용 일치·불일치",
  ]);

  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({
    "주제·제목": 1,
    "내용 일치·불일치": 1,
  });

  const [difficulty, setDifficulty] = useState("기본");
  const [themeColor, setThemeColor] = useState(COLORS[0].value);

  useEffect(() => {
    const raw = localStorage.getItem("summit-english-passages");

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedPassages(parsed);
      }
    } catch {
      // ignore malformed localStorage data
    }
  }, []);

  const totalQuestions = useMemo(() => {
    return selectedTypes.reduce(
      (sum, type) => sum + (questionCounts[type] || 0),
      0
    );
  }, [selectedTypes, questionCounts]);

  const toggleQuestionType = (type: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type);
      }

      return [...prev, type];
    });

    setQuestionCounts((prev) => ({
      ...prev,
      [type]: prev[type] || 1,
    }));
  };

  const togglePassage = (id: string) => {
    setSelectedPassageIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <HomeButton />

          <div className="rounded-full bg-sky-100 px-4 py-2 text-xs font-black tracking-[0.16em] text-sky-700">
            ENG MOCK TEST LAB
          </div>
        </div>

        <section className="mt-8">
          <p className="text-sm font-black tracking-[0.18em] text-sky-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            고등영어 변형문제 제작
          </h1>

          <p className="mt-3 text-base font-medium text-slate-600">
            교재 PDF를 분석해 원하는 유형의 모의고사·내신형 변형문제를 제작합니다.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">
              PDF 업로드
            </span>
            <span>→</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">
              지문 저장
            </span>
            <span>→</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">
              유형 선택
            </span>
            <span>→</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">
              문제 제작
            </span>
            <span>→</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">
              시험지 완성
            </span>
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">1. 기본정보</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">학교명</span>
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="예) 써밋고"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">학년</span>
              <input
                value={gradeName}
                onChange={(e) => setGradeName(e.target.value)}
                placeholder="예) 고 2"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">시험 범위</span>
              <input
                value={rangeName}
                onChange={(e) => setRangeName(e.target.value)}
                placeholder="예) Extra Reading Ⅰ & Ⅱ"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 placeholder:text-slate-400"
              />
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                2. 지문 라이브러리
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                한 번 저장한 지문은 다음 제작에서도 다시 사용할 수 있습니다.
              </p>
            </div>

            <label className="inline-flex cursor-pointer rounded-2xl bg-sky-600 px-5 py-3 font-black text-white shadow-sm transition hover:bg-sky-700">
              PDF 업로드
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={() => {
                  alert("다음 단계에서 PDF 지문 자동 추출 기능을 연결합니다.");
                }}
              />
            </label>
          </div>

          <div className="mt-5">
            {savedPassages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-400">
                아직 저장된 지문이 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {savedPassages.map((passage) => {
                  const selected = selectedPassageIds.includes(passage.id);

                  return (
                    <button
                      key={passage.id}
                      type="button"
                      onClick={() => togglePassage(passage.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-sky-400 bg-sky-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black text-slate-900">
                            {passage.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {passage.source}
                          </p>
                        </div>

                        <div
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            selected
                              ? "bg-sky-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {selected ? "선택됨" : "선택"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">
            3. 문제 유형 선택
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {QUESTION_TYPES.map((type) => {
              const checked = selectedTypes.includes(type);

              return (
                <div
                  key={type}
                  className={`flex items-center justify-between rounded-2xl border p-4 ${
                    checked
                      ? "border-sky-300 bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleQuestionType(type)}
                      className="h-5 w-5"
                    />

                    <span className="font-bold text-slate-800">{type}</span>
                  </label>

                  {checked && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionCounts((prev) => ({
                            ...prev,
                            [type]: Math.max(1, (prev[type] || 1) - 1),
                          }))
                        }
                        className="h-8 w-8 rounded-full bg-white font-black shadow-sm"
                      >
                        −
                      </button>

                      <span className="min-w-6 text-center font-black">
                        {questionCounts[type] || 1}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setQuestionCounts((prev) => ({
                            ...prev,
                            [type]: Math.min(10, (prev[type] || 1) + 1),
                          }))
                        }
                        className="h-8 w-8 rounded-full bg-white font-black shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 px-5 py-4 text-white">
            <span className="text-sm font-bold text-slate-300">총 문항 수</span>
            <strong className="ml-3 text-2xl">{totalQuestions}문항</strong>
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">4. 난이도</h2>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {["기본", "중상", "고난도"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDifficulty(item)}
                  className={`rounded-2xl px-4 py-3 font-black transition ${
                    difficulty === item
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black text-slate-900">
              5. THEME COLOR
            </h2>

            <div className="mt-5 flex flex-wrap gap-3">
              {COLORS.map((color) => {
                const selected = themeColor === color.value;

                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setThemeColor(color.value)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: color.value }}
                    />
                    {color.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">6. 문제 제작</h2>

          <div className="mt-5 grid gap-3 text-sm font-bold text-slate-600 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              선택 지문
              <strong className="mt-1 block text-xl text-slate-900">
                {selectedPassageIds.length}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              문제 유형
              <strong className="mt-1 block text-xl text-slate-900">
                {selectedTypes.length}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              총 문항
              <strong className="mt-1 block text-xl text-slate-900">
                {totalQuestions}
              </strong>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              난이도
              <strong className="mt-1 block text-xl text-slate-900">
                {difficulty}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              alert("다음 단계에서 AI 변형문제 생성 기능을 연결합니다.");
            }}
            className="mt-6 w-full rounded-2xl bg-sky-600 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-700"
          >
            선택한 유형으로 변형문제 만들기
          </button>
        </section>
      </div>
    </main>
  );
}