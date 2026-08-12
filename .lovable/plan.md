# Kaptan Paneli — Gece/Gündüz Bloklu Yeni Tasarım

Paylaştığın taslağın düzenini uyguluyoruz: gün şeridi, hicri gün başlığı, ayrı "Gece Vakti" ve "Gündüz Vakti" blokları, altta sabit kaydetme barı. Renkler mevcut yeşil-altın temada kalır; ibadetler mevcut üçlü olarak devam eder.

## Ekran düzeni

```text
[ Sağduyulular Camide / Kaptan Paneli      (takım seçici) ]
[  4. Gün   5. Gün BUGÜN   6. Gün   ...  ]   <- yatay şerit
            5. Gün Puanları
            [ 5 Rebiülevvel ]
 ┌ Gece Vakti (koyu yeşil) ─────────────┐
 │ 16 Ağustos Çarşamba akşam ezanından  │
 │ Yatsı namazı  3p      [-]  0  [+]    │
 └──────────────────────────────────────┘
 ┌ Gündüz Vakti (açık altın) ───────────┐
 │ 17 Ağustos Perşembe ikindi ezanına   │
 │ Sabah namazı  5p      [-]  0  [+]    │
 │ İşrak ibadeti 3p      [-]  0  [+]    │
 └──────────────────────────────────────┘
[ Günlük Toplam 0 puan ][ Puanları Kaydet ]  <- sabit alt bar
```

## Hicri gün mantığı

- Bir yarışma günü akşam ezanıyla başlar: **gece** kısmı bir önceki miladi güne, **gündüz** kısmı ertesi miladi güne denk gelir.
- Yatsı namazı gece bloğuna; sabah namazı ve işrak ibadeti gündüz bloğuna yerleşir.
- Her gün için hicri tarih (ör. "5 Rebiülevvel") ve iki miladi tarih başlıklarda gösterilir.
- Kayıt yine tek satır olarak gündüz tarihine yazılır — mevcut veriler ve liderlik tablosu aynen çalışmaya devam eder.

## Değişiklikler

1. **Gün şeridi**: sayı yerine "4. Gün / 5. Gün" etiketleri, bugüne "BUGÜN" rozeti, kronolojik sıra ve otomatik ortalama korunur; puan girilmiş günler nokta ile işaretli kalır.
2. **Takım seçici header'a taşınır**: üst barın sağında kompakt açılır seçici (aktif takımlar listesi).
3. **Gece / Gündüz blokları**: iki kart; gece koyu yeşil, gündüz açık altın tonlarında, her kartın başlığında ilgili miladi tarih ve zaman aralığı açıklaması.
4. **Sayaçlar**: taslaktaki gibi büyük `-  0  +` düzeni (44px dokunma hedefleri), metin kutusu yerine sayaç görünümü.
5. **Sabit alt bar**: solda "Günlük Toplam X puan", sağda "Puanları Kaydet" butonu; iOS güvenli alan boşluğu ile.
6. Takım Yönetimi ve sıfırlama akışı aynen kalır.

## Teknik notlar

- Yalnızca sunum katmanı: `src/routes/kaptan.tsx` (blok bileşenleri aynı dosyada küçük yerel bileşenler) ve gerekirse `src/lib/contest.ts` içine hicri tarih yardımcı fonksiyonu (`Intl.DateTimeFormat` `islamic-umalqura` takvimi, Europe/Istanbul).
- Veritabanı şeması, `saveScore` sunucu fonksiyonu, PIN doğrulama ve realtime akışı değişmez.
- Takım seçimi state'i `CaptainPage` seviyesine taşınır ki header seçici ile form aynı veriyi kullansın.
- Doğrulama: 390px genişlikte ekran görüntüsü ile kontrol.
