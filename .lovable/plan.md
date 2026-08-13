# Hicri tarih telefonda yanlış görünüyor ("30 Şubat")

## Neden oluyor

Hicri etiket şu an tek bir yolla üretiliyor: `Intl.DateTimeFormat("tr-TR-u-ca-islamic-umalqura", ...)` (`src/lib/contest.ts`, `hijriLabel`).

Bu, locale etiketine gömülü takvim uzantısı (`-u-ca-`) ile çalışır. Bazı mobil tarayıcılar/WebView'lar (özellikle eski iOS Safari ve küçültülmüş ICU verisiyle gelen Android WebView) bu uzantıyı **sessizce yok sayar** ve Miladi takvime düşer. Hata da vermez — sonuç "30 Şubat" gibi Miladi bir ay adı olur. Masaüstünde tam ICU verisi olduğu için doğru görünür.

Ayrıca `islamic-umalqura` desteklenmediğinde bazı ortamlar sadece `islamic`'e düşer; bu da 1 gün kayma yapabilir.

## Çözüm

`hijriLabel` fonksiyonunu kademeli (fallback zincirli) ve doğrulamalı hale getirmek:

1. Takvimi locale etiketiyle değil, seçenek nesnesiyle vermek: `new Intl.DateTimeFormat("tr-TR", { calendar: "islamic-umalqura", day: "numeric", month: "long" })`.
2. Üretilen `resolvedOptions().calendar` değerini kontrol etmek; `islamic` ile başlamıyorsa (yani Miladi'ye düşmüşse) sıradaki adıma geçmek.
3. Sırasıyla dene: `islamic-umalqura` → `islamic-civil` → `islamic`.
4. Hiçbiri tutmazsa: yerleşik, tarayıcıdan bağımsız bir hesaplama ile Hicri gün/ay bulmak ve ay adını uygulama içindeki Türkçe listeden yazmak (Muharrem, Safer, Rebiülevvel, ... Zilhicce). Böylece her cihazda aynı sonuç çıkar.
5. Ay adlarını her durumda kendi Türkçe listemizden yazmak — bazı ortamlar Hicri ayları İngilizce ("Safar") döndürüyor; bu da tutarsızlık yaratıyor.

## Teknik notlar

- Değişecek tek dosya: `src/lib/contest.ts` (`hijriLabel`). Arayüz, veritabanı, kayıt akışı değişmez.
- Fallback hesaplama olarak standart Kuwaiti/aritmetik Hicri algoritması kullanılacak (küçük, saf fonksiyon); Umalqura ile 1 günden fazla sapmaz.
- Tarih hesabı Europe/Istanbul üzerinden mevcut `toISODate` mantığıyla tutarlı kalır.
- Doğrulama: hem masaüstü tarayıcıda hem de `Intl` takvim desteği kapalıymış gibi davranan bir testle, `hijriLabel` çıktısının her zaman Hicri ay adı verdiği kontrol edilir.
