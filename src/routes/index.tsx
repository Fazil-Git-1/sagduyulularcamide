import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, settingsQuery } from "@/lib/queries";
import { CONTEST_DAYS, currentDay } from "@/lib/contest";
import { KeyRound, Trophy } from "lucide-react";

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

/** Emoji-free rank badge so it renders identically on every device. */
function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-gold-gradient text-gold-foreground border-transparent"
      : rank === 2
        ? "border-muted-foreground/40 bg-muted text-foreground"
        : rank === 3
          ? "border-accent/50 bg-accent/20 text-accent-foreground"
          : "border-border bg-background text-muted-foreground";

  return (
    <span
      aria-hidden
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums ${styles}`}
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
      <header className="bg-hero-gradient px-4 pb-8 pt-6 text-primary-foreground sm:px-5 sm:pb-10 sm:pt-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Sağduyulular Camide
          </h1>

          <div className="mt-4 rounded-2xl bg-primary-foreground/10 p-3.5 backdrop-blur-sm sm:mt-6 sm:p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold">
                {day}. Gün <span className="opacity-70">/ {CONTEST_DAYS}</span>
              </span>
              <span className="shrink-0 text-xs opacity-80">
                %{pct} · {remaining} gün kaldı
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-primary-foreground/20">
              <div
                className="h-full rounded-full bg-gold-gradient transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto -mt-5 max-w-2xl px-3 sm:px-4">
        <div className="rounded-3xl border border-border bg-card p-3.5 shadow-soft sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
            <Trophy className="h-5 w-5 shrink-0 text-gold" aria-hidden />
            Liderlik Tablosu
          </h2>

          {active.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz aktif takım yok.
            </p>
          ) : (
            <ol className="space-y-2">
              {active.map((team, i) => (
                <li
                  key={team.id}
                  className={`rounded-2xl border px-3 py-2.5 transition-colors ${
                    i === 0
                      ? "border-gold/60 bg-gold/10"
                      : "border-border bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <RankBadge rank={i + 1} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:text-base">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-base font-bold tabular-nums text-primary sm:text-lg">
                      {team.total_score}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        i === 0 ? "bg-gold-gradient" : "bg-primary/70"
                      }`}
                      style={{
                        width: `${Math.max((team.total_score / max) * 100, 3)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-6 pb-safe text-center">
          <Link
            to="/kaptan"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
          >
            <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
            Kaptan Girişi
          </Link>
        </div>
      </section>
    </main>
  );
}
