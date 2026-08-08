import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery, teamScoresQuery } from "@/lib/queries";
import { CAPTAIN_PIN, formatTR, selectableDates, todayISO } from "@/lib/contest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Lock, Plus, RotateCcw } from "lucide-react";

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
    <main className="min-h-screen bg-background">
      <header className="bg-hero-gradient px-5 py-6 text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/" className="opacity-80 transition-opacity hover:opacity-100">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            <span className="sr-only">Ana ekrana dön</span>
          </Link>
          <div>
            <span className="block text-lg font-extrabold tracking-tight">
              Sağduyulular Camide
            </span>
            <h1 className="text-xs opacity-80">Kaptan Paneli</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {unlocked ? <CaptainDashboard /> : <PinGate onSuccess={() => setUnlocked(true)} />}
      </div>
    </main>
  );
}

function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === CAPTAIN_PIN) {
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-soft"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Lock className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">Yetki Doğrulama</h2>
      <p className="mt-1 text-sm text-muted-foreground">4 haneli kaptan PIN kodunu girin.</p>
      <Input
        inputMode="numeric"
        maxLength={4}
        value={pin}
        autoFocus
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ""));
          setError(false);
        }}
        className="mt-5 text-center text-2xl tracking-[0.6em]"
        placeholder="••••"
        aria-label="PIN kodu"
      />
      {error && <p className="mt-2 text-sm text-destructive">Hatalı PIN kodu.</p>}
      <Button type="submit" className="mt-5 w-full" disabled={pin.length !== 4}>
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
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="score">Puan Girişi</TabsTrigger>
        <TabsTrigger value="teams">Takım Yönetimi</TabsTrigger>
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
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTeam = teamId || activeTeams[0]?.id || "";
  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const entered = new Map(entries.map((e) => [e.date, e.score]));

  useEffect(() => {
    if (!selectedTeam) return;
    let cancelled = false;
    supabase
      .from("scores")
      .select("score")
      .eq("team_id", selectedTeam)
      .eq("date", date)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setScore(data ? String(data.score) : "");
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
      .upsert(
        { team_id: selectedTeam, date, score: Number(score) || 0 },
        { onConflict: "team_id,date" },
      );
    setSaving(false);
    if (error) {
      toast.error("Kaydedilemedi: " + error.message);
      return;
    }
    toast.success("Puan kaydedildi.");
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["scores", selectedTeam] });
  }


  return (
    <form
      onSubmit={save}
      className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="space-y-2">
        <Label htmlFor="date">Tarih</Label>
        <select
          id="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {entered.has(d) ? "● " : "○ "}
              {formatTR(d)}
              {d === todayISO() ? " (Bugün)" : ""}
              {entered.has(d) ? ` — ${entered.get(d)} puan` : ""}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {dates
            .slice()
            .reverse()
            .map((d) => {
              const has = entered.has(d);
              const isSel = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  title={`${formatTR(d)}${has ? ` — ${entered.get(d)} puan` : " — puan girilmedi"}`}
                  aria-label={`${formatTR(d)}${has ? " puan girildi" : " puan girilmedi"}`}
                  className={`h-6 w-6 rounded-full text-[10px] font-semibold tabular-nums transition-colors ${
                    has
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  } ${isSel ? "ring-2 ring-gold ring-offset-1 ring-offset-card" : ""}`}
                >
                  {Number(d.slice(-2))}
                </button>
              );
            })}
        </div>
        <p className="text-xs text-muted-foreground">
          Dolu daireler puan girilen günleri gösterir.
        </p>
      </div>


      <div className="space-y-2">
        <Label htmlFor="team">Takım</Label>
        <select
          id="team"
          value={selectedTeam}
          onChange={(e) => setTeamId(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          {activeTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="score">Puan</Label>
        <Input
          id="score"
          type="number"
          inputMode="numeric"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0"
          className="h-11"
        />
      </div>

      <Button type="submit" className="h-11 w-full" disabled={saving || !selectedTeam}>
        {saving ? "Kaydediliyor…" : "Kaydet / Güncelle"}
      </Button>
    </form>
  );
}

function TeamManager({ teams }: { teams: Team[] }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [resetting, setResetting] = useState(false);

  async function resetSystem() {
    if (
      !window.confirm(
        "Tüm puanlar silinecek ve yarışma 1. Güne dönecek. Devam edilsin mi?",
      )
    )
      return;
    setResetting(true);
    const del = await supabase
      .from("scores")
      .delete()
      .not("id", "is", null);
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
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Takımlar</h2>
        <ul className="space-y-3">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center gap-3">
              <Input
                defaultValue={team.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== team.name) rename(team.id, v);
                }}
                className="h-10 flex-1"
                aria-label={`${team.name} adı`}
              />
              <Switch
                checked={team.is_active}
                onCheckedChange={(v) => toggle(team.id, v)}
                aria-label={`${team.name} aktif`}
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
        className="flex gap-2 rounded-3xl border border-border bg-card p-5 shadow-soft"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yeni takım adı"
          className="h-10"
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          <span className="sr-only">Takım ekle</span>
        </Button>
      </form>

      <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Tehlikeli Alan
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tüm günlük puanlar silinir, takım toplamları sıfırlanır ve yarışma 1. Güne
          döner. Bu işlem geri alınamaz.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4 h-11 w-full"
          disabled={resetting}
          onClick={resetSystem}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          {resetting ? "Sıfırlanıyor…" : "Sistemi Sıfırla"}
        </Button>
      </div>
    </div>

  );
}
