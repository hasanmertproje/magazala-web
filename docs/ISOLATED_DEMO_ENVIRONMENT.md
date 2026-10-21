# EntegrePilot — izole demo mimarisi (K6/K7)

## Güvenlik sınırı

Demo, production müşteri veritabanında ayrı bir tenant olarak **kurulmaz**. Ayrı Railway environment ve **ayrı PostgreSQL veritabanı** kullanılır. En önemlisi, demo ortamı production `DATABASE_URL` değerine referans veremez; environment fork işlemi tek başına veritabanını ayırmış sayılmaz.

`scripts/seed-isolated-demo.mjs`, herhangi bir üretim müşterisi/kullanıcısı bulunan veritabanında **başarısız olur**. Ayrıca `DEMO_ISOLATED_DATABASE=isolated-demo-only`, özel e-posta ve güçlü özel şifre verilmeden çalışmaz. `RAILWAY_ENVIRONMENT_NAME=production` ya da production `APP_URL` durumunda da reddeder. Bu işaretler tek başına bir güvenlik sınırı değildir; zorunlu ek kontrol canlı müşteri kullanıcılarının/workspace'lerinin bulunmamasıdır.

## Kurulum koşulları

1. Railway'de izole demo environment veya bağımsız project oluşturun. Production PostgreSQL'i klonlayıp canlı müşteri verisini buraya taşımayın. Yeni ve boş PostgreSQL veritabanı kurun.
2. Demo uygulama servisini GitHub `main` kaynağından başlatın. Demo ortamındaki `DATABASE_URL` yalnızca yeni demo veritabanına işaret etmeli. Demo uygulamasının URL'si production domain'den farklı olmalı.
3. Demo ortamına **bağımsız** `SESSION_SECRET` ve gerekli uygulama yapılandırmasını verin. Production şifreleri, pazaryeri anahtarları, gerçek ödeme, gerçek gönderim ve S3 credential'larını demo ortama kopyalamayın. Gerektiğinde ayrı, sınırlı demo S3 bucket tanımlayın.
4. Özel `DEMO_EMAIL` ve parola kasasında saklanan, rastgele üretilmiş `DEMO_PASSWORD` tanımlayın. Kimlik bilgilerini GitHub, build logları, commit mesajları veya herkese açık örnekler içinde yayınlamayın.
5. Yalnızca izole demo veritabanına yönelik bağlantıdan `npm run prisma:migrate:deploy` ve ardından `DEMO_ISOLATED_DATABASE=isolated-demo-only node scripts/seed-isolated-demo.mjs` komutlarını çalıştırın. İşlem kimlik bilgilerini loglamaz. Provisioning otomatik değildir.
6. Login ve panel fonksiyonlarını demo ortamında ayrı hesabı kullanarak doğrulayın. Veritabanı ve network izolasyonunu ayrıca doğrulayın; varsayıma dayanmayın.

## Seed içeriği

- Superadmin olmayan bir kullanıcı; sadece demo workspace içinde `ADMIN` rolü.
- Ücretsiz/ücretli gerçek faturalandırma yaratmayan `Kurumsal · Demo` özellik paketi. Katalogdaki ACTIVE/BETA izinleri açılır; PREVIEW kapalı kalır. Görsel kredisi 500, ürün araştırma kredisi 150 olarak tanımlanır. Gerçek AI sağlayıcıları ayrı etkinleştirilmediyse model çalışması vaat edilmez.
- **3 sahte mağaza:** `MOCK`, `enabled=false`, kimlik doğrulama ve dış API anahtarı yok.
- **10 örnek ürün, 2 depo, 20 stok bakiyesi, 20 başlangıç stok hareketi**.
- Son 21 güne yayılmış **42 örnek sipariş**, farklı durumlar ve iki farklı para birimi (analitik tutarları karıştırmadan adet sayar).
- **3 örnek bildirim**, gerçek satış veya müşteri verisi yok.

Seed, mevcut `Workspace`, `Product`, `StockBalance`, `CommerceOrder`, `StoreConnector` ve `Feature` yapılarını kullanır. Varyasyonlar şu an birinci sınıf Prisma modeli olmadığı için seed, gerçek varyant altyapısı olduğunu iddia etmez; SKU'lar örnek ürün düzeyinde üretilir.

## Güvenlik ve kabul testi

CI, aynı kodu **ayrı, geçici PostgreSQL veritabanında** iki kez çalıştırarak idempotence, tenant sınırı, demo dışı kullanıcı varsa reddetme, mock bağlantıları ve premium özelliklerin PREVIEW dışı olmasını denetler. Test sonunda geçici veritabanı silinir.

**Önemli:** Bu PR demo hesabını production veritabanına eklemez ve herkese açık bir demo URL'si oluşturmaz. Gerçek demo ortamı ancak ayrı Railway kaynakları tanımlanıp seed o ortamda çalıştırıldığında erişilebilir olacaktır. Tarayıcı kabul testleri ayrıca gerekir.

## Dış sağlayıcı erişim güvenliği (2026-10-21)

Demo paket hakları gerçek AI kredisi harcama veya dış arama isteği yapma izni değildir. Demo çalışma alanı için Design Studio üretimi, Product Intelligence IDEA/RESEARCH ve gereksinim asistanı konuşma/analizi istekleri, kota rezerve edilmeden veya mesaj yazılmadan önce HTTP 403 ve `DEMO_EXTERNAL_OPERATION_DISABLED` ile reddedilir. Merkezi metin/görsel sağlayıcı servisleri de workspace kimliğini veritabanından tekrar okuyarak sağlayıcı kimlik bilgilerine erişmeden önce aynı kuralı uygular.

Bu işlemleri çalışan demo özellikleri olarak tanıtmayın. Ücretli AI kullanımı için ayrıca yetkilendirilmiş ve bütçesi sınırlı bir sandbox modeli tasarlanmalıdır. Demo ürün/sipariş/stok inceleme özellikleri etkilenmez. Bu yama ayrı Railway demo veritabanı oluşturmaz veya canlı demo giriş akışının test edildiği anlamına gelmez.
