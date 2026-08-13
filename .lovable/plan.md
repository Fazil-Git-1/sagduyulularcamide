# Ana Sayfa Yeniden Tasarımı + Dark Mod

Ana sayfa, çoğu ziyaretçinin göreceği tek ekran olduğu için daha olgun, prestijli bir görünüme kavuşacak. Veri akışı, Supabase sorguları ve kaptan paneli mantığı değişmeyecek.

## Görsel yön (seçimler)

- Palet: Derin Zümrüt + Altın (#08221A, #0F3D2E, #D8B04A, #F5F1E6)
- Tipografi: Başlık Sora, gövde Manrope
- Düzen: Tek sütun akış
- Dark mod: Cihazın sistem ayarına göre otomatik

## Ana sayfa değişiklikleri

- Hero: "Sağduyulular Camide" başlığı Sora ile, derin zümrüt zemin üzerinde ince altın bir ayraç ve alt satırda küçük "30 Günlük Namaz Yarışması" etiketi. Emoji ve çocuksu vurgular kaldırılır.
- Gün ilerlemesi: cam efektli kutu yerine sade, ince çizgili bir şerit — solda "2. Gün / 30", sağda "%7 · 28 gün kaldı", altında 4px altın ilerleme çubuğu.
- Liderlik tablosu tek sütun akışta:
  - Lider satırı biraz daha büyük, altın çerçeveli; diğer satırlar sade ayraçlı liste (kart-içinde-kart görünümü kalkar).
  - Sıra göstergesi: madalya emojileri tamamen kaldırılır; 1-2-3 için ince metal halkalı numara rozetleri, diğerleri sade numara.
  - Puan sağda büyük ve tabular; altında "Sabah · Yatsı · İşrak" katkı bilgisi yerine ince bir oran çubuğu.
  - Uzun isimler truncate, min-w-0, dokunma hedefleri ≥44px korunur.
- Alt aksiyonlar: "Kaptan Girişi" ve "Yönetici Girişi" görsel olarak sakinleşir (tek satır, düşük kontrast metin bağlantı stili), safe-area korunur.
- Küçük dokunuş: liste satırlarında yumuşak giriş animasyonu (kademeli fade/slide), abartısız.

## Dark mod

- `<html>` üzerinde sistem tercihine göre `dark` sınıfı uygulanır (prefers-color-scheme dinlenir, SSR uyumsuzluğu olmaması için hidrasyondan sonra).
- `src/styles.css` içindeki `.dark` blok, mevcut mavi-slate değerlerinden zümrüt-altın paletine çevrilir; açık tema değerleri de yeni palete göre güncellenir.
- Tüm bileşenler semantik tokenlar üzerinden çalıştığı için kaptan/yönetici ekranları da otomatik uyumlu olur; kontrast her iki modda kontrol edilir.

## Teknik notlar

- Dosyalar: `src/routes/index.tsx` (yeniden düzenleme), `src/styles.css` (palet + font tokenları + dark değerleri), `src/routes/__root.tsx` (Sora/Manrope font `<link>`'i ve tema sınıfı uygulaması).
- Renkler yalnızca oklch tokenları olarak tanımlanır; bileşenlerde sabit renk sınıfı (örn. `text-white`, `bg-amber-500`) yerine token tabanlı sınıflar kullanılır — mevcut ana sayfadaki sabit `emerald/amber/slate` sınıfları temizlenir.
- Sorgular, realtime aboneliği, `currentDay`/`CONTEST_DAYS` mantığı ve head/SEO meta verileri aynen korunur.
- Doğrulama: 390px ve masaüstü genişliğinde, açık ve koyu modda ekran görüntüsü kontrolü.
