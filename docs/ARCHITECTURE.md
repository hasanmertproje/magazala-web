# Architecture

## İlkeler
- Workspace isolation her veri erişiminde sunucu tarafında uygulanır.
- Paket/feature flag yalnızca UI gizleme değildir; domain servislerinde authorize edilir.
- Harici servisler adapter arkasındadır.
- Uzun işlemler job queue üzerinden yürütülür.
- AI karar verici değil; authoritative commerce kuralları deterministic servislerde kalır.
- Active / Beta / Preview statüleri ürün sözleşmesinin parçasıdır.

## Katmanlar
1. Web UI / route handlers
2. Application services
3. Domain core
4. Repository interfaces
5. Provider / marketplace adapters
6. PostgreSQL / Redis / object storage
7. Background workers

## Modül sınırları
Creative, Product Intelligence ve Commerce birbirini doğrudan DB tablolarıyla çağırmaz. Application-level contracts kullanır. Idea → Design handoff, explicit brief nesnesi üzerinden yürür.
