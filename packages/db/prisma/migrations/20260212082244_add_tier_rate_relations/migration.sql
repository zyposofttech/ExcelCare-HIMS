-- AddForeignKey
ALTER TABLE "PatientPricingTierRate" ADD CONSTRAINT "PatientPricingTierRate_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPricingTierRate" ADD CONSTRAINT "PatientPricingTierRate_chargeMasterItemId_fkey" FOREIGN KEY ("chargeMasterItemId") REFERENCES "ChargeMasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
