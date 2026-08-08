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
      { title: "30 Günlük Namaz Yarışması — Liderlik Tablosu" },
      {
        name: "description",
        content:
          "30 günlük namaz yarışmasının canlı liderlik tablosu: takım puanları ve gün ilerlemesi anlık olarak burada.",
      },
      { property: "og:title", content: "30 Günlük Namaz Yarışması — Liderlik Tablosu" },
      {
        property: "og:description",
        content: "Takımların günlük puanları ve canlı sıralama.",
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

const medal = ["🥇", "🥈", "🥉"];

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
    <main className="min-h-screen bg-background pb-16">
      <header className="bg-hero-gradient px-5 pb-10 pt-10 text-primary-foreground">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.25em] opacity-80">30 Günlük Yarışma</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            Namaz Yarışması
          </h1>

          <div className="mt-7 rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
            <div className="flex items-end justify-between text-sm">
              <span className="font-medium">
                {day}. Gün <span className="opacity-70">/ {CONTEST_DAYS}</span>
              </span>
              <span className="opacity-80">{remaining} gün kaldı</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-primary-foreground/20">
              <div
                className="h-full rounded-full bg-gold-gradient transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs opacity-75">%{pct} tamamlandı</p>
          </div>
        </div>
      </header>

      <section className="mx-auto -mt-6 max-w-2xl px-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Trophy className="h-5 w-5 text-gold" aria-hidden />
            Liderlik Tablosu
          </h2>

          {active.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz aktif takım yok.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {active.map((team, i) => (
                <li
                  key={team.id}
                  className={`rounded-2xl border p-3.5 transition-colors ${
                    i === 0
                      ? "border-gold/60 bg-gold/10"
                      : "border-border bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 shrink-0 text-center text-base font-bold text-muted-foreground">
                      {medal[i] ?? i + 1}
                    </span>
                    <span className="flex-1 truncate font-semibold text-foreground">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-lg font-bold tabular-nums text-primary">
                      {team.total_score}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
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

        <div className="mt-8 text-center">
          <Link
            to="/kaptan"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            Kaptan Girişi
          </Link>
        </div>
      </section>
    </main>
  );
}
