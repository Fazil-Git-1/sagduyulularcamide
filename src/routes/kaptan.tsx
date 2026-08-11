import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, teamScoresQuery } from "@/lib/queries";
import {
  CAPTAIN_PIN,
  PRAYERS,
  computeScore,
  emptyCounts,
  formatTR,
  selectableDates,
  todayISO,
  type PrayerCounts,
  type PrayerKey,
} from "@/lib/contest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Lock, Minus, Plus, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/kaptan")({
  head: () => ({
    meta: [
      { title: "Kaptan Girişi — Namaz Yarışması" },
      {
        name: "description",
        content: "Takım kaptanları için puan girişi ve takım yönetimi ekranı.",
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
        {unlocked ? <CaptainDashboard /> : <PinGate onSuccess={() => setUnlocked(true)} />}
      </div>
    </main>
  );
}

function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function check(next: string[]) {
    if (next.join("").length !== 4) return;
    if (next.join("") === CAPTAIN_PIN) {
      onSuccess();
    } else {
      setError(true);
      setDigits(["", "", "", ""]);
      refs.current[0]?.focus();
    }
  }

  function setDigit(index: number, raw: string) {
    const value = raw.replace(/\D/g, "");
    setError(false);
    if (!value) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    const next = [...digits];
    // Support paste of the full code.
    value.split("").forEach((ch, k) => {
      if (index + k < 4) next[index + k] = ch;
    });
    setDigits(next);
    const focusAt = Math.min(index + value.length, 3);
    refs.current[focusAt]?.focus();
    check(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        check(digits);
      }}
      className="mx-auto mt-6 max-w-sm rounded-3xl border border-border bg-card p-5 text-center shadow-soft sm:p-6"
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary">
        <Lock className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">Yetki Doğrulama</h2>
      <p className="mt-1 text-sm text-muted-foreground">4 haneli kaptan PIN kodunu girin.</p>

      <div className="mt-5 flex justify-center gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={i === 0}
            maxLength={4}
            aria-label={`PIN ${i + 1}. hane`}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
            className="h-14 w-14 rounded-2xl border border-input bg-background text-center text-2xl font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">Hatalı PIN kodu.</p>}

      <Button
        type="submit"
        className="mt-5 h-12 w-full text-base"
        disabled={digits.join("").length !== 4}
      >
        Giriş Yap
      </Button>
    </form>
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

  return (
    <Tabs defaultValue="score">
      <TabsList className="grid h-12 w-full grid-cols-2">
        <TabsTrigger value="score" className="h-10 text-sm">
          Puan Girişi
        </TabsTrigger>
        <TabsTrigger value="teams" className="h-10 text-sm">
          Takım Yönetimi
        </TabsTrigger>
      </TabsList>
      <TabsContent value="score" className="mt-4">
        <ScoreForm teams={teams} />
      </TabsContent>
      <TabsContent value="teams" className="mt-4">
        <TeamManager teams={teams} />
      </TabsContent>
    </Tabs>
  );
}

type Team = { id: string; name: string; is_active: boolean; total_score: number };

function ScoreForm({ teams }: { teams: Team[] }) {
  const queryClient = useQueryClient();
  const activeTeams = teams.filter((t) => t.is_active);
  const dates = selectableDates();
  const [date, setDate] = useState(todayISO());
  const [teamId, setTeamId] = useState("");
  const [counts, setCounts] = useState<PrayerCounts>(emptyCounts());
  const [saving, setSaving] = useState(false);

  const selectedTeam = teamId || activeTeams[0]?.id || "";
  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const entered = new Map(entries.map((e) => [e.date, e.score]));
  const total = computeScore(counts);

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
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <Label className="text-sm">Tarih</Label>

        <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
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
                    className={`flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold tabular-nums transition-colors ${
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

        <p className="mt-2 text-xs text-muted-foreground">
          {formatTR(date)}
          {date === todayISO() ? " (Bugün)" : ""}
          {entered.has(date) ? ` — kayıtlı: ${entered.get(date)} puan` : " — puan girilmedi"}
        </p>
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

function TeamManager({ teams }: { teams: Team[] }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [resetting, setResetting] = useState(false);

  async function resetSystem() {
    setResetting(true);
    const del = await supabase.from("scores").delete().not("id", "is", null);
    if (del.error) {
      setResetting(false);
      toast.error("Sıfırlanamadı: " + del.error.message);
      return;
    }
    await supabase.from("teams").update({ total_score: 0 }).not("id", "is", null);
    const upd = await supabase
      .from("contest_settings")
      .update({ start_date: todayISO() })
      .eq("id", 1);
    setResetting(false);
    if (upd.error) {
      toast.error("Tarih sıfırlanamadı: " + upd.error.message);
      return;
    }
    toast.success("Sistem sıfırlandı. Yarışma 1. Günden başlıyor.");
    queryClient.invalidateQueries();
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  async function rename(id: string, name: string) {
    const { error } = await supabase.from("teams").update({ name }).eq("id", id);
    if (error) toast.error("Güncellenemedi: " + error.message);
    else refresh();
  }

  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("teams").update({ is_active }).eq("id", id);
    if (error) toast.error("Güncellenemedi: " + error.message);
    else {
      toast.success(is_active ? "Takım aktif edildi." : "Takım pasife alındı.");
      refresh();
    }
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const { error } = await supabase.from("teams").insert({ name: newName.trim() });
    if (error) toast.error("Eklenemedi: " + error.message);
    else {
      setNewName("");
      toast.success("Takım eklendi.");
      refresh();
    }
  }

  return (
    <div className="space-y-4 pb-safe">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Takımlar</h2>
        <ul className="space-y-3">
          {teams.map((team) => (
            <li
              key={team.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            >
              <Input
                defaultValue={team.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== team.name) rename(team.id, v);
                }}
                className="h-11 min-w-0 text-base"
                aria-label={`${team.name} adı`}
              />
              <Switch
                checked={team.is_active}
                onCheckedChange={(v) => toggle(team.id, v)}
                aria-label={`${team.name} aktif`}
                className="shrink-0"
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Pasif takımlar liderlik tablosunda görünmez. İsim değişikliği alandan çıkınca
          kaydedilir.
        </p>
      </div>

      <form
        onSubmit={addTeam}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yeni takım adı"
          className="h-11 min-w-0 text-base"
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="sr-only">Takım ekle</span>
        </Button>
      </form>

      <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Tehlikeli Alan
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tüm günlük puanlar silinir, takım toplamları sıfırlanır ve yarışma 1. Güne
          döner. Bu işlem geri alınamaz.
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="mt-4 h-12 w-full text-base"
              disabled={resetting}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
              {resetting ? "Sıfırlanıyor…" : "Sistemi Sıfırla"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Sistemi sıfırla?</AlertDialogTitle>
              <AlertDialogDescription>
                Tüm puanlar silinecek ve yarışma 1. Güne dönecek. Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="h-11">Vazgeç</AlertDialogCancel>
              <AlertDialogAction
                className="h-11 bg-destructive text-destructive-foreground"
                onClick={resetSystem}
              >
                Evet, sıfırla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
