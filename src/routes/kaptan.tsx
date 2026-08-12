import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { PinGate } from "@/components/pin-gate";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Info, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";

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

// Sadece istenen namazları filtrele ve İslami kronolojiye göre sırala (Yatsı, Sabah, İşrak)
const ACTIVE_PRAYERS = PRAYERS.filter((p) => ['isha', 'fajr', 'ishraq'].includes(p.key)).sort((a, b) => {
  const order = ['isha', 'fajr', 'ishraq'];
  return order.indexOf(a.key) - order.indexOf(b.key);
});

// İslami saat kaydırması: Saat 20:00 ve sonraysa sistemi 1 gün ileri atar
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
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen relative flex flex-col shadow-xl border-x border-slate-200">
        
        {/* YENİ HEADER TASARIMI */}
        <header className="bg-[#1b5e3a] px-5 py-4 text-white flex justify-between items-center z-20 shadow-md">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-1 -ml-1 opacity-80 hover:opacity-100 transition-opacity">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-[17px] font-bold leading-tight">Sağduyulular Camide</h1>
              <p className="text-[12px] text-emerald-200 font-medium tracking-wide">Kaptan Paneli</p>
            </div>
          </div>
        </header>

        {unlocked ? (
          <CaptainDashboard />
        ) : (
          <div className="p-5 mt-10">
            <PinGate
              role="captain" // HATA BURADAYDI! 'pin' yerine 'role' gönderiyoruz.
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
  
  const islamicToday = getIslamicActiveDate();
  
  // UX Durum Yönetimi
  const [activeTab, setActiveTab] = useState<'today' | 'past'>('today');
  const [expandedPastDate, setExpandedPastDate] = useState<string | null>(null);
  
  // Veri Durum Yönetimi
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState(islamicToday);
  const [counts, setCounts] = useState<PrayerCounts>(emptyCounts());
  const [saving, setSaving] = useState(false);

  const selectedTeam = teamId || activeTeams[0]?.id || "";
  const { data: entries = [] } = useQuery(teamScoresQuery(selectedTeam));
  const entered = new Map(entries.map((e) => [e.date, e.score]));
  const total = computeScore(counts);

  // Sekme veya akordeon değiştiğinde Supabase'den çekilecek "hedef tarihi" ayarla
  useEffect(() => {
    if (activeTab === 'today') {
      setDate(islamicToday);
      setExpandedPastDate(null);
    } else if (activeTab === 'past' && expandedPastDate) {
      setDate(expandedPastDate);
    }
  }, [activeTab, islamicToday, expandedPastDate]);

  // Seçili tarih veya takım değiştiğinde Supabase'den puanları çek
  useEffect(() => {
    if (!selectedTeam || !date) return;
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
  }, [selectedTeam, date, activeTab]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeam || !date) return;
    setSaving(true);
    
    // Senin orijinal Supabase kaydetme mantığın aynen korundu
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
    
    // Geçmiş kaydı yapıldıysa akordeonu otomatik kapat
    if (activeTab === 'past') {
      setExpandedPastDate(null);
    }
    
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["scores", selectedTeam] });
  }

  function step(key: PrayerKey, delta: number) {
    setCounts((c) => ({ ...c, [key]: Math.max((c[key] || 0) + delta, 0) }));
  }

  return (
    <div className="flex flex-col h-full">
      
      {/* TAKIM SEÇİMİ (Sabit Üst Alan) */}
      <div className="bg-slate-50 px-4 py-4 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 ml-1">Takım Seçimi</span>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {activeTeams.map((t) => {
            const isSel = t.id === selectedTeam;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTeamId(t.id)}
                className={`shrink-0 px-5 py-2 rounded-full text-[13px] font-bold transition-all border ${
                  isSel
                    ? "bg-slate-800 text-white border-slate-800 shadow-md"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* DİNAMİK SEKMELER (Mevcut Gün / Geçmiş Günler) */}
      <div className="bg-white flex border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => setActiveTab('today')}
          className={`flex-1 py-4 text-[14px] font-bold transition-all relative ${
            activeTab === 'today' ? 'text-[#1b5e3a] bg-emerald-50/30' : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          Mevcut Gün (Aktif)
          {activeTab === 'today' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1b5e3a] rounded-t-md"></div>}
        </button>
        
        <button 
          onClick={() => setActiveTab('past')}
          className={`flex-1 py-4 text-[14px] font-bold transition-all relative ${
            activeTab === 'past' ? 'text-[#1b5e3a] bg-emerald-50/30' : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          Geçmiş Günler
          {activeTab === 'past' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1b5e3a] rounded-t-md"></div>}
        </button>
      </div>

      <form onSubmit={save} className="flex-1 bg-slate-50/50 pb-32">
        
        {/* SEKME 1: MEVCUT GÜN */}
        {activeTab === 'today' && (
          <div className="p-4 animate-in fade-in slide-in-from-left-4 duration-300">
            
            {/* Akıllı Başlık Kartı */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center mb-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1b5e3a]"></div>
              <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Açık Görev
              </span>
              <h2 className="text-2xl font-black text-slate-800 mb-1">
                 {formatHijriTR(islamicToday)}
              </h2>
              <p className="text-sm font-bold text-slate-500">{formatTR(islamicToday)}</p>
              
              <div className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-3 text-left">
                <div className="text-emerald-600 mt-0.5"><Info className="w-5 h-5" /></div>
                <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                  Bu form, <strong className="text-slate-800">dün akşam ezanından</strong> başlayıp, <strong className="text-slate-800">bugün işrak vaktine</strong> kadar olan ibadetleri kapsar.
                </p>
              </div>
            </div>

            {/* Hızlı Giriş Formu (Yalnızca Yatsı, Sabah, İşrak) */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1">İbadetler (Kişi Sayısı)</h3>
              
              {ACTIVE_PRAYERS.map((prayer) => (
                <div key={prayer.key} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-extrabold text-slate-800">{prayer.label}</p>
                    <p className="text-[11px] font-bold text-emerald-600">{prayer.points} puan</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" onClick={() => step(prayer.key, -1)} className="w-12 h-12 rounded-full border-slate-200 text-slate-600 flex items-center justify-center active:bg-slate-100">
                      <Minus className="w-5 h-5"/>
                    </Button>
                    <div className="w-14 text-center">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={String(counts[prayer.key])}
                        onChange={(e) =>
                          setCounts((c) => ({
                            ...c,
                            [prayer.key]: Math.max(Number(e.target.value) || 0, 0),
                          }))
                        }
                        className="h-10 border-0 bg-transparent text-center text-2xl font-black text-[#1b5e3a] p-0 focus-visible:ring-0"
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => step(prayer.key, 1)} className="w-12 h-12 rounded-full border-slate-200 text-slate-600 flex items-center justify-center active:bg-slate-100">
                      <Plus className="w-5 h-5"/>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEKME 2: GEÇMİŞ GÜNLER LİSTESİ */}
        {activeTab === 'past' && (
          <div className="p-4 animate-in fade-in slide-in-from-right-4 duration-300 space-y-3">
            {dates.filter(d => d !== islamicToday).map((d) => {
              const isExpanded = expandedPastDate === d;
              const hasScore = entered.has(d);
              const dayScore = entered.get(d) || 0;

              return (
                <div key={d} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-[#1b5e3a] shadow-md' : 'border-slate-200 shadow-sm'}`}>
                  
                  <button 
                    type="button"
                    onClick={() => setExpandedPastDate(isExpanded ? null : d)}
                    className="w-full text-left p-4 flex items-center gap-4 active:bg-slate-50"
                  >
                    <div className="shrink-0">
                      {!hasScore 
                        ? <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500"><AlertCircle className="w-5 h-5"/></div>
                        : <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500"><CheckCircle className="w-5 h-5"/></div>
                      }
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[15px] font-extrabold text-slate-800">{formatHijriTR(d)}</h3>
                      {!hasScore 
                        ? <p className="text-[12px] font-bold text-rose-500">Puan girilmedi</p>
                        : <p className="text-[12px] font-bold text-emerald-600">Kayıtlı: {dayScore} Puan</p>
                      }
                    </div>
                    <div className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-[#1b5e3a]' : ''}`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </button>

                  {/* Genişleyen Geçmiş Düzenleme Formu (Akordeon) */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-3">{formatTR(d)} İbadetleri</h4>
                        <div className="space-y-2 mb-4">
                        {ACTIVE_PRAYERS.map((prayer) => (
                          <div key={prayer.key} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-200">
                            <div>
                              <p className="text-[13px] font-bold text-slate-700">{prayer.label}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button type="button" variant="outline" size="icon" onClick={() => step(prayer.key, -1)} className="w-8 h-8 rounded-full border-slate-200 flex items-center justify-center active:bg-slate-100 text-slate-600"><Minus className="w-4 h-4"/></Button>
                              <span className="font-black text-slate-800 w-6 text-center tabular-nums">{counts[prayer.key] || 0}</span>
                              <Button type="button" variant="outline" size="icon" onClick={() => step(prayer.key, 1)} className="w-8 h-8 rounded-full border-slate-200 flex items-center justify-center active:bg-slate-100 text-slate-600"><Plus className="w-4 h-4"/></Button>
                            </div>
                          </div>
                        ))}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Toplam</span>
                            <span className="text-lg font-black text-[#1b5e3a]">{total}</span>
                          </div>
                          <Button 
                            type="submit" 
                            disabled={saving}
                            className="flex-[2] bg-[#1b5e3a] hover:bg-[#15462b] text-white font-bold text-[14px] h-full min-h-[50px] rounded-xl active:scale-95 transition-all disabled:opacity-50"
                          >
                            {saving ? "Güncelleniyor..." : "Güncelle"}
                          </Button>
                        </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ALT BAR (Sadece Mevcut Gün Sekmesinde Görünür) */}
        {activeTab === 'today' && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 p-4 pb-safe flex items-center gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
            <div className="flex flex-col pl-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Günlük Toplam</span>
              <span className="text-2xl font-black text-[#1b5e3a] leading-none tabular-nums mt-0.5">
                {total} <span className="text-sm font-bold text-slate-400">puan</span>
              </span>
            </div>
            <Button 
              type="submit" 
              disabled={saving || !selectedTeam}
              className="flex-1 h-14 bg-[#1b5e3a] hover:bg-[#15462b] text-white rounded-2xl font-bold text-[16px] shadow-[0_4px_15px_rgba(27,94,58,0.3)] active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Günü Kaydet"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
