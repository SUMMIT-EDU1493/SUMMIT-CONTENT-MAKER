"use client";

import HomeButton from "../components/HomeButton";

export default function EnglishTestMakerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <HomeButton />

        <div className="mt-8">
          <p className="text-sm font-black tracking-[0.18em] text-sky-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black text-slate-900">
            고등영어 변형문제 제작
          </h1>

          <p className="mt-3 text-slate-600">
            교재 PDF를 분석해 원하는 유형의 변형문제를 제작합니다.
          </p>
        </div>

        <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
          <p className="font-bold text-slate-500">
            영어 변형문제 제작 기능을 준비 중입니다.
          </p>
        </section>
      </div>
    </main>
  );
}
