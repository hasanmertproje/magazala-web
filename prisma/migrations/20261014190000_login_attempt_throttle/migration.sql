CREATE TABLE "LoginAttemptBucket" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginAttemptBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "LoginAttemptBucket_windowStart_idx" ON "LoginAttemptBucket"("windowStart");
