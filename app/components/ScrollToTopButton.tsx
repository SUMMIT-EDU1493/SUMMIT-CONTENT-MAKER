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
        className="flex min-w-[72px] flex-col items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 font-black text-slate-700 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:text-emerald-700 active:scale-95"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="block"
        >
          <path
            d="M12 19V5M12 5L6.5 10.5M12 5L17.5 10.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="mt-1 text-xs tracking-[0.12em]">
          TOP
        </span>
      </button>
    </div>
  );
}