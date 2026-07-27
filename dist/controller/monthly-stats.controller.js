import { z } from "zod";
import { upsertMonthlyStatistic, getAnnualStatistics, getAllMonthlyStatistics, getMonthlyStatisticsByTambo, updateMonthlyStatistic, deleteMonthlyStatistic, getMyMonthlyStatsActivitySummary } from "../services/monthly-stats.service.js";
import { getStatsComparison } from "../services/stats-comparison.service.js";
const monthlyStatSchema = z.object({
    tamboId: z.string().uuid(),
    period: z.string().regex(/^\d{6}$/, "El periodo debe ser YYYYMM (ej: 202602)"),
    partosVaquillonas: z.coerce.number().min(0).optional(),
    partosVacas: z.coerce.number().min(0).optional(),
    vacasOrdene: z.coerce.number().min(0).optional(),
    vacasSecas: z.coerce.number().min(0).optional(),
    litrosUsina: z.coerce.number().min(0).optional(),
    litrosDescarte: z.coerce.number().min(0).optional(),
    litrosGuachera: z.coerce.number().min(0).optional(),
    ternerosMuertosPeriparto: z.coerce.number().min(0).optional(),
    ternerosMachosNacidosVivos: z.coerce.number().min(0).optional(),
    ternerasHembrasNacidasVivas: z.coerce.number().min(0).optional(),
    cantNacimientosMellizos: z.coerce.number().min(0).optional(),
    ternerosMuertosGuachera: z.coerce.number().min(0).optional(),
    ternerosIngresadosGuachera: z.coerce.number().min(0).optional(),
    cantTernerasHembrasIngRecria: z.coerce.number().min(0).optional(),
    cantHembrasRecriaHastaServMuertas: z.coerce.number().min(0).optional(),
    edadVaquillonasPrimerServicioMeses: z.coerce.number().min(0).optional(),
    cantVacasMuertasMes: z.coerce.number().min(0).optional(),
    cantVacasVendidasMes: z.coerce.number().min(0).optional(),
    CantVaquillonasPrenadas: z.coerce.number().min(0).optional(),
    CantVacasPrenadas: z.coerce.number().min(0).optional(),
    CantVacasAbortadas: z.coerce.number().min(0).optional(),
    cantVaquillonasAbortadas: z.coerce.number().min(0).optional(),
    diasIPPS: z.coerce.number().min(0).optional(),
    porcentajeIPPS: z.coerce.number().min(0).optional(),
    cantVacasMetritis: z.coerce.number().min(0).optional(),
    CantVacasRetencionPlacenta: z.coerce.number().min(0).optional(),
    cantVacasCaidas: z.coerce.number().min(0).optional(),
    diasDeLeche: z.coerce.number().min(0).optional(),
    conteoCelulasSomaticas: z.coerce.number().min(0).optional(),
    conteoBacteriasTotales: z.coerce.number().min(0).optional(),
    casosClinicosMastitis: z.coerce.number().min(0).optional(),
    conteoCultivoPlacasPositivo: z.coerce.number().min(0).optional(),
    conteoCultivoPlacasContaminados: z.coerce.number().min(0).optional()
});
const statsComparisonQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    size: z.enum(["CHICO", "MEDIANO", "GRANDE", "MEGA"]).optional(),
    cuenca: z.enum([
        "CENTRO_CBA_VILLA_MARIA", "SANTA_FE_CENTRO", "SANTA_FE_NORTE",
        "CBA_SUR", "ENTRE_RIOS_OESTE", "ENTRE_RIOS_ESTE", "CBA_NORTE",
        "BSAS_OESTE", "BSAS_ABASTO_NORTE", "BSAS_ABASTO_SUR",
        "BSAS_MAR_Y_SIERRAS", "LA_PAMPA", "NOA", "NEA", "PATAGONICA"
    ]).optional(),
    system: z.enum([
        "PASTORIL", "PASTORIL_SUPLEMENTADO", "DRY_LOT",
        "FREE_STALL", "COMPOST_BARN"
    ]).optional()
});
export async function getStatsComparisonHandler(req, res) {
    try {
        const query = statsComparisonQuerySchema.parse(req.query);
        const data = await getStatsComparison(req.params.tamboId, query.year, {
            size: query.size,
            cuenca: query.cuenca,
            system: query.system
        }, req.user);
        return res.status(200).json(data);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("getStatsComparisonHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function upsertMonthlyStatisticHandler(req, res) {
    try {
        const parsed = monthlyStatSchema.parse(req.body);
        const result = await upsertMonthlyStatistic(parsed, req.user);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("upsertMonthlyStatisticHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getAnnualStatisticsHandler(req, res) {
    try {
        const tamboId = req.params.tamboId;
        const year = parseInt(req.params.year, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: "Año inválido" });
        }
        const data = await getAnnualStatistics(tamboId, year, req.user);
        return res.status(200).json(data);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getAnnualStatisticsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getAllMonthlyStatisticsHandler(req, res) {
    try {
        const stats = await getAllMonthlyStatistics(req.user);
        return res.status(200).json(stats);
    }
    catch (err) {
        console.error("getAllMonthlyStatisticsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getMonthlyStatisticsByTamboHandler(req, res) {
    try {
        const tamboId = req.params.tamboId;
        const stats = await getMonthlyStatisticsByTambo(tamboId, req.user);
        return res.status(200).json(stats);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getMonthlyStatisticsByTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getMyMonthlyStatsActivitySummaryHandler(req, res) {
    try {
        if (!req.user)
            return res.status(401).json({ error: "No autenticado" });
        const summary = await getMyMonthlyStatsActivitySummary(req.user.id);
        return res.status(200).json(summary);
    }
    catch (err) {
        console.error("getMyMonthlyStatsActivitySummaryHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const monthlyStatUpdateSchema = z.object({
    partosVaquillonas: z.coerce.number().min(0).optional(),
    partosVacas: z.coerce.number().min(0).optional(),
    vacasOrdene: z.coerce.number().min(0).optional(),
    vacasSecas: z.coerce.number().min(0).optional(),
    litrosUsina: z.coerce.number().min(0).optional(),
    litrosDescarte: z.coerce.number().min(0).optional(),
    litrosGuachera: z.coerce.number().min(0).optional(),
    ternerosMuertosPeriparto: z.coerce.number().min(0).optional(),
    ternerosMachosNacidosVivos: z.coerce.number().min(0).optional(),
    ternerasHembrasNacidasVivas: z.coerce.number().min(0).optional(),
    cantNacimientosMellizos: z.coerce.number().min(0).optional(),
    ternerosMuertosGuachera: z.coerce.number().min(0).optional(),
    ternerosIngresadosGuachera: z.coerce.number().min(0).optional(),
    cantTernerasHembrasIngRecria: z.coerce.number().min(0).optional(),
    cantHembrasRecriaHastaServMuertas: z.coerce.number().min(0).optional(),
    edadVaquillonasPrimerServicioMeses: z.coerce.number().min(0).optional(),
    cantVacasMuertasMes: z.coerce.number().min(0).optional(),
    cantVacasVendidasMes: z.coerce.number().min(0).optional(),
    CantVaquillonasPrenadas: z.coerce.number().min(0).optional(),
    CantVacasPrenadas: z.coerce.number().min(0).optional(),
    CantVacasAbortadas: z.coerce.number().min(0).optional(),
    cantVaquillonasAbortadas: z.coerce.number().min(0).optional(),
    diasIPPS: z.coerce.number().min(0).optional(),
    porcentajeIPPS: z.coerce.number().min(0).optional(),
    cantVacasMetritis: z.coerce.number().min(0).optional(),
    CantVacasRetencionPlacenta: z.coerce.number().min(0).optional(),
    cantVacasCaidas: z.coerce.number().min(0).optional(),
    diasDeLeche: z.coerce.number().min(0).optional(),
    conteoCelulasSomaticas: z.coerce.number().min(0).optional(),
    conteoBacteriasTotales: z.coerce.number().min(0).optional(),
    casosClinicosMastitis: z.coerce.number().min(0).optional(),
    conteoCultivoPlacasPositivo: z.coerce.number().min(0).optional(),
    conteoCultivoPlacasContaminados: z.coerce.number().min(0).optional()
});
export async function updateMonthlyStatisticHandler(req, res) {
    try {
        const id = req.params.id;
        const parsed = monthlyStatUpdateSchema.parse(req.body);
        const result = await updateMonthlyStatistic(id, parsed, req.user);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("updateMonthlyStatisticHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function deleteMonthlyStatisticHandler(req, res) {
    try {
        const id = req.params.id;
        await deleteMonthlyStatistic(id, req.user);
        return res.status(200).json({ message: "Estadística eliminada exitosamente" });
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteMonthlyStatisticHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
