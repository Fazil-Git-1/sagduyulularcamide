export const CONTEST_DAYS = 30;
export const CAPTAIN_PIN = "5929";
// Değiştirmeyi unutma: bu PIN takım yönetimi ve sistem sıfırlamaya erişim sağlar.
export const ADMIN_PIN = "3737";

export const PRAYERS = [
  { key: "fajr_count", label: "Sabah namazı", points: 5 },
  { key: "isha_count", label: "Yatsı namazı", points: 3 },
  { key: "ishraq_count", label: "İşrak ibadeti", points: 3 },
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

/**
 * Referans nokta: Iğdır (Türkiye'nin en doğusundaki il). Türkiye tek saat
 * diliminde olduğu için ülkenin en doğusu, Mağrip'e en erken ulaşan yerdir —
 * bu yüzden gün değişimi hiçbir zaman gerçek Mağrip'ten önce gerçekleşmez.
 */
const REFERENCE_LAT = 39.9237;
const REFERENCE_LNG = 44.045;
/** Astronomik hesaplamanın birkaç dakikalık sapma payına karşı güvenlik marjı. */
const SAFETY_MARGIN_MINUTES = 10;

/**
 * Verilen takvim gününde (yerel tarih), referans konum için Mağrip'in
 * (güneşin ufkun altına inmesi + kırılma/güneş yarıçapı düzeltmesi) UTC anını
 * NOAA'nın basitleştirilmiş güneş pozisyonu formülüyle hesaplar. Dış bir
 * API'ye ihtiyaç duymadan, offline çalışır. Hassasiyet ~birkaç dakika
 * civarındadır — dini ibadet vakti olarak değil, yarışmanın "gün değişimi"
 * sınırı olarak kullanılmak üzere tasarlanmıştır.
 */
function maghribUTC(year: number, month: number, day: number): Date {
  const dayOfYear =
    Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const y = ((2 * Math.PI) / 365) * (dayOfYear - 1);

  // Equation of time (dakika).
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(y) -
      0.032077 * Math.sin(y) -
      0.014615 * Math.cos(2 * y) -
      0.040849 * Math.sin(2 * y));

  // Güneş meyli (radyan).
  const decl =
    0.006918 -
    0.399912 * Math.cos(y) +
    0.070257 * Math.sin(y) -
    0.006758 * Math.cos(2 * y) +
    0.000907 * Math.sin(2 * y) -
    0.002697 * Math.cos(3 * y) +
    0.00148 * Math.sin(3 * y);

  const latRad = (REFERENCE_LAT * Math.PI) / 180;
  // 90.833°: ufuk kırılması + güneş yarıçapı düzeltmesi (standart gün batımı tanımı).
  const zenithRad = (90.833 * Math.PI) / 180;

  const cosHourAngle =
    Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);
  const clamped = Math.min(1, Math.max(-1, cosHourAngle));
  const hourAngleDeg = (Math.acos(clamped) * 180) / Math.PI;

  const solarNoonUTCmin = 720 - 4 * REFERENCE_LNG - eqTime;
  const sunsetUTCmin = solarNoonUTCmin + 4 * hourAngleDeg + SAFETY_MARGIN_MINUTES;

  return new Date(Date.UTC(year, month - 1, day, 0, 0) + sunsetUTCmin * 60000);
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

/**
 * "Etkin" (dini) gün: Iğdır referanslı gerçek Mağrip vaktinden itibaren bir
 * sonraki takvim gününe geçer. Böylece akşam kılınan Yatsı, ertesi sabahki
 * Sabah namazı ve İşrak ile aynı güne yazılır — Hicri günün akşamla başlaması
 * gibi. Sabit bir saat yerine mevsime göre otomatik doğru saatte değişir.
 */
export function effectiveDate(d: Date = new Date()): Date {
  const [y, m, day] = toISODate(d).split("-").map(Number);
  const maghrib = maghribUTC(y, m, day);
  if (d.getTime() >= maghrib.getTime()) {
    return new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return d;
}

export function todayISO(): string {
  return toISODate(effectiveDate());
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
  const base = effectiveDate();
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

/**
 * Verilen Miladi tarihin Hicri karşılığını Türkçe olarak döndürür (örn.
 * "Hicri 29 Safer 1448"). Intl'in yerleşik İslami takvim hesaplamasını
 * kullanır — matbu takvimlerle/rüyet usulüyle bir-iki gün fark
 * gösterebilir, kesin dini referans olarak değil bilgilendirme amaçlı
 * kullanılmalıdır.
 */
export function formatHijriTR(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("tr-TR-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
