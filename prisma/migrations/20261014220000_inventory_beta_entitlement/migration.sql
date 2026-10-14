-- Inventory Beta entitlement activation; does not alter existing quota usage.
UPDATE "Feature"
SET "label"='Stok ve depo yönetimi', "status"='BETA', "module"='Inventory'
WHERE "key"='inventory.basic';

INSERT INTO "PackageFeature" ("packageId","featureId","enabled","limit")
SELECT p."id", f."id", TRUE, NULL
FROM "Package" p CROSS JOIN "Feature" f
WHERE p."slug" IN ('baslangic','gelisim','kurumsal') AND f."key"='inventory.basic'
ON CONFLICT ("packageId","featureId") DO NOTHING;
