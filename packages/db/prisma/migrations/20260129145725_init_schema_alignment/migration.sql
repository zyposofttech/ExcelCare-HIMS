-- AlterTable
ALTER TABLE "ChargeMasterItem" ALTER COLUMN "chargeUnit" SET DEFAULT 'PER_UNIT';

-- AlterTable
ALTER TABLE "ServicePackage" ALTER COLUMN "chargeUnit" SET DEFAULT 'PER_PACKAGE';
