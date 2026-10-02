-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "jobUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "compRange" TEXT NOT NULL DEFAULT 'Not disclosed',
    "expRange" TEXT NOT NULL DEFAULT '',
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "fitRationale" TEXT NOT NULL DEFAULT '',
    "greenFlags" TEXT NOT NULL DEFAULT '',
    "redFlags" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'MONITOR',
    "dateFound" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict" TEXT,
    "verdictNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'To Apply',
    "dateApplied" DATETIME,
    "resumeTailored" TEXT,
    "recruiterMessage" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT,
    "role" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "status" TEXT,
    "introVia" TEXT,
    "msgToMutual" TEXT,
    "msgToContact" TEXT,
    "connectionNote" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChat" DATETIME,
    "notes" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobUrl_key" ON "Job"("jobUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");
