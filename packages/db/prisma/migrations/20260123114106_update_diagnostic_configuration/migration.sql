-- CreateEnum
CREATE TYPE "DiagnosticPackVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "DiagnosticPack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticPackVersion" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DiagnosticPackVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "payload" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticPackVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticPack_code_key" ON "DiagnosticPack"("code");

-- CreateIndex
CREATE INDEX "DiagnosticPackVersion_packId_status_idx" ON "DiagnosticPackVersion"("packId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticPackVersion_packId_version_key" ON "DiagnosticPackVersion"("packId", "version");

-- AddForeignKey
ALTER TABLE "DiagnosticPackVersion" ADD CONSTRAINT "DiagnosticPackVersion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "DiagnosticPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticPackVersion" ADD CONSTRAINT "DiagnosticPackVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
