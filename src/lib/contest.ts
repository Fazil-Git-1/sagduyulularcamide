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
