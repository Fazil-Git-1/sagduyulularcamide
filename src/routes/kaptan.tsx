import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, teamScoresQuery } from "@/lib/queries";
import { useServerFn } from "@tanstack/react-start";
import { saveScore } from "@/lib/contest.functions";
import {
  PRAYERS,
  computeScore,
  emptyCounts,
  formatLongTR,
  formatTR,
  hijriLabel,
  prevISO,
  selectableDates,
  todayISO,
  type PrayerCounts,
  type PrayerKey,
} from "@/lib/contest";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PinGate } from "@/components/pin-gate";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Minus, Moon, Plus, Sun } from "lucide-react";

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

type Team = { id: string; name: string; is_active: boolean; total_score: number };

function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-hero-gradient px-4 py-3 text-primary-foreground sm:px-5 sm:py-4">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Link
          to="/"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full opacity-90 transition-opacity active:opacity-60"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          <span className="sr-only">Ana ekrana dön</span>
        </Link>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-base font-extrabold tracking-tight sm:text-lg">
            Sağduyulular Camide
          </span>
          <h1 className="text-xs opacity-80">Kaptan Paneli</h1>
        </div>
        {children}
      </div>
    </header>
  );
}

function CaptainPage() {
  const [pin, setPin] = useState<string | null>(null);

  if (pin === null) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background">
        <PageHeader />
        <div className="mx-auto max-w-2xl px-3 py-5 sm:px-4 sm:py-6">
          <PinGate
            role="captain"
            title="Yetki Doğrulama"
            description="4 haneli kaptan PIN kodunu girin."
            onSuccess={setPin}
          />
        </div>
      </main>
    );
  }

  return <CaptainDashboard pin={pin} />;
}

function CaptainDashboard({ pin }: { pin: string }) {
  const queryClient = useQueryClient();
  const { data: teams } = useSuspenseQuery(teamsQuery);
  const activeTeams = teams.filter((t) => t.is_active);
  const [teamId, setTeamId] = useState("");
  const selectedTeam = teamId || activeTeams[0]?.id || "";

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <PageHeader>
        <Select value={selectedTeam} onValueChange={setTeamId}>
          <SelectTrigger
            aria-label="Takım seç"
            className="h-10 w-[9.5rem] shrink-0 rounded-full border-primary-foreground/25 bg-primary-foreground/10 text-sm font-semibold text-primary-foreground"
          >
            <SelectValue placeholder="Takım" />
          </SelectTrigger>
          <SelectContent>
            {activeTeams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>
      <ScoreForm teams={activeTeams} selectedTeam={selectedTeam} pin={pin} />
    </main>
  );
}

function ScoreForm({
  teams,
  selectedTeam,
  pin,
}: {
  teams: Team[];
  selectedTeam: string;
  pin: string;
}) {
  const queryClient = useQueryClient();
  const submitScore = useServerFn(saveScore);

  // Yarışmanın başlangıç tarihi (bu tarihten öncesi listelenmez).
  const START_DATE = "2026-08-09";

  const dates = [...selectableDates()].filter((d) => d >= START_DATE).reverse();

  const dateRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [date, setDate] = useState(todayISO());
  const [counts, setCounts] = useState<PrayerCounts>(emptyCounts());
  const [saving, setSaving] = useState(false);

  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const entered = new Map(entries.map((e) => [e.date, e.score]));
  const total = computeScore(counts);
  const dayIndex = dates.indexOf(date) + 1;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      dateRefs.current[date]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [date, selectedTeam]);

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
    try {
      await submitScore({ data: { pin, team_id: selectedTeam, date, ...counts } });
    } catch (err) {
      setSaving(false);
      toast.error("Kaydedilemedi: " + (err as Error).message);
      return;
    }
    setSaving(false);
    toast.success(`Kaydedildi — ${total} puan.`);
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["scores", selectedTeam] });
  }

  function step(key: PrayerKey, delta: number) {
    setCounts((c) => ({ ...c, [key]: Math.max((c[key] || 0) + delta, 0) }));
  }

  const nightPrayers = PRAYERS.filter((p) => p.phase === "night");
  const dayPrayers = PRAYERS.filter((p) => p.phase === "day");

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl">
      {/* Gün şeridi */}
      <div className="sticky top-[4.25rem] z-10 border-b border-border bg-card/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex gap-2 overflow-x-auto pb-1">
          {dates.map((d, i) => {
            const isSel = d === date;
            const isToday = d === todayISO();
            const has = entered.has(d);
            return (
              <button
                key={d}
                ref={(el) => {
                  dateRefs.current[d] = el;
                }}
                type="button"
                onClick={() => setDate(d)}
                aria-pressed={isSel}
                aria-label={`${i + 1}. Gün — ${formatTR(d)}${has ? ", puan girildi" : ""}`}
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                  isSel
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card text-muted-foreground active:bg-secondary/60"
                }`}
              >
                <span className="tabular-nums">{i + 1}. Gün</span>
                {isToday && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide ${
                      isSel ? "bg-primary-foreground/20" : "bg-secondary text-primary"
                    }`}
                  >
                    BUGÜN
                  </span>
                )}
                {has && !isToday && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSel ? "bg-primary-foreground" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 px-3 pb-40 pt-5 sm:px-4">
        {/* Hicri gün başlığı */}
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            {dayIndex}. Gün Puanları
          </h2>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-bold text-primary">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {hijriLabel(date)}
          </div>
          {!selectedTeam && (
            <p className="mt-2 text-xs text-muted-foreground">Önce yukarıdan takım seçin.</p>
          )}
        </div>

        {/* Gece bloğu */}
        <section className="overflow-hidden rounded-3xl border border-primary/30 shadow-soft">
          <div className="bg-hero-gradient px-5 py-4 text-primary-foreground">
            <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-wide">
              <Moon className="h-5 w-5" aria-hidden /> Gece Vakti
            </span>
            <p className="mt-1 text-[13px] font-medium opacity-85">
              <span className="font-bold opacity-100">{formatLongTR(prevISO(date))}</span> akşam
              ezanından itibaren
            </p>
          </div>
          <div className="space-y-3 bg-primary/95 px-5 py-4">
            {nightPrayers.map((p) => (
              <PrayerRow
                key={p.key}
                label={p.label}
                points={p.points}
                value={counts[p.key]}
                onStep={(delta) => step(p.key, delta)}
                tone="night"
              />
            ))}
          </div>
        </section>

        {/* Gündüz bloğu */}
        <section className="overflow-hidden rounded-3xl border border-accent/40 shadow-soft">
          <div className="bg-accent px-5 py-4 text-accent-foreground">
            <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-wide">
              <Sun className="h-5 w-5" aria-hidden /> Gündüz Vakti
            </span>
            <p className="mt-1 text-[13px] font-medium opacity-85">
              <span className="font-bold opacity-100">{formatLongTR(date)}</span> ikindi ezanına
              kadar
            </p>
          </div>
          <div className="space-y-3 bg-accent/15 px-5 py-4">
            {dayPrayers.map((p) => (
              <PrayerRow
                key={p.key}
                label={p.label}
                points={p.points}
                value={counts[p.key]}
                onStep={(delta) => step(p.key, delta)}
                tone="day"
              />
            ))}
          </div>
        </section>

        {teams.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Aktif takım bulunamadı.</p>
        )}
      </div>

      {/* Sabit alt bar */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 py-3 shadow-[0_-10px_20px_hsl(0_0%_0%/0.06)]">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Günlük Toplam
            </span>
            <span className="mt-0.5 text-2xl font-black leading-none text-primary tabular-nums">
              {total}{" "}
              <span className="text-sm font-bold text-muted-foreground">puan</span>
            </span>
          </div>
          <Button
            type="submit"
            disabled={saving || !selectedTeam}
            className="h-14 flex-1 rounded-2xl text-base font-bold"
          >
            {saving ? "Kaydediliyor…" : "Puanları Kaydet"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function PrayerRow({
  label,
  points,
  value,
  onStep,
  tone,
}: {
  label: string;
  points: number;
  value: number;
  onStep: (delta: number) => void;
  tone: "night" | "day";
}) {
  const isNight = tone === "night";
  const textMain = isNight ? "text-primary-foreground" : "text-foreground";
  const textSub = isNight ? "text-primary-foreground/70" : "text-primary";
  const btn = isNight
    ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground active:bg-primary-foreground/20"
    : "border-border bg-card text-primary active:bg-secondary";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`truncate text-[15px] font-bold ${textMain}`}>{label}</p>
        <p className={`text-[11px] font-semibold ${textSub}`}>{points} puan</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => onStep(-1)}
          aria-label={`${label} azalt`}
          className={`grid h-11 w-11 place-items-center rounded-full border transition-colors ${btn}`}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className={`w-7 text-center text-xl font-bold tabular-nums ${textMain}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => onStep(1)}
          aria-label={`${label} artır`}
          className={`grid h-11 w-11 place-items-center rounded-full border transition-colors ${btn}`}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
