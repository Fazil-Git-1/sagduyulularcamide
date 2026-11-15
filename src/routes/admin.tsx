import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery } from "@/lib/queries";
import { todayISO } from "@/lib/contest";
import { useServerFn } from "@tanstack/react-start";
import {
  addTeam as addTeamFn,
  renameTeam as renameTeamFn,
  resetSystem as resetSystemFn,
  setTeamActive as setTeamActiveFn,
} from "@/lib/contest.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PinGate } from "@/components/pin-gate";
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
import { AlertTriangle, ArrowLeft, Plus, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Namaz Yarışması" },
      {
        name: "description",
        content: "Takım yönetimi ve sistem sıfırlama için yönetici ekranı.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      Sayfa yüklenemedi: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Bulunamadı.</div>,
});

function AdminPage() {
  const [pin, setPin] = useState<string | null>(null);
  const unlocked = pin !== null;
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
            <h1 className="text-xs opacity-80">Yönetici Paneli</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-3 py-5 sm:px-4 sm:py-6">
        {unlocked ? (
          <AdminDashboard pin={pin} />
        ) : (
          <PinGate
            role="admin"
            title="Yönetici Doğrulama"
            description="4 haneli yönetici PIN kodunu girin."
            onSuccess={setPin}
          />
        )}
      </div>
    </main>
  );
}

type Team = { id: string; name: string; is_active: boolean; total_score: number };

function AdminDashboard({ pin }: { pin: string }) {
  const queryClient = useQueryClient();
  const { data: teams } = useSuspenseQuery(teamsQuery);

  useEffect(() => {
    const channel = supabase
      .channel("admin-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return <TeamManager teams={teams} pin={pin} />;
}

function TeamManager({ teams, pin }: { teams: Team[]; pin: string }) {
  const queryClient = useQueryClient();
  const doRename = useServerFn(renameTeamFn);
  const doToggle = useServerFn(setTeamActiveFn);
  const doAdd = useServerFn(addTeamFn);
  const doReset = useServerFn(resetSystemFn);
  const [newName, setNewName] = useState("");
  const [resetting, setResetting] = useState(false);

  async function resetSystem() {
    setResetting(true);
    try {
      await doReset({ data: { pin, start_date: todayISO() } });
    } catch (err) {
      setResetting(false);
      toast.error("Sıfırlanamadı: " + (err as Error).message);
      return;
    }
    setResetting(false);
    toast.success("Sistem sıfırlandı. Yarışma 1. Günden başlıyor.");
    queryClient.invalidateQueries();
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  async function rename(id: string, name: string) {
    try {
      await doRename({ data: { pin, id, name } });
      refresh();
    } catch (err) {
      toast.error("Güncellenemedi: " + (err as Error).message);
    }
  }

  async function toggle(id: string, is_active: boolean) {
    try {
      await doToggle({ data: { pin, id, is_active } });
      toast.success(is_active ? "Takım aktif edildi." : "Takım pasife alındı.");
      refresh();
    } catch (err) {
      toast.error("Güncellenemedi: " + (err as Error).message);
    }
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await doAdd({ data: { pin, name: newName.trim() } });
      setNewName("");
      toast.success("Takım eklendi.");
      refresh();
    } catch (err) {
      toast.error("Eklenemedi: " + (err as Error).message);
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
