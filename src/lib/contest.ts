export const CONTEST_DAYS = 30;
// PIN kodları yalnızca sunucuda tutulur (src/lib/pins.server.ts).

export const PRAYERS = [
  { key: "isha_count", label: "Yatsı namazı", points: 3, phase: "night" },
  { key: "fajr_count", label: "Sabah namazı", points: 5, phase: "day" },
  { key: "ishraq_count", label: "İşrak ibadeti", points: 3, phase: "day" },
] as const;


export type PrayerKey = (typeof PRAYERS)[number]["key"];

export type PrayerCounts = Record<PrayerKey, number>;

export const emptyCounts = (): PrayerCounts => ({
  fajr_count: 0,
  isha_count: 0,
  ishraq_count: 0,
});

export function computeScore(counts: PrayerCounts): number {
  return PRAYERS.reduce((sum, p) => sum + (counts[p.key] || 0) * p.points, 0);
}

/** Istanbul-local ISO date, deterministic on server and client (avoids hydration drift). */
export function toISODate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** How many days have elapsed since the contest start (1-based, capped at CONTEST_DAYS). */
export function currentDay(startDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${todayISO()}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  return Math.min(Math.max(diff, 0), CONTEST_DAYS);
}

/** ISO dates for the last 30 selectable days (today first). */
export function selectableDates(): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < CONTEST_DAYS; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}

export function formatTR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  });
}

/** Bir önceki günün ISO tarihi. */
export function prevISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

/** "16 Ağustos Çarşamba" biçiminde uzun Türkçe tarih. */
export function formatLongTR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
}

const HIJRI_MONTHS_TR = [
  "Muharrem",
  "Safer",
  "Rebiülevvel",
  "Rebiülahir",
  "Cemaziyelevvel",
  "Cemaziyelahir",
  "Recep",
  "Şaban",
  "Ramazan",
  "Şevval",
  "Zilkade",
  "Zilhicce",
];

/** Tarayıcıdan bağımsız aritmetik (Kuwaiti) Hicri dönüşümü. */
function hijriFromGregorian(y: number, m: number, d: number): { day: number; month: number } {
  const jd =
    Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4) +
    Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) +
    d -
    32075;

  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  return { day, month };
}

/** Hicri tarih etiketi, ör. "5 Rebiülevvel". Mobil ICU eksikliklerine karşı dayanıklı. */
export function hijriLabel(iso: string): string {
  const [ys, ms, ds] = iso.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));

  for (const calendar of ["islamic-umalqura", "islamic-civil", "islamic"]) {
    try {
      const fmt = new Intl.DateTimeFormat("en-u-ca-" + calendar, {
        calendar: calendar as never,
        day: "numeric",
        month: "numeric",
        timeZone: "UTC",
      });
      if (!fmt.resolvedOptions().calendar?.startsWith("islamic")) continue;
      const parts = fmt.formatToParts(utc);
      const day = Number(parts.find((p) => p.type === "day")?.value);
      const month = Number(parts.find((p) => p.type === "month")?.value);
      if (!day || !month || month < 1 || month > 12) continue;
      return `${day} ${HIJRI_MONTHS_TR[month - 1]}`;
    } catch {
      // sıradaki takvimi dene
    }
  }

  const fb = hijriFromGregorian(y, m, d);
  return `${fb.day} ${HIJRI_MONTHS_TR[Math.min(Math.max(fb.month, 1), 12) - 1]}`;
}

