-- Additive stock ledger. Existing products, workspaces, and connector records are untouched.
CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Warehouse_workspaceId_code_key" ON "Warehouse"("workspaceId","code");
CREATE INDEX "Warehouse_workspaceId_active_idx" ON "Warehouse"("workspaceId","active");
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InventoryBalance" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "onHand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryBalance_quantities_check" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand")
);
CREATE UNIQUE INDEX "InventoryBalance_warehouseId_productId_key" ON "InventoryBalance"("warehouseId","productId");
CREATE INDEX "InventoryBalance_workspaceId_productId_idx" ON "InventoryBalance"("workspaceId","productId");
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "beforeQuantity" INTEGER NOT NULL,
  "afterQuantity" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockMovement_nonzero_check" CHECK ("delta" <> 0),
  CONSTRAINT "StockMovement_nonnegative_check" CHECK ("beforeQuantity" >= 0 AND "afterQuantity" >= 0)
);
CREATE UNIQUE INDEX "StockMovement_workspaceId_idempotencyKey_key" ON "StockMovement"("workspaceId","idempotencyKey");
CREATE INDEX "StockMovement_workspaceId_createdAt_idx" ON "StockMovement"("workspaceId","createdAt");
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId","createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
