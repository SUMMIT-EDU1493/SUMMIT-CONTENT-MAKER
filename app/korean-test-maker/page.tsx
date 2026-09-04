"use client";

import HomeButton from "../components/HomeButton";

export default function KoreanTestMakerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <HomeButton />

        <div className="mt-8">
          <p className="text-sm font-black tracking-[0.18em] text-violet-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-900">
            고등국어 변형문제 제작
          </h1>

          <p className="mt-3 text-slate-600">
            국어 지문을 분석해 모의고사형 변형문제를 제작합니다.
          </p>
        </div>

        <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <p className="font-bold text-slate-500">
            국어 변형문제 제작 기능을 준비 중입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
