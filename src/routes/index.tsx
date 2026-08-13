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

/** İlk üç sıra için ince metal halkalı numara rozeti, diğerleri sade numara */
function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "border-gold/70 text-gold"
      : rank === 2
        ? "border-silver/70 text-silver"
        : rank === 3
          ? "border-bronze/70 text-bronze"
          : "border-border text-muted-foreground";

  return (
    <span
      aria-hidden
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular-nums ${styles}`}
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
    <main className="min-h-screen overflow-x-hidden bg-background">
      <header className="bg-hero-gradient px-5 pb-12 pt-10 text-hero-foreground sm:pb-16 sm:pt-14">
        <div className="mx-auto max-w-xl">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-gold/80">
            30 Günlük Namaz Yarışması
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Sağduyulular Camide
          </h1>
          <div className="mt-5 h-px w-16 bg-gold/70" />

          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold tabular-nums">
                {day}. Gün <span className="font-normal opacity-60">/ {CONTEST_DAYS}</span>
              </span>
              <span className="shrink-0 text-xs font-medium tabular-nums opacity-70">
                %{pct} · {remaining} gün kaldı
              </span>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-hero-foreground/15">
              <div
                className="h-full rounded-full bg-gold transition-all duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 pb-4 pt-10">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-4.5 w-4.5 shrink-0 text-gold" aria-hidden />
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Liderlik Tablosu
          </h2>
        </div>

        {active.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Henüz aktif takım yok.</p>
        ) : (
          <ol className="mt-5 divide-y divide-border">
            {active.map((team, i) => {
              const barColor =
                i === 0
                  ? "bg-gold"
                  : i === 1
                    ? "bg-silver"
                    : i === 2
                      ? "bg-bronze"
                      : "bg-primary/50";

              return (
                <li
                  key={team.id}
                  className={`animate-rise ${i === 0 ? "py-5" : "py-4"}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-3.5">
                    <RankBadge rank={i + 1} />
                    <span
                      className={`min-w-0 flex-1 truncate font-display font-semibold tracking-tight text-foreground ${
                        i === 0 ? "text-xl" : "text-base"
                      }`}
                    >
                      {team.name}
                    </span>
                    <span
                      className={`shrink-0 font-display font-extrabold tabular-nums tracking-tight text-foreground ${
                        i === 0 ? "text-2xl" : "text-lg"
                      }`}
                    >
                      {team.total_score}
                    </span>
                  </div>
                  <div className="mt-3 ml-12.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                      style={{ width: `${Math.max((team.total_score / max) * 100, 2)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <nav className="mx-auto flex max-w-xl items-center justify-center gap-6 px-5 pb-10 pt-6 pb-safe">
        <Link
          to="/kaptan"
          className="inline-flex min-h-11 items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground active:text-foreground"
        >
          <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Kaptan Girişi
        </Link>
        <span className="h-4 w-px bg-border" aria-hidden />
        <Link
          to="/admin"
          className="inline-flex min-h-11 items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground active:text-foreground"
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Yönetici Girişi
        </Link>
      </nav>
    </main>
  );
}

