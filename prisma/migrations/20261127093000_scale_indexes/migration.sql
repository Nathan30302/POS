-- Scale indexes for platform directory + membership lookups (SQLite-safe)
CREATE INDEX IF NOT EXISTS "Business_status_idx" ON "Business"("status");
CREATE INDEX IF NOT EXISTS "Business_plan_idx" ON "Business"("plan");
CREATE INDEX IF NOT EXISTS "Business_createdAt_idx" ON "Business"("createdAt");
CREATE INDEX IF NOT EXISTS "Business_status_createdAt_idx" ON "Business"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");
