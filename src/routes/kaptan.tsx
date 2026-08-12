import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useLayoutEffect, useRef } from "react";
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
import { PinGate } from "@/components/pin-gate";
import { toast } from "sonner";
import { ArrowLeft, Moon, Sun, Minus, Plus, Calendar as CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/kaptan")({
  head: () => ({
    meta: [
      { title: "Kaptan Girişi — Namaz Yarışması" },
      {
        name: "description",
        content: "Takım kaptanları için günlük puan girişi ekranı.",
      },
      { property: "og:title", content: "Kaptan Girişi — Namaz Yarışması" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaptainPage,
});

// Sadece Yatsı, Sabah, İşrak ibadetleri filtrelemesi
const NIGHT_PRAYERS = PRAYERS.filter((p) => p.key === "isha"); // Sadece Yatsı
const DAY_PRAYERS = PRAYERS.filter((p) => ["fajr", "ishraq"].includes(p.key)); // Sabah ve İşrak

// Miladi Tarih Hesaplayıcıları (Gece Bloğu için bir önceki günü bulur)
function getPreviousGregorianDate(isoString: string) {
  const d = new Date(isoString);
  d.setDate(d.getDate() - 1);
  return formatTR(d.toISOString().split("T")[0]);
}

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
    <main className="min-h-screen bg-slate-100 flex justify-center font-sans text-slate-900 sm:py-6">
      <div className="w-full max-w-md bg-[#f8fafc] min-h-screen sm:min-h-[850px] sm:rounded-[40px] relative flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* HEADER */}
        <header className="bg-[#1b5e3a] px-5 py-4 text-white flex justify-between items-center z-10 sm:rounded-t-[40px]">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-1 -ml-1 opacity-80 hover:opacity-100">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-[17px] font-bold leading-tight">Sağduyulular Camide</h1>
              <p className="text-[12px] text-emerald-100 opacity-90 font-medium tracking-wide">Kaptan Paneli</p>
            </div>
          </div>
        </header>

        {unlocked ? (
          <CaptainDashboard />
        ) : (
          <div className="p-5 mt-10">
            <PinGate
              role="captain" // ZodError'u çözen eklenti
              title="Yetki Doğrulama"
              description="4 haneli kaptan PIN kodunu girin."
              onSuccess={() => setUnlocked(true)}
            />
          </div>
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
  
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState(islamicToday);
  const [counts, setCounts] = useState<PrayerCounts>(emptyCounts());
  const [saving, setSaving] = useState(false);

  const selectedTeam = teamId || activeTeams[0]?.id || "";
  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const total = computeScore(counts);

  // Mıknatıs efekti: Seçili güne kaydır
  useLayoutEffect(() => {
    const el = dateScrollerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('[aria-pressed="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
    toast.success(`${formatTR(date)} için ${total} puan kaydedildi.`);
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["scores", selectedTeam] });
  }

  function step(key: PrayerKey, delta: number, e: React.MouseEvent) {
    e.preventDefault();
    setCounts((c) => ({ ...c, [key]: Math.max((c[key] || 0) + delta, 0) }));
  }

  return (
    <form onSubmit={save} className="flex flex-col h-full flex-1">
      
      {/* HIZLI TARİH SEÇİCİ */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div 
          ref={dateScrollerRef}
          className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1"
        >
          {dates.map((d, index) => {
            const isSel = d === date;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={isSel}
                onClick={() => setDate(d)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                  isSel
                    ? "bg-[#1b5e3a] text-white border-[#1b5e3a] shadow-md" 
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {index + 1}. Gün {d === islamicToday && <span className="ml-1 text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-100">AKTİF</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAKIM SEÇİMİ */}
      <div className="bg-white px-5 py-4 border-b border-slate-200">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Takım</span>
        <div className="flex gap-2 flex-wrap">
          {activeTeams.map((t) => {
            const isSel = t.id === selectedTeam;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamId(t.id)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all border ${
                  isSel
                    ? "bg-slate-800 text-white border-slate-800 shadow-md"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* İÇERİK: GECE VE GÜNDÜZ BLOKLARI */}
      <div className="flex-1 p-4 pb-28 space-y-5 overflow-y-auto">
        
        {/* İslami Gün Başlığı */}
        <div className="text-center mb-6 mt-2">
          <h2 className="text-2xl font-black text-slate-800">Yarışmanın {dates.indexOf(date) + 1}. Günü</h2>
          <div className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full mt-2 border border-emerald-100">
            <CalendarIcon className="w-4 h-4" /> {formatHijriTR(date)}
          </div>
        </div>

        {/* 1. BLOK: GECE (YATSI) */}
        <div className="rounded-[24px] overflow-hidden shadow-lg border border-indigo-900/50">
          <div className="bg-gradient-to-r from-indigo-950 to-slate-900 px-5 py-4 text-indigo-50 border-b border-indigo-800/50">
            <div className="flex justify-between items-center mb-1">
              <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-wide text-indigo-100">
                <Moon className="w-5 h-5" /> Gece Vakti
              </span>
            </div>
            <p className="text-[13px] font-medium text-indigo-300">
              <span className="font-bold text-indigo-100">{getPreviousGregorianDate(date)}</span> akşam ezanından itibaren
            </p>
          </div>

          <div className="bg-indigo-950 px-5 py-4 space-y-3">
            {NIGHT_PRAYERS.map(prayer => (
              <div key={prayer.key} className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-bold text-white">{prayer.label}</p>
                  <p className="text-[11px] font-semibold text-indigo-300">{prayer.points} puan</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={(e) => step(prayer.key, -1, e)} className="w-10 h-10 rounded-full bg-indigo-900 text-indigo-200 flex items-center justify-center active:bg-indigo-800 border border-indigo-700/50">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-xl font-bold text-white tabular-nums">{counts[prayer.key] || 0}</span>
                  <button type="button" onClick={(e) => step(prayer.key, 1, e)} className="w-10 h-10 rounded-full bg-indigo-900 text-indigo-200 flex items-center justify-center active:bg-indigo-800 border border-indigo-700/50">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. BLOK: GÜNDÜZ (SABAH, İŞRAK) */}
        <div className="rounded-[24px] overflow-hidden shadow-lg border border-sky-200/60">
          <div className="bg-gradient-to-r from-sky-400 to-sky-500 px-5 py-4 text-white border-b border-sky-300">
            <div className="flex justify-between items-center mb-1">
              <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-wide">
                <Sun className="w-5 h-5" /> Gündüz Vakti
              </span>
            </div>
            <p className="text-[13px] font-medium text-sky-50">
              <span className="font-bold text-white">{formatTR(date)}</span> işrak vaktine kadar
            </p>
          </div>

          <div className="bg-sky-50 px-5 py-4 space-y-3">
            {DAY_PRAYERS.map((prayer, idx) => (
              <div key={prayer.key} className={`flex items-center justify-between pb-3 ${idx !== DAY_PRAYERS.length - 1 ? 'border-b border-sky-200/60' : ''}`}>
                <div>
                  <p className="text-[15px] font-bold text-sky-950">{prayer.label}</p>
                  <p className="text-[11px] font-bold text-sky-600">{prayer.points} puan</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={(e) => step(prayer.key, -1, e)} className="w-10 h-10 rounded-full bg-white text-sky-600 flex items-center justify-center active:bg-sky-100 shadow-sm border border-sky-100">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-xl font-bold text-sky-950 tabular-nums">{counts[prayer.key] || 0}</span>
                  <button type="button" onClick={(e) => step(prayer.key, 1, e)} className="w-10 h-10 rounded-full bg-white text-sky-600 flex items-center justify-center active:bg-sky-100 shadow-sm border border-sky-100">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ALT BAR (SABİT KAYDETME ALANI) */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-safe flex items-center gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] sm:rounded-b-[40px]">
        <div className="flex flex-col pl-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Günlük Toplam</span>
          <span className="text-2xl font-black text-[#1b5e3a] leading-none tabular-nums mt-0.5">{total} <span className="text-sm font-bold text-slate-400">puan</span></span>
        </div>
        <button 
          type="submit"
          disabled={saving || !selectedTeam}
          className="flex-1 h-14 bg-[#1b5e3a] hover:bg-[#15462b] text-white rounded-2xl font-bold text-[16px] shadow-[0_4px_15px_rgba(27,94,58,0.3)] active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Puanları Kaydet"}
        </button>
      </div>

    </form>
  );
}
