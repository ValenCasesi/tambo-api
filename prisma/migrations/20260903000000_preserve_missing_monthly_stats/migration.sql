-- Los campos vacíos de la grilla representan "sin dato", no el valor cero.
-- Hacerlos nullable permite conservar esa diferencia para los promedios de mercado.
ALTER TABLE `MonthlyStatistic`
    MODIFY `partosVaquillonas` DECIMAL(10, 2) NULL,
    MODIFY `partosVacas` DECIMAL(10, 2) NULL,
    MODIFY `vacasOrdene` DECIMAL(10, 2) NULL,
    MODIFY `vacasSecas` DECIMAL(10, 2) NULL,
    MODIFY `litrosUsina` DECIMAL(12, 2) NULL,
    MODIFY `litrosDescarte` DECIMAL(10, 2) NULL,
    MODIFY `litrosGuachera` DECIMAL(10, 2) NULL,
    MODIFY `partosTotales` DECIMAL(10, 2) NULL,
    MODIFY `vacasTotales` DECIMAL(10, 2) NULL,
    MODIFY `promedioLitrosVaca` DECIMAL(10, 2) NULL;
