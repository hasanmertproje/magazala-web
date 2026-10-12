CREATE TABLE "GenerationLineage" (
  "childGenerationId" TEXT NOT NULL,
  "parentGenerationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationLineage_pkey" PRIMARY KEY ("childGenerationId"),
  CONSTRAINT "GenerationLineage_childGenerationId_fkey" FOREIGN KEY ("childGenerationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GenerationLineage_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GenerationLineage_parentGenerationId_idx" ON "GenerationLineage"("parentGenerationId");
