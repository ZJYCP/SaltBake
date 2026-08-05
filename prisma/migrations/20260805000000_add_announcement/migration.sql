-- Add public announcement publishing and homepage banner display.

CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Announcement_enabled_createdAt_idx" ON "Announcement"("enabled", "createdAt");
