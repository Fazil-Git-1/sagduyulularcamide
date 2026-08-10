# Prayer Race Leaderboard

Bir namaz yarışması için 30 günlük, mobil uyumlu bir web uygulaması geliştir. Veritabanı olarak Supabase kullan. Uygulama temelde 2 ana ekrandan oluşmalı ve aşağıdaki kurallara göre çalışmalıdır.

Tasarım Dili (UI/UX): Görsel olarak motive edici, sade, temiz; yeşil ve altın sarısı tonlarının hakim olduğu minimalist bir tasarım kullan. Mobil öncelikli (mobile-first) olsun.

Veritabanı Şeması (Supabase): Lütfen öncelikle şu iki tabloyu oluştur ve birbirine bağla:

Teams tablosu: id, name, is_active (boolean), total_score. (Başlangıçta A, B, C, D, E isimli 5 takım oluştur).

Scores tablosu: id, team_id, date, score. Mantık kuralı: Bir takımın belirli bir güne ait sadece bir kaydı olabilir. Eğer o gün için yeni bir puan girilirse, eski kayıt güncellenmelidir (Upsert mantığı).

Ekran 1: Ana Ekran (Liderlik Tablosu - Şifresiz Erişim)

İzleyiciler (genel kullanıcılar) giriş yapmadan (login olmadan) bu sayfayı doğrudan görebilmeli.

En üstte 30 günlük sürenin ne kadarının tamamlandığını/kaldığını gösteren dinamik bir "Gün İlerleme Çubuğu" (Progress Bar) olsun.

Altında, veritabanındaki aktif takımların toplam puanlarını baz alarak en yüksek puandan en düşüğe doğru sıralayan dinamik bir Liderlik Tablosu yer alsın. Takım sayısı değişirse tablo buna göre esnemeli.

Bu ekranda dikkat çekmeyen ama erişilebilir bir "Kaptan Girişi" butonu bulunsun.

Ekran 2: Kaptan Girişi ve Puan/Yönetim Ekranı

"Kaptan Girişi" butonuna tıklandığında sadece 4 haneli ortak bir PIN kodu (Örn: 1234) ile girilebilen bir yetki doğrulama ekranı çıksın. Karmaşık Auth işlemleri kullanma, sadece basit bir PIN kontrolü yeterli.

Doğrulama sonrası açılan Puan Giriş ekranında sade bir form olsun.

Form Alanları:

Tarih seçici (sadece son 30 gün aktif olsun, eski günlere de puan girilebilsin).

Takım seçici (Dropdown menü ile A, B, C, D, E takımlarından biri seçilebilsin).

Puan girme alanı ve "Kaydet/Güncelle" butonu.

Takım Yönetimi (Esneklik): Bu sayfada ayrıca takım isimlerinin değiştirilebileceği, yeni takım eklenebileceği veya mevcut takımların pasife alınabileceği (gizlenebileceği) ufak bir ayar sekmesi/alanı olsun.

Lütfen Supabase entegrasyonunu eksiksiz kur ve puan giriş ekranında yapılan her işlemin Ana Ekrandaki Liderlik Tablosuna anlık olarak (dinamik) yansımasını sağla.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sagduyulularcamide.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d2f6a3da-7e9e-4bb7-b10c-103b398cb059).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
