CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'USER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_workspaceId_email_createdAt_idx" ON "WorkspaceInvitation"("workspaceId", "email", "createdAt");
CREATE INDEX "WorkspaceInvitation_email_expiresAt_idx" ON "WorkspaceInvitation"("email", "expiresAt");

ALTER TABLE "WorkspaceInvitation"
ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvitation"
ADD CONSTRAINT "WorkspaceInvitation_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
