"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DashboardData = {
  summary: {
    todayCost: number;
    monthCost: number;
    totalCost: number;
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
  };
  byType: Array<{ usageType: string; calls: number; costKrw: number }>;
  byFeature: Array<{
    feature: string;
    calls: number;
    costKrw: number;
    avgCostKrw: number;
  }>;
  recent: Array<{
    id: number;
    created_at: string;
    route: string;
    feature: string;
    model: string;
    usage_type: string;
    success: boolean;
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
    image_count: number | null;
    estimated_cost_krw: number;
    error_message: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  daily: Array<{ day: string; calls: number; costKrw: number }>;
};

const won = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 1,
});

function formatWon(value: number) {
  return `${won.format(value)}원`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/usage", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setNeedsLogin(true);
        setData(null);
        return;
      }

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "관리자 데이터를 불러오지 못했습니다.");
      }

      setData(json);
      setNeedsLogin(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoginLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "로그인에 실패했습니다.");
      }

      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setData(null);
    setNeedsLogin(true);
  }

  const successRate = useMemo(() => {
    if (!data || data.summary.totalCalls === 0) return 100;
    return (data.summary.successCalls / data.summary.totalCalls) * 100;
  }, [data]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl text-center text-slate-400">
          사용량 데이터를 불러오는 중입니다.
        </div>
      </main>
    );
  }

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <form
          onSubmit={login}
          className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl"
        >
          <p className="text-sm font-black tracking-[0.25em] text-emerald-400">
            SUMMIT VISUAL LAB
          </p>
          <h1 className="mt-3 text-3xl font-black">ADMIN</h1>
          <p className="mt-2 text-sm text-slate-400">
            API 사용량과 예상 비용을 확인합니다.
          </p>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="관리자 비밀번호"
            autoFocus
            className="mt-7 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
          />

          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loginLoading || !password}
            className="mt-5 w-full cursor-pointer rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loginLoading ? "확인 중..." : "관리자 로그인"}
          </button>
        </form>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-rose-400">{error || "데이터가 없습니다."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black tracking-[0.25em] text-emerald-400">
              SUMMIT VISUAL LAB
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">API COST ADMIN</h1>
            <p className="mt-2 text-sm text-slate-400">
              OpenAI 사용량 · 기능별 원가 · 최근 호출 기록
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold hover:border-emerald-400"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-400 hover:text-white"
            >
              로그아웃
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["오늘 예상 비용", formatWon(data.summary.todayCost)],
            ["이번 달 예상 비용", formatWon(data.summary.monthCost)],
            ["누적 예상 비용", formatWon(data.summary.totalCost)],
            ["누적 API 호출", `${won.format(data.summary.totalCalls)}회`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm font-bold text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm font-bold text-slate-400">성공률</p>
            <p className="mt-2 text-2xl font-black">{successRate.toFixed(1)}%</p>
          </div>
          {data.byType.map((item) => (
            <div key={item.usageType} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm font-bold uppercase text-slate-400">{item.usageType}</p>
              <p className="mt-2 text-2xl font-black">{formatWon(item.costKrw)}</p>
              <p className="mt-1 text-xs text-slate-500">{won.format(item.calls)}회 호출</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-emerald-400">FEATURE COST</p>
              <h2 className="mt-1 text-2xl font-black">기능별 누적 원가</h2>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="px-3 py-3">기능</th>
                  <th className="px-3 py-3 text-right">호출</th>
                  <th className="px-3 py-3 text-right">평균</th>
                  <th className="px-3 py-3 text-right">누적 비용</th>
                </tr>
              </thead>
              <tbody>
                {data.byFeature.map((item) => (
                  <tr key={item.feature} className="border-b border-slate-800/80">
                    <td className="px-3 py-3 font-bold">{item.feature}</td>
                    <td className="px-3 py-3 text-right text-slate-400">{won.format(item.calls)}</td>
                    <td className="px-3 py-3 text-right text-slate-400">{formatWon(item.avgCostKrw)}</td>
                    <td className="px-3 py-3 text-right font-black text-emerald-300">{formatWon(item.costKrw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <p className="text-xs font-black tracking-[0.2em] text-emerald-400">LAST 14 DAYS</p>
          <h2 className="mt-1 text-2xl font-black">일별 사용량</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.daily.map((item) => (
              <div key={item.day} className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-500">{item.day}</p>
                <p className="mt-1 font-black">{formatWon(item.costKrw)}</p>
                <p className="mt-1 text-xs text-slate-500">{won.format(item.calls)}회</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <p className="text-xs font-black tracking-[0.2em] text-emerald-400">RECENT LOGS</p>
          <h2 className="mt-1 text-2xl font-black">최근 호출 50건</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="px-3 py-3">시간</th>
                  <th className="px-3 py-3">기능</th>
                  <th className="px-3 py-3">종류</th>
                  <th className="px-3 py-3">모델</th>
                  <th className="px-3 py-3 text-right">토큰/장수</th>
                  <th className="px-3 py-3 text-right">비용</th>
                  <th className="px-3 py-3 text-center">결과</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/80">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDate(item.created_at)}</td>
                    <td className="px-3 py-3 font-bold">{item.feature}</td>
                    <td className="px-3 py-3 uppercase text-slate-400">{item.usage_type}</td>
                    <td className="px-3 py-3 text-slate-400">{item.model}</td>
                    <td className="px-3 py-3 text-right text-slate-400">
                      {item.usage_type === "image"
                        ? `${item.image_count || 0}장`
                        : won.format(item.total_tokens || 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-black">{formatWon(item.estimated_cost_krw)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={item.success ? "text-emerald-400" : "text-rose-400"}>
                        {item.success ? "성공" : "실패"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
