"use client";

export default function ScrollToTopButton() {
  const goTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex justify-center bg-[#f7f4ea] px-5 pb-10 pt-6">
      <button
        type="button"
        onClick={goTop}
        aria-label="페이지 맨 위로"
        title="맨 위로"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-2xl font-black text-slate-700 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:text-emerald-700 active:scale-90"
      >
        ↑
      </button>
    </div>
  );
}