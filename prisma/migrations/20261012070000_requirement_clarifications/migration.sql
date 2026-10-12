CREATE TYPE "RequirementClarificationAuthor" AS ENUM ('ADMIN', 'USER');

CREATE TABLE "RequirementClarificationMessage" (
  "id" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorRole" "RequirementClarificationAuthor" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequirementClarificationMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RequirementClarificationMessage_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RequirementClarificationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RequirementClarificationMessage_requirementId_createdAt_idx" ON "RequirementClarificationMessage"("requirementId", "createdAt");
CREATE INDEX "RequirementClarificationMessage_authorUserId_idx" ON "RequirementClarificationMessage"("authorUserId");
