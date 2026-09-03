"use client";

export default function HomeButton() {
  const goHome = () => {
    window.location.href = "/";
  };

  return (
    <button
      type="button"
      onClick={goHome}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md"
    >
      <span
        aria-hidden="true"
        className="text-base leading-none"
      >
        ⌂
      </span>

      홈으로
    </button>
  );
}