import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, teamScoresQuery } from "@/lib/queries";
import {
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
import { ArrowLeft, Minus, Plus, Info } from "lucide-react";

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

// Sadece Yatsı, Sabah ve İşrak namazlarını filtrele ve sırala
const ACTIVE_PRAYERS = PRAYERS.filter((p) => ["isha", "fajr", "ishraq"].includes(p.key)).sort((a, b) => {
  const order = ["isha", "fajr", "ishraq"];
  return order.indexOf(a.key) - order.indexOf(b.key);
});

// İslami saat kaydırması: Saat 20:00 ve sonraysa sistemi otomatik ertesi güne atar
function getIslamicActiveDate() {
  const now = new Date();
  if (now.getHours() >= 20) {
    now.setDate(now.getDate() + 1);
  }
  return now.toISOString().split("T")[0];
}

function CaptainPage() {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      {/* Senin orijinal, masaüstü uyumlu, tam genişlik Header'ın */}
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

      {/* Senin orijinal, masaüstünde ortalanan max-w-2xl kapsayıcın */}
      <div className="mx-auto max-w-2xl px-3 py-5 sm:px-4 sm:py-6">
        {unlocked ? (
          <CaptainDashboard />
        ) : (
          <PinGate
            role="captain" // ZodError hatasını kökten çözen role parametresi
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
  const dates = [...selectableDates()].reverse();
  const dateScrollerRef = useRef<HTMLDivElement | null>(null);
  
  const islamicToday = getIslamicActiveDate();
  const [date, setDate] = useState(islamicToday);
  
  const [teamId, setTeamId] = useState("");
  const [counts, setCounts] = useState<PrayerCounts>(emptyCounts());
  const [saving, setSaving] = useState(false);

  const selectedTeam = teamId || activeTeams[0]?.id || "";
  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const entered = new Map(entries.map((e) => [e.date, e.score]));
  const total = computeScore(counts);

  // Takvimde seçili güne otomatik kaydırma efekti (Mıknatıs)
  useLayoutEffect(() => {
    const el = dateScrollerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('[aria-pressed="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      el.scrollLeft = el.scrollWidth;
    }
  }, [date]);

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
      {/* TAKVİM ALANI */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Tarih</Label>
          {date !== islamicToday && (
            <button
              type="button"
              onClick={() => setDate(islamicToday)}
              className="text-xs font-bold text-primary transition-opacity hover:opacity-80"
            >
              Aktif Güne Dön
            </button>
          )}
        </div>

        {/* CSS ile çirkin scrollbar'lar gizlendi (hide-scrollbar) */}
        <div
          ref={dateScrollerRef}
          className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 mt-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 scroll-smooth"
        >
          <div className="flex gap-3">
            {dates.map((d) => {
              const has = entered.has(d);
              const isSel = d === date;
              
              // Hicri metinden (Örn: "5 Rebiülevvel 1448") sadece gün rakamını "5" olarak çıkarıyoruz
              const hijriFull = formatHijriTR(d);
              const hijriDayNumber = hijriFull.split(" ")[0] || Number(d.slice(-2));

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  aria-pressed={isSel}
                  aria-label={`${formatTR(d)}${has ? " puan girildi" : " puan girilmedi"}`}
                  className={`flex h-16 w-14 shrink-0 snap-center flex-col items-center justify-center gap-1.5 rounded-2xl border text-lg font-extrabold tabular-nums transition-all duration-300 ${
                    isSel
                      ? "scale-105 border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-secondary/40 text-foreground opacity-70 hover:opacity-100"
                  }`}
                >
                  {hijriDayNumber}
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

        <div className="mt-4 text-center">
          <p className="text-lg font-bold text-foreground">{formatHijriTR(date)}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            ({formatTR(date)})
            {date === islamicToday ? <span className="text-primary font-bold ml-1">• Aktif Gün</span> : ""}
          </p>
        </div>

        {/* İslami Zaman Bilgi Kutusu */}
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-secondary/50 p-3 border border-border/50">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-xs font-medium leading-relaxed text-muted-foreground">
            İslami gün akşam ezanıyla başlar. Bu form <strong>dün akşamdan</strong> başlayıp, <strong>bugün işrak vaktine</strong> kadar olan (Yatsı, Sabah, İşrak) ibadetlerini kapsar.
          </p>
        </div>
      </div>

      {/* TAKIM SEÇİMİ */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <Label className="text-sm">Takım</Label>
        <div className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mt-3 flex overflow-x-auto gap-2 pb-1">
          {activeTeams.map((t) => {
            const isSel = t.id === selectedTeam;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamId(t.id)}
                aria-pressed={isSel}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  isSel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-foreground hover:bg-secondary/60"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* PUAN GİRİŞ FORMU */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <Label className="text-sm">İbadetler (Kişi Sayısı)</Label>
        <div className="mt-4 space-y-4">
          {ACTIVE_PRAYERS.map((p) => (
            <div key={p.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/50 bg-secondary/20 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">
                  {p.points}p
                </span>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0 rounded-full bg-background"
                  onClick={() => step(p.key, -1)}
                  aria-label={`${p.label} kişi sayısını azalt`}
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <div className="w-16">
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
                    className="h-12 min-w-0 border-0 bg-transparent text-center text-xl font-bold tabular-nums shadow-none focus-visible:ring-0"
                    aria-label={`${p.label} kişi sayısı`}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0 rounded-full bg-background"
                  onClick={() => step(p.key, 1)}
                  aria-label={`${p.label} kişi sayısını artır`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-2xl bg-secondary/50 px-3 py-3 text-center text-sm font-bold text-foreground tabular-nums">
          Günlük toplam: <span className="text-primary text-base">{total}</span> puan
        </p>
      </div>

      <div className="sticky bottom-0 -mx-3 bg-gradient-to-t from-background via-background to-transparent px-3 pb-safe pt-3 sm:static sm:mx-0 sm:bg-none sm:px-0 sm:pt-0">
        <Button
          type="submit"
          className="h-14 w-full rounded-2xl text-base font-bold shadow-md"
          disabled={saving || !selectedTeam}
        >
          {saving ? "Kaydediliyor…" : "Puanları Kaydet"}
        </Button>
      </div>
    </form>
  );
}
