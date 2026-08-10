# Mobil Deneyimi İyileştirme

Renkleri ve genel görsel kimliği koruyarak uygulamayı gerçek bir telefon deneyimine göre yeniden düzenliyoruz. 390px genişlikte yapılan incelemede öne çıkan sorunlar giderilecek.

## Tespit edilen mobil sorunlar

- Ana ekranda madalya emojileri telefonda kutu (□) olarak görünüyor — sıralama okunmuyor.
- Kartlar çok yüksek: 5 takım ekrana sığmıyor, boşluklar telefon için fazla büyük.
- Başlık bloğu ekranın üçte birini kaplıyor; liderlik tablosu katlamanın altında kalıyor.
- Kaptan panelinde tarih ve takım seçimi native `select` ile yapılıyor; 30 günlük liste telefonda kullanışsız.
- PIN girişi tek bir metin kutusu — telefonda 4 haneli kod girişi için uygun değil.
- Butonlar ve dokunma hedefleri bazı yerlerde 44px altında (takvim noktaları 24px).

## Ana Ekran (Liderlik Tablosu)

- Başlık alanını sıkılaştır: mobilde daha küçük üst boşluk, başlık boyutu telefonda ölçekli (`text-2xl` → `sm:text-4xl`).
- Gün ilerleme kartını tek satır kompakt yapıya al: "2. Gün / 30" solda, "%7" sağda, çubuk altında.
- Sıralama göstergesini emoji yerine tasarım tokenlarıyla çizilen rozetlere çevir (1. altın, 2. gümüş, 3. bronz halka, diğerleri sade numara). Böylece her cihazda aynı görünür.
- Takım satırlarını kompaktlaştır: isim ve puan tek satırda, ilerleme çubuğu daha ince, satır yükseklikleri azalır — 5 takım tek ekrana sığar.
- Uzun takım isimleri için `min-w-0` + `truncate`, puan `shrink-0` ve `tabular-nums`.
- "Kaptan Girişi" bağlantısını alt güvenli alana yapışık, dokunulabilir (min 44px) bir butona çevir; iOS için `pb-[env(safe-area-inset-bottom)]`.

## Kaptan Paneli

- PIN ekranı: tek input yerine 4 ayrı haneli OTP tarzı giriş (`input-otp` benzeri davranış), `inputMode="numeric"`, otomatik ilerleme ve 4. hanede otomatik doğrulama. Klavye açıldığında kart yukarı kaymayacak şekilde dikey konum ayarı.
- Sekmeler (Puan Girişi / Takım Yönetimi) mobilde tam genişlik, daha yüksek dokunma hedefi.
- Tarih seçimi: uzun `select` yerine yatay kaydırılabilir gün şeridi (bugün sağda/başta, seçili gün belirgin), altında seçili günün tam Türkçe tarihi. Dokunma hedefleri 40–44px, puan girilen günler dolu yeşil.
- Takım seçimi: dropdown yerine sarmalanan takım "chip" butonları — tek dokunuşla seçim.
- Puan alanı: büyük sayısal input + yanında hızlı `-`/`+` adım butonları.
- "Kaydet / Güncelle" butonu mobilde formun altında yapışkan (sticky) hale gelir, klavye açıkken erişilebilir kalır.
- Takım Yönetimi: isim input + aktiflik anahtarı satırını `grid-cols-[minmax(0,1fr)_auto]` ile dar ekranda taşmayacak biçimde kur.
- "Sistemi Sıfırla" için `window.confirm` yerine mobil uyumlu onay dialogu (AlertDialog).

## Genel

- Tüm sayfalarda yatay taşma kontrolü, `min-w-0` / `truncate` kuralları.
- Dokunma hedefleri en az 44px; hover yerine `active:` durumları.
- iOS'ta input odaklanınca zoom olmaması için form alanlarında 16px taban font.
- Renk paleti, yeşil-altın tema ve font ailesi aynen korunur.

## Teknik notlar

- Değişiklikler yalnızca sunum katmanında: `src/routes/index.tsx`, `src/routes/kaptan.tsx` ve gerekirse `src/styles.css` (safe-area yardımcı sınıfı).
- Veri akışı, Supabase sorguları, upsert mantığı ve realtime aboneliği değişmez.
- Sıralama rozetleri ve gün şeridi küçük yerel bileşenler olarak ilgili route dosyasında tutulur.
- Doğrulama: 390px ve 768px genişliklerde ekran görüntüsü ile kontrol.
