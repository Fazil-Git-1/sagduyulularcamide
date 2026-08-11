# Puan yerine namaz girişi

Kaptanlar artık doğrudan puan yazmak yerine, o gün kaç kişinin hangi ibadeti yaptığını girecek. Puan otomatik hesaplanacak.

## Puanlama
- Sabah namazı: kişi sayısı × 5
- Yatsı namazı: kişi sayısı × 3
- İşrak ibadeti: kişi sayısı × 3

Günlük toplam = bu üçünün toplamı. Liderlik tablosu değişmeden, aynı toplam puanları göstermeye devam eder.

## Kaptan paneli — Puan Girişi sekmesi
- Mevcut tek "Puan" alanı kaldırılır; yerine üç ayrı sayaç gelir: Sabah, Yatsı, İşrak.
- Her satırda ibadet adı, katsayı rozeti (5p / 3p / 3p), −/+ butonları ve dokunmatik sayı alanı.
- Altta canlı "Günlük toplam: X puan" özeti.
- Kaydet/Güncelle aynı şekilde çalışır (aynı takım + gün varsa günceller).
- Tarih şeridi, takım çipleri, PIN (5929) ve tasarım dili aynı kalır.
- Seçili gün/takım için kayıt varsa üç sayaç mevcut değerlerle dolar.

## Veritabanı
`scores` tablosuna üç yeni alan eklenir: sabah, yatsı, işrak kişi sayıları (varsayılan 0). Mevcut `score` alanı kalır ve girilen sayılardan otomatik hesaplanır, böylece liderlik tablosu ve toplam puan mantığı bozulmaz.

Eski kayıtlarda sayı alanları 0 olur, mevcut puanları korunur.

## Teknik notlar
- Migration: `ALTER TABLE public.scores ADD COLUMN fajr_count int NOT NULL DEFAULT 0, isha_count int NOT NULL DEFAULT 0, ishraq_count int NOT NULL DEFAULT 0;`
- Puan hesabı client tarafında upsert öncesi yapılır (`fajr*5 + isha*3 + ishraq*3`) ve `score` alanına yazılır; mevcut `recalc_team_total` trigger'ı takım toplamını güncellemeye devam eder.
- `src/lib/contest.ts`: `PRAYERS` sabiti (anahtar, etiket, katsayı) ve `computeScore()` yardımcısı eklenir.
- `src/lib/queries.ts`: `teamScoresQuery` sayaç alanlarını da döndürür.
- `src/routes/kaptan.tsx`: `ScoreForm` içindeki tek puan alanı üç sayaçlı bileşenle değiştirilir.
