import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, settingsQuery } from "@/lib/queries";
import { CONTEST_DAYS, currentDay } from "@/lib/contest";
import { KeyRound, ShieldCheck, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Namaz Yarışması — Liderlik Tablosu" },
      {
        name: "description",
        content:
          "30 günlük namaz yarışmasının canlı liderlik tablosu: takım puanları ve gün ilerlemesi anlık olarak burada.",
      },
      { property: "og:title", content: "Namaz Yarışması — Liderlik Tablosu" },
      {
        property: "og:description",
        content: "30 günlük namaz yarışmasının canlı liderlik tablosu: takım puanları ve gün ilerlemesi anlık olarak burada.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(teamsQuery);
    context.queryClient.ensureQueryData(settingsQuery);
  },
  component: Leaderboard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      Tablo yüklenemedi: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Bulunamadı.</div>,
});

function useRealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("leaderboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, () => {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** İlk 3 takım için özel degrade (gradient) ve renk hiyerarşisi barındıran rozet */
function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-gradient-to-br from-amber-300 to-amber-500 text-white border-amber-200/50 shadow-md shadow-amber-500/20"
      : rank === 2
        ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white border-slate-200/50 shadow-md shadow-slate-500/20"
        : rank === 3
          ? "bg-gradient-to-br from-orange-300 to-orange-400 text-white border-orange-200/50 shadow-md shadow-orange-500/20"
          : "border-border bg-background text-muted-foreground shadow-sm";

  return (
    <span
      aria-hidden
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-extrabold tabular-nums transition-all ${styles}`}
    >
      {rank}
    </span>
  );
}

function Leaderboard() {
  const { data: teams } = useSuspenseQuery(teamsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  useRealtimeSync();

  const active = teams.filter((t) => t.is_active);
  const day = currentDay(settings.start_date);
  const pct = Math.round((day / CONTEST_DAYS) * 100);
  const remaining = Math.max(CONTEST_DAYS - day, 0);
  const max = Math.max(...active.map((t) => t.total_score), 1);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pb-10">
      {/* 1. Doku ve Derinlik: Yeni Degrade Arka Plan */}
      <header className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-green-900 px-4 pb-12 pt-6 text-primary-foreground sm:px-5 sm:pb-16 sm:pt-8 shadow-inner">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl text-white drop-shadow-md">
            Sağduyulular Camide
          </h1>

          {/* 2. Cam Efekti (Glassmorphism): Sayaç Kutusu */}
          <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-xl sm:mt-7 sm:p-5">
            <div className="flex items-center justify-between gap-3 text-sm text-white/90">
              <span className="min-w-0 truncate font-semibold">
                {day}. Gün <span className="opacity-70 font-normal">/ {CONTEST_DAYS}</span>
              </span>
              <span className="shrink-0 text-xs font-medium tracking-wide">
                %{pct} · {remaining} gün kaldı
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/20 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto -mt-8 max-w-2xl px-3 sm:px-4 relative z-10">
        {/* Derin Gölge (Shadow-2xl) */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-2xl shadow-emerald-900/10 sm:p-6 sm:px-8">
          <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-foreground">
            <Trophy className="h-6 w-6 shrink-0 text-amber-500 drop-shadow-sm" aria-hidden />
            Liderlik Tablosu
          </h2>

          {active.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-muted-foreground">
              Henüz aktif takım yok.
            </p>
          ) : (
            <ol className="space-y-3">
              {active.map((team, i) => {
                // 3. Kürsü Hiyerarşisi: Arka plan ve çerçeve renkleri
                const cardStyles =
                  i === 0
                    ? "border-amber-500/30 bg-amber-500/10"
                    : i === 1
                      ? "border-slate-500/30 bg-slate-500/10"
                      : i === 2
                        ? "border-orange-500/30 bg-orange-500/10"
                        : "border-border bg-secondary/30";

                // 4. İlerleme Çubukları: Takım derecesine göre bar renkleri
                const barStyles =
                  i === 0
                    ? "bg-gradient-to-r from-amber-400 to-amber-500"
                    : i === 1
                      ? "bg-gradient-to-r from-slate-400 to-slate-500"
                      : i === 2
                        ? "bg-gradient-to-r from-orange-400 to-orange-500"
                        : "bg-gradient-to-r from-emerald-400 to-teal-500";

                return (
                  <li
                    key={team.id}
                    className={`rounded-2xl border px-3.5 py-3 transition-colors ${cardStyles}`}
                  >
                    <div className="flex items-center gap-3">
                      <RankBadge rank={i + 1} />
                      <span className="min-w-0 flex-1 truncate text-base font-bold text-foreground sm:text-lg">
                        {team.name}
                        {i === 0 && <span className="ml-1.5 inline-block text-lg" aria-hidden>🥇</span>}
                        {i === 1 && <span className="ml-1.5 inline-block text-lg" aria-hidden>🥈</span>}
                        {i === 2 && <span className="ml-1.5 inline-block text-lg" aria-hidden>🥉</span>}
                      </span>
                      <span className="shrink-0 text-lg font-extrabold tabular-nums text-foreground tracking-tight sm:text-xl">
                        {team.total_score}
                      </span>
                    </div>
                    {/* Daha kalın ve tam yuvarlak bar */}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background/50 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${barStyles}`}
                        style={{
                          width: `${Math.max((team.total_score / max) * 100, 3)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* 4. Buton Hover/Active Efektleri */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 pb-safe">
          <Link
            to="/kaptan"
            className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 active:bg-secondary"
          >
            <KeyRound className="h-4.5 w-4.5 shrink-0 text-emerald-600" aria-hidden />
            Kaptan Girişi
          </Link>
          <Link
            to="/admin"
            className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 active:bg-secondary"
          >
            <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-slate-500" aria-hidden />
            Yönetici Girişi
          </Link>
        </div>
      </section>
    </main>
  );
}
