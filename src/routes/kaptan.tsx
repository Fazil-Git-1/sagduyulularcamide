import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, teamScoresQuery } from "@/lib/queries";
import {
  CAPTAIN_PIN,
  PRAYERS,
  computeScore,
  emptyCounts,
  formatHijriTR,
  formatTR,
  selectableDates,
  todayISO,
  type PrayerCounts,
  type PrayerKey,
} from "@/lib/contest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinGate } from "@/components/pin-gate";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/kaptan")({
  head: () => ({
    meta: [
      { title: "Kaptan Girişi — Namaz Yarışması" },
      {
        name: "description",
        content: "Takım kaptanları için günlük puan girişi ekranı.",
      },
      { property: "og:title", content: "Kaptan Girişi — Namaz Yarışması" },
      {
        property: "og:description",
        content: "PIN ile giriş yaparak günlük puanları kaydedin.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaptainPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      Sayfa yüklenemedi: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Bulunamadı.</div>,
});

function CaptainPage() {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <header className="bg-hero-gradient px-4 py-4 text-primary-foreground sm:px-5 sm:py-6">
        <div className="mx-auto grid max-w-2xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <Link
            to="/"
            className="grid h-11 w-11 place-items-center rounded-full opacity-90 transition-opacity active:opacity-60"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
            <span className="sr-only">Ana ekrana dön</span>
          </Link>
          <div className="min-w-0">
            <span className="block truncate text-base font-extrabold tracking-tight sm:text-lg">
              Sağduyulular Camide
            </span>
            <h1 className="text-xs opacity-80">Kaptan Paneli</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-3 py-5 sm:px-4 sm:py-6">
        {unlocked ? (
          <CaptainDashboard />
        ) : (
          <PinGate
            pin={CAPTAIN_PIN}
            title="Yetki Doğrulama"
            description="4 haneli kaptan PIN kodunu girin."
            onSuccess={() => setUnlocked(true)}
          />
        )}
      </div>
    </main>
  );
}

function CaptainDashboard() {
  const queryClient = useQueryClient();
  const { data: teams } = useSuspenseQuery(teamsQuery);

  useEffect(() => {
    const channel = supabase
      .channel("captain-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return <ScoreForm teams={teams} />;
}

type Team = { id: string; name: string; is_active: boolean; total_score: number };

function ScoreForm({ teams }: { teams: Team[] }) {
  const queryClient = useQueryClient();
  const activeTeams = teams.filter((t) => t.is_active);
  // Chronological order: oldest on the left, today on the right.
  const dates = [...selectableDates()].reverse();
  const dateScrollerRef = useRef<HTMLDivElement | null>(null);
  const [date, setDate] = useState(todayISO());
  const [teamId, setTeamId] = useState("");
  const [counts, setCounts] = useState<PrayerCounts>(emptyCounts());
  const [saving, setSaving] = useState(false);

  const selectedTeam = teamId || activeTeams[0]?.id || "";
  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const entered = new Map(entries.map((e) => [e.date, e.score]));
  const total = computeScore(counts);

  useLayoutEffect(() => {
    const el = dateScrollerRef.current;
    if (!el) return;
    // Today's button is the last item — jump straight to it on first load.
    el.scrollLeft = el.scrollWidth;
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    let cancelled = false;
    supabase
      .from("scores")
      .select("fajr_count, isha_count, ishraq_count")
      .eq("team_id", selectedTeam)
      .eq("date", date)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCounts(
          data
            ? {
                fajr_count: data.fajr_count ?? 0,
                isha_count: data.isha_count ?? 0,
                ishraq_count: data.ishraq_count ?? 0,
              }
            : emptyCounts(),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTeam, date]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    const { error } = await supabase
      .from("scores")
      .upsert({ team_id: selectedTeam, date, ...counts, score: total }, {
        onConflict: "team_id,date",
      });
    setSaving(false);
    if (error) {
      toast.error("Kaydedilemedi: " + error.message);
      return;
    }
    toast.success(`Kaydedildi — ${total} puan.`);
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["scores", selectedTeam] });
  }

  function step(key: PrayerKey, delta: number) {
    setCounts((c) => ({ ...c, [key]: Math.max((c[key] || 0) + delta, 0) }));
  }


  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-3 shadow-soft">
        <Label className="text-sm">Tarih</Label>

        <div
          ref={dateScrollerRef}
          className="-mx-4 mt-2 snap-x snap-mandatory overflow-x-auto px-4 pb-1 scroll-smooth"
        >
          <div className="flex gap-2">
            {dates.map((d) => {
                const has = entered.has(d);
                const isSel = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    aria-pressed={isSel}
                    aria-label={`${formatTR(d)}${has ? " puan girildi" : " puan girilmedi"}`}
                    className={`flex h-14 w-11 shrink-0 snap-center flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold tabular-nums transition-colors ${
                      isSel
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary/40 text-foreground"
                    }`}
                  >
                    {Number(d.slice(-2))}
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        has
                          ? isSel
                            ? "bg-gold"
                            : "bg-primary"
                          : isSel
                            ? "bg-primary-foreground/30"
                            : "bg-muted-foreground/30"
                      }`}
                    />
                  </button>
              );
            })}
          </div>
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground">
          {formatTR(date)}
          {date === todayISO() ? " (Bugün)" : ""}
          {entered.has(date) ? ` — kayıtlı: ${entered.get(date)} puan` : " — puan girilmedi"}
        </p>
        <p className="mt-0.5 text-xs font-medium text-primary/70">{formatHijriTR(date)}</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <Label className="text-sm">Takım</Label>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeTeams.map((t) => {
            const isSel = t.id === selectedTeam;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamId(t.id)}
                aria-pressed={isSel}
                className={`min-h-11 max-w-full truncate rounded-full border px-4 text-sm font-semibold transition-colors ${
                  isSel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-foreground"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <Label className="text-sm">Kılınan namazlar (kişi sayısı)</Label>
        <div className="mt-3 space-y-3">
          {PRAYERS.map((p) => (
            <div key={p.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-primary tabular-nums">
                  {p.points}p
                </span>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => step(p.key, -1)}
                  aria-label={`${p.label} kişi sayısını azalt`}
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <Input
                  id={p.key}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={String(counts[p.key])}
                  onChange={(e) =>
                    setCounts((c) => ({
                      ...c,
                      [p.key]: Math.max(Number(e.target.value) || 0, 0),
                    }))
                  }
                  placeholder="0"
                  aria-label={`${p.label} kişi sayısı`}
                  className="h-12 min-w-0 text-center text-lg font-bold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => step(p.key, 1)}
                  aria-label={`${p.label} kişi sayısını artır`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-2xl bg-secondary/50 px-3 py-2 text-center text-sm font-bold text-foreground tabular-nums">
          Günlük toplam: {total} puan
        </p>
      </div>


      <div className="sticky bottom-0 -mx-3 bg-gradient-to-t from-background via-background to-transparent px-3 pb-safe pt-3 sm:static sm:mx-0 sm:bg-none sm:px-0 sm:pt-0">
        <Button
          type="submit"
          className="h-12 w-full text-base"
          disabled={saving || !selectedTeam}
        >
          {saving ? "Kaydediliyor…" : "Kaydet / Güncelle"}
        </Button>
      </div>
    </form>
  );
}
