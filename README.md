# Magazala

Modüler e-ticaret operasyonu, yaratıcı üretim ve ürün araştırma platformu.

## Ürün sınırları

Repo, çalışan production çekirdeği ile henüz kullanıcı iş akışı kesinleşmemiş Commerce alanlarını bilinçli olarak ayırır. Preview/Beta modüller production entegrasyonu varmış gibi gösterilmez.

### Production çekirdeği
- İlk kurulum, login/logout ve kalıcı session
- Workspace izolasyonu, güvenli davetler ve workspace switch
- Müşteri/workspace kontrol merkezi
- Paket, feature entitlement, override ve kota altyapısı
- Provider Center, şifreli API credential saklama ve model registry
- Smart Model Router ve desteklenen provider adapterları
- AI Design Studio: referans görsel, gerçek provider çağrıları, private object storage, generation history ve parent/child lineage
- Product Intelligence: Idea ve source-backed Research modları, provenance ve Design Studio handoff
- Tasarlayalım AI: merkezi özellik görüşmesi, kullanıcı onayı, requirement yönetimi, clarification thread ve MD/JSON/TXT export
- Bildirim merkezi, audit ve usage kayıtları
- Sistem Sağlığı ekranı

### Beta
- Products
- Internal SKU / barcode
- Import / Export temel modeli
- Automation foundation

### Preview
- Stores / marketplace connectors
- Trendyol connector boundary
- Inventory / shelves / orders

Bu alanlar iş akışı doğrulanmadan production senkronizasyonu yapmaz.

## Yerel kurulum

```bash
cp .env.example .env
docker compose up -d
npm ci
npm run prisma:migrate:deploy
npm run preflight:production
npm run dev
```

İlk açılışta `/setup` üzerinden ilk super-admin ve ilk workspace oluşturulur. Setup yalnız kullanıcı tablosu boşken çalışır.

## Production akışı

Deploy sırasında sıralama:

```bash
npm ci
npm run prisma:migrate:deploy
npm run preflight:production
npm run build
npm start
```

`APP_URL` production ortamında HTTPS olmalıdır. `SESSION_SECRET` en az 32 karakter, `CREDENTIAL_ENCRYPTION_KEY` ise base64 olarak tam 32 byte olmalıdır. Provider API anahtarları environment değişkeni olarak client'a verilmez; Admin > API Sağlayıcıları üzerinden eklenir ve şifreli saklanır.

## Sağlık endpoint'leri

- `GET /api/health/live` — process/application liveness
- `GET /api/health/ready` — database + zorunlu production configuration readiness

Readiness endpoint'i secret değerlerini döndürmez; yalnız yapılandırma/DB durumunu boolean olarak raporlar.

## Kalite kapıları

Pull request CI zinciri:
- `npm ci`
- production dependency audit
- Prisma generate + validate
- temiz PostgreSQL üzerinde `prisma migrate deploy`
- production configuration preflight
- production metin politikası
- core tests + TypeScript checks
- Next production build

Ayrıntılı kabul kriterleri: `docs/PRODUCTION_ACCEPTANCE.md`.
