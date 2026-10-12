# Magazala

Modüler e-ticaret operasyonu, yaratıcı üretim ve ürün araştırma platformu.

## Durum

Bu repository production çekirdeğinin başlangıç implementasyonudur. Active/Beta/Preview sınırları bilinçli olarak ayrılmıştır. Uygulanmamış harici entegrasyonlar aktifmiş gibi gösterilmez.

### Active çekirdek hedefleri
- Authentication + workspace izolasyonu
- Paket/feature entitlement
- AI Provider Center
- Smart Model Router
- AI Design Studio
- Product Intelligence
- Projects / Asset Library
- Tasarlayalım AI — Özellikler Hakkında Konuş
- Bilgilendirme
- Notifications / Audit / Usage

### Beta
- Products
- SKU & internal barcode
- Import / Export
- Automation foundation

### Preview
- Stores / marketplace connectors
- Trendyol Stage/Production adapter boundary
- Inventory / shelves / orders

## Kurulum

1. `.env.example` dosyasını `.env` olarak kopyalayın.
2. `docker compose up -d` ile PostgreSQL, Redis ve MinIO başlatın.
3. Bağımlılıkları kurun: `npm install`.
4. Prisma migration ve seed komutlarını çalıştırın.
5. `npm run dev`.

> Provider anahtarları hiçbir zaman client bundle'a gönderilmez. Provider erişim sınıfı ve fiyat bilgisi zaman damgası ve resmi kaynakla saklanır.
