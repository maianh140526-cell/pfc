-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OppSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OppSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "verificationTier" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "employmentType" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "benefits" TEXT,
    "locationText" TEXT,
    "workMode" TEXT NOT NULL DEFAULT 'ONSITE',
    "deadlineAt" DATETIME,
    "expireAt" DATETIME,
    "applyMode" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "externalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OppOpportunity_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppSavedOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OppSavedOpportunity_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OppSavedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OppOpportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REDIRECTED',
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "outboundClickedAt" DATETIME,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OppApplication_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OppApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OppOpportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppApplicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OppApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OppApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OppReminderLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppReminderPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OppReminderPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryId" TEXT,
    CONSTRAINT "OppNotification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerMemberId" TEXT NOT NULL,
    "applicationId" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OppAttachment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "OppApplication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OppDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OppVerificationDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OppFileBlob" (
    "storageKey" TEXT NOT NULL PRIMARY KEY,
    "bytes" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OppSession_token_key" ON "OppSession"("token");

-- CreateIndex
CREATE INDEX "OppSession_memberId_idx" ON "OppSession"("memberId");

-- CreateIndex
CREATE INDEX "ProviderProfile_memberId_idx" ON "ProviderProfile"("memberId");

-- CreateIndex
CREATE INDEX "OppOpportunity_status_deadlineAt_idx" ON "OppOpportunity"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "OppOpportunity_providerId_status_idx" ON "OppOpportunity"("providerId", "status");

-- CreateIndex
CREATE INDEX "OppOpportunity_type_status_publishedAt_idx" ON "OppOpportunity"("type", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OppSavedOpportunity_memberId_opportunityId_key" ON "OppSavedOpportunity"("memberId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "OppApplication_idempotencyKey_key" ON "OppApplication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OppApplication_memberId_createdAt_idx" ON "OppApplication"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "OppApplication_opportunityId_status_idx" ON "OppApplication"("opportunityId", "status");

-- CreateIndex
CREATE INDEX "OppApplicationEvent_applicationId_createdAt_idx" ON "OppApplicationEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "OppReminderLog_createdAt_idx" ON "OppReminderLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OppReminderLog_memberId_opportunityId_window_key" ON "OppReminderLog"("memberId", "opportunityId", "window");

-- CreateIndex
CREATE UNIQUE INDEX "OppReminderPreference_memberId_key" ON "OppReminderPreference"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "OppNotification_deliveryId_key" ON "OppNotification"("deliveryId");

-- CreateIndex
CREATE INDEX "OppNotification_memberId_createdAt_idx" ON "OppNotification"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OppAttachment_applicationId_key" ON "OppAttachment"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OppAttachment_storageKey_key" ON "OppAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "OppAttachment_ownerMemberId_idx" ON "OppAttachment"("ownerMemberId");

-- CreateIndex
CREATE INDEX "OppDelivery_status_nextAttemptAt_idx" ON "OppDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OppVerificationDecision_opportunityId_createdAt_idx" ON "OppVerificationDecision"("opportunityId", "createdAt");

