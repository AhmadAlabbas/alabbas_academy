CREATE TABLE "auth_rate_limits" (
  "key" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "auth_rate_limits_attempts_positive" CHECK ("attempts" >= 1)
);
CREATE INDEX "auth_rate_limits_expiresAt_idx" ON "auth_rate_limits" ("expiresAt");
