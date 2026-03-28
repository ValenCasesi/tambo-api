import type { Request, Response } from "express";
import { z } from "zod";
import { upsertMonthlyStatistic, getAnnualStatistics, getAllMonthlyStatistics, getMonthlyStatisticsByTambo, updateMonthlyStatistic, deleteMonthlyStatistic } from "../services/monthly-stats.service.js";

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
    ternerosMachosMuertosGuachera: z.coerce.number().min(0).optional(),
    ternerasHembrasMuertasGuachera: z.coerce.number().min(0).optional(),
    cantTernerasHembrasIngRecria: z.coerce.number().min(0).optional(),
    cantHembrasRecriaHastaServMuertas: z.coerce.number().min(0).optional()
});

export async function upsertMonthlyStatisticHandler(req: Request, res: Response) {
    try {
        const parsed = monthlyStatSchema.parse(req.body);
        const result = await upsertMonthlyStatistic(parsed);
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

        const data = await getAnnualStatistics(tamboId, year);
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
        const stats = await getAllMonthlyStatistics();
        return res.status(200).json(stats);
    } catch (err: any) {
        console.error("getAllMonthlyStatisticsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getMonthlyStatisticsByTamboHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.tamboId as string;
        const stats = await getMonthlyStatisticsByTambo(tamboId);
        return res.status(200).json(stats);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getMonthlyStatisticsByTamboHandler:", err);
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
    ternerosMachosMuertosGuachera: z.coerce.number().min(0).optional(),
    ternerasHembrasMuertasGuachera: z.coerce.number().min(0).optional(),
    cantTernerasHembrasIngRecria: z.coerce.number().min(0).optional(),
    cantHembrasRecriaHastaServMuertas: z.coerce.number().min(0).optional()
});

export async function updateMonthlyStatisticHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const parsed = monthlyStatUpdateSchema.parse(req.body);
        const result = await updateMonthlyStatistic(id, parsed);
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
        await deleteMonthlyStatistic(id);
        return res.status(200).json({ message: "Estadística eliminada exitosamente" });
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteMonthlyStatisticHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
