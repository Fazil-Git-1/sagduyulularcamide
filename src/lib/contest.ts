export const CONTEST_DAYS = 30;
export const CAPTAIN_PIN = "1234";

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
