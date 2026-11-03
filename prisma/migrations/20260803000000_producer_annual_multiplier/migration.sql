ALTER TABLE `BillingInstallment`
    ADD COLUMN `priceMultiplierSnapshot` DECIMAL(5, 2) NOT NULL DEFAULT 1;

-- La implementación anterior cobraba 12 equivalentes mensuales a los
-- productores anuales. Preservamos esa regla en el historial; empresas y
-- cuotas mensuales ya guardan el precio completo de su período.
UPDATE `BillingInstallment`
SET `priceMultiplierSnapshot` = 12
WHERE `targetRoleSnapshot` = 'PRODUCTOR'
  AND `billingCycleSnapshot` = 'ANNUAL';
