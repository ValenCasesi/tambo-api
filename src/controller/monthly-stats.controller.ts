import type { Request, Response } from "express";
import { z } from "zod";
import { upsertMonthlyStatistic, getAnnualStatistics, getAllMonthlyStatistics, getMonthlyStatisticsByTambo, updateMonthlyStatistic, deleteMonthlyStatistic, getMyMonthlyStatsActivitySummary } from "../services/monthly-stats.service.js";
import { getStatsComparison } from "../services/stats-comparison.service.js";

export const optionalNullableNonNegativeNumber = z.preprocess(
    (value) => value === "" ? null : value,
    z.coerce.number().min(0).nullable().optional()
);

const monthlyStatSchema = z.object({
    tamboId: z.string().uuid(),
    period: z.string().regex(/^\d{6}$/, "El periodo debe ser YYYYMM (ej: 202602)"),
    partosVaquillonas: optionalNullableNonNegativeNumber,
    partosVacas: optionalNullableNonNegativeNumber,
    vacasOrdene: optionalNullableNonNegativeNumber,
    vacasSecas: optionalNullableNonNegativeNumber,
    litrosUsina: optionalNullableNonNegativeNumber,
    litrosDescarte: optionalNullableNonNegativeNumber,
    litrosGuachera: optionalNullableNonNegativeNumber,
    ternerosMuertosPeriparto: optionalNullableNonNegativeNumber,
    ternerosMachosNacidosVivos: optionalNullableNonNegativeNumber,
    ternerasHembrasNacidasVivas: optionalNullableNonNegativeNumber,
    cantNacimientosMellizos: optionalNullableNonNegativeNumber,
    ternerosMuertosGuachera: optionalNullableNonNegativeNumber,
    ternerosIngresadosGuachera: optionalNullableNonNegativeNumber,
    cantTernerasHembrasIngRecria: optionalNullableNonNegativeNumber,
    cantHembrasRecriaHastaServMuertas: optionalNullableNonNegativeNumber,
    edadVaquillonasPrimerServicioMeses: optionalNullableNonNegativeNumber,
    cantVacasMuertasMes: optionalNullableNonNegativeNumber,
    cantVacasVendidasMes: optionalNullableNonNegativeNumber,
    CantVaquillonasPrenadas: optionalNullableNonNegativeNumber,
    CantVacasPrenadas: optionalNullableNonNegativeNumber,
    CantVacasAbortadas: optionalNullableNonNegativeNumber,
    cantVaquillonasAbortadas: optionalNullableNonNegativeNumber,
    diasIPPS: optionalNullableNonNegativeNumber,
    porcentajeIPPS: optionalNullableNonNegativeNumber,
    cantVacasMetritis: optionalNullableNonNegativeNumber,
    CantVacasRetencionPlacenta: optionalNullableNonNegativeNumber,
    cantVacasCaidas: optionalNullableNonNegativeNumber,
    diasDeLeche: optionalNullableNonNegativeNumber,
    conteoCelulasSomaticas: optionalNullableNonNegativeNumber,
    conteoBacteriasTotales: optionalNullableNonNegativeNumber,
    casosClinicosMastitis: optionalNullableNonNegativeNumber,
    conteoCultivoPlacasPositivo: optionalNullableNonNegativeNumber,
    conteoCultivoPlacasContaminados: optionalNullableNonNegativeNumber
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

export async function getStatsComparisonHandler(req: Request, res: Response) {
    try {
        const query = statsComparisonQuerySchema.parse(req.query);
        const data = await getStatsComparison(
            req.params.tamboId as string,
            query.year,
            {
                size: query.size,
                cuenca: query.cuenca,
                system: query.system
            },
            req.user
        );
        return res.status(200).json(data);
    } catch (err: any) {
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

export async function upsertMonthlyStatisticHandler(req: Request, res: Response) {
    try {
        const parsed = monthlyStatSchema.parse(req.body);
        const result = await upsertMonthlyStatistic(parsed, req.user);
        return res.status(200).json(result);
    } catch (err: any) {
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

export async function getAnnualStatisticsHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.tamboId as string;
        const year = parseInt(req.params.year as string, 10);

        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: "Año inválido" });
        }

        const data = await getAnnualStatistics(tamboId, year, req.user);
        return res.status(200).json(data);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getAnnualStatisticsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getAllMonthlyStatisticsHandler(req: Request, res: Response) {
    try {
        const stats = await getAllMonthlyStatistics(req.user);
        return res.status(200).json(stats);
    } catch (err: any) {
        console.error("getAllMonthlyStatisticsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getMonthlyStatisticsByTamboHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.tamboId as string;
        const stats = await getMonthlyStatisticsByTambo(tamboId, req.user);
        return res.status(200).json(stats);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getMonthlyStatisticsByTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getMyMonthlyStatsActivitySummaryHandler(req: Request, res: Response) {
    try {
        if (!req.user) return res.status(401).json({ error: "No autenticado" });
        const summary = await getMyMonthlyStatsActivitySummary(req.user.id);
        return res.status(200).json(summary);
    } catch (err: any) {
        console.error("getMyMonthlyStatsActivitySummaryHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const monthlyStatUpdateSchema = z.object({
    partosVaquillonas: optionalNullableNonNegativeNumber,
    partosVacas: optionalNullableNonNegativeNumber,
    vacasOrdene: optionalNullableNonNegativeNumber,
    vacasSecas: optionalNullableNonNegativeNumber,
    litrosUsina: optionalNullableNonNegativeNumber,
    litrosDescarte: optionalNullableNonNegativeNumber,
    litrosGuachera: optionalNullableNonNegativeNumber,
    ternerosMuertosPeriparto: optionalNullableNonNegativeNumber,
    ternerosMachosNacidosVivos: optionalNullableNonNegativeNumber,
    ternerasHembrasNacidasVivas: optionalNullableNonNegativeNumber,
    cantNacimientosMellizos: optionalNullableNonNegativeNumber,
    ternerosMuertosGuachera: optionalNullableNonNegativeNumber,
    ternerosIngresadosGuachera: optionalNullableNonNegativeNumber,
    cantTernerasHembrasIngRecria: optionalNullableNonNegativeNumber,
    cantHembrasRecriaHastaServMuertas: optionalNullableNonNegativeNumber,
    edadVaquillonasPrimerServicioMeses: optionalNullableNonNegativeNumber,
    cantVacasMuertasMes: optionalNullableNonNegativeNumber,
    cantVacasVendidasMes: optionalNullableNonNegativeNumber,
    CantVaquillonasPrenadas: optionalNullableNonNegativeNumber,
    CantVacasPrenadas: optionalNullableNonNegativeNumber,
    CantVacasAbortadas: optionalNullableNonNegativeNumber,
    cantVaquillonasAbortadas: optionalNullableNonNegativeNumber,
    diasIPPS: optionalNullableNonNegativeNumber,
    porcentajeIPPS: optionalNullableNonNegativeNumber,
    cantVacasMetritis: optionalNullableNonNegativeNumber,
    CantVacasRetencionPlacenta: optionalNullableNonNegativeNumber,
    cantVacasCaidas: optionalNullableNonNegativeNumber,
    diasDeLeche: optionalNullableNonNegativeNumber,
    conteoCelulasSomaticas: optionalNullableNonNegativeNumber,
    conteoBacteriasTotales: optionalNullableNonNegativeNumber,
    casosClinicosMastitis: optionalNullableNonNegativeNumber,
    conteoCultivoPlacasPositivo: optionalNullableNonNegativeNumber,
    conteoCultivoPlacasContaminados: optionalNullableNonNegativeNumber
});

export async function updateMonthlyStatisticHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const parsed = monthlyStatUpdateSchema.parse(req.body);
        const result = await updateMonthlyStatistic(id, parsed, req.user);
        return res.status(200).json(result);
    } catch (err: any) {
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

export async function deleteMonthlyStatisticHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        await deleteMonthlyStatistic(id, req.user);
        return res.status(200).json({ message: "Estadística eliminada exitosamente" });
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteMonthlyStatisticHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
