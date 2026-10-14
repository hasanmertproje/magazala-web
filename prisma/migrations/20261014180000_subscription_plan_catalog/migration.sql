-- Non-destructive initial SaaS subscription catalog.
-- Pricing intentionally NULL until an operator approves commercial rates.
-- Never overwrites existing packages, feature overrides, assignments, or usage.
INSERT INTO "Feature" ("id", "key", "label", "module", "status", "description")
VALUES ('feature_store_overview_2026', 'commerce.stores.dashboard', 'Mağaza yönetim paneli', 'Commerce', 'ACTIVE', 'Çalışma alanına ait mağaza bağlantılarını yönetim panelinde görüntüleme.')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Package" ("id", "name", "slug", "active", "currency", "createdAt", "updatedAt")
VALUES
  ('ep_plan_baslangic_2026', 'Başlangıç', 'baslangic', TRUE, 'TRY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ep_plan_gelisim_2026', 'Gelişim', 'gelisim', TRUE, 'TRY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ep_plan_kurumsal_2026', 'Kurumsal', 'kurumsal', TRUE, 'TRY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

WITH entitlements ("slug", "key", "monthlyLimit") AS (
  VALUES
    ('baslangic','commerce.stores.dashboard',NULL::integer),
    ('baslangic','commerce.products',NULL::integer),
    ('baslangic','commerce.barcode',NULL::integer),
    ('baslangic','commerce.import_export',NULL::integer),
    ('baslangic','ai.design.generate',20),
    ('gelisim','commerce.stores.dashboard',NULL::integer),
    ('gelisim','commerce.products',NULL::integer),
    ('gelisim','commerce.barcode',NULL::integer),
    ('gelisim','commerce.import_export',NULL::integer),
    ('gelisim','ai.design.generate',100),
    ('gelisim','ai.design.reference',NULL::integer),
    ('gelisim','product_intelligence.basic',30),
    ('gelisim','product_intelligence.web_research',30),
    ('gelisim','automation.workflows',NULL::integer),
    ('kurumsal','commerce.stores.dashboard',NULL::integer),
    ('kurumsal','commerce.products',NULL::integer),
    ('kurumsal','commerce.barcode',NULL::integer),
    ('kurumsal','commerce.import_export',NULL::integer),
    ('kurumsal','ai.design.generate',500),
    ('kurumsal','ai.design.reference',NULL::integer),
    ('kurumsal','ai.design.vector',NULL::integer),
    ('kurumsal','ai.design.print',NULL::integer),
    ('kurumsal','product_intelligence.basic',150),
    ('kurumsal','product_intelligence.web_research',150),
    ('kurumsal','automation.workflows',NULL::integer),
    ('kurumsal','tasarlayalim_ai.discovery',NULL::integer)
)
INSERT INTO "PackageFeature" ("packageId", "featureId", "enabled", "limit")
SELECT p."id", f."id", TRUE, e."monthlyLimit"
FROM entitlements e
JOIN "Package" p ON p."slug" = e."slug"
JOIN "Feature" f ON f."key" = e."key" AND f."status" <> 'PREVIEW'
ON CONFLICT ("packageId", "featureId") DO NOTHING;
