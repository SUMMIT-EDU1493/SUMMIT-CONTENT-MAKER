"use client";

import Link from "next/link";
import HomeButton from "../components/HomeButton";

export default function KoreanLabPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <HomeButton />

          <div className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black tracking-[0.16em] text-violet-700">
            KOR LAB
          </div>
        </div>

        <section className="mt-10">
          <p className="text-sm font-black tracking-[0.18em] text-violet-600">
            SUMMIT VISUAL LAB
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            고등국어 컨텐츠 제작
          </h1>

          <p className="mt-4 text-base font-medium leading-7 text-slate-500">
            긴 국어 지문을 시험 대비용 시각 학습자료로 재구성합니다.
          </p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <Link
            href="/korean-summary"
            className="group rounded-[32px] border border-violet-200 bg-violet-50 p-8 transition hover:-translate-y-1 hover:shadow-xl"
          >
            <p className="text-xs font-black tracking-[0.15em] text-violet-600">
              SUMMARY.ZIP
            </p>

            <h2 className="mt-4 text-3xl font-black text-slate-900">
              국어 요약.ZIP
            </h2>

            <p className="mt-4 max-w-md text-sm font-medium leading-7 text-slate-600">
              긴 비문학 지문을 글의 흐름, 핵심 개념, 비교·인과 관계,
              시험 포인트 중심으로 압축합니다.
            </p>

            <div className="mt-8 inline-flex rounded-full bg-violet-600 px-5 py-2.5 text-sm font-black text-white">
              제작하기 →
            </div>
          </Link>

          <div className="rounded-[32px] border border-slate-200 bg-white p-8 opacity-70">
            <p className="text-xs font-black tracking-[0.15em] text-slate-400">
              COMING SOON
            </p>

            <h2 className="mt-4 text-3xl font-black text-slate-700">
              국어 변형문제
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-500">
              지문 분석 기반 국어 변형문제 제작 기능은 다음 단계에서
              추가합니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}