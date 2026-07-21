import type { Request, Response } from "express";
import { z } from "zod";
import {
    upsertDateStatistic,
    getDateStatisticsByTambo,
    getDateStatisticById,
    getAnnualDateStatistics,
    updateDateStatistic,
    deleteDateStatistic
} from "../services/date-stats.service.js";

const dateStatSchema = z.object({
    tamboId: z.string().uuid("El tamboId debe ser un UUID válido"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    vacasElegidas: z.number().min(0, "Debe ser mayor o igual a 0").nullable(),
    vacasEnCelo: z.number().min(0, "Debe ser mayor o igual a 0").nullable(),
    vacasPreniadas: z.number().min(0, "Debe ser mayor o igual a 0").nullable()
}).refine(data => data.endDate > data.startDate, {
    message: "endDate debe ser posterior a startDate",
    path: ["endDate"]
});

const dateStatUpdateSchema = z.object({
    vacasElegidas: z.number().min(0).nullable().optional(),
    vacasEnCelo: z.number().min(0).nullable().optional(),
    vacasPreniadas: z.number().min(0).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
});

function handleError(err: any, res: Response, context: string) {
    if (err?.status && err?.message) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err?.issues) {
        return res.status(400).json({ error: "Error de validación", details: err.issues });
    }
    console.error(`${context}:`, err);
    return res.status(500).json({ error: "Internal server error" });
}

export async function upsertDateStatisticHandler(req: Request, res: Response) {
    try {
        const parsed = dateStatSchema.parse(req.body);
        const result = await upsertDateStatistic(parsed, req.user);
        return res.status(200).json(result);
    } catch (err: any) {
        return handleError(err, res, "upsertDateStatisticHandler");
    }
}

export async function getDateStatisticsByTamboHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.tamboId as string;
        const stats = await getDateStatisticsByTambo(tamboId, req.user);
        return res.status(200).json(stats);
    } catch (err: any) {
        return handleError(err, res, "getDateStatisticsByTamboHandler");
    }
}

export async function getDateStatisticByIdHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const stat = await getDateStatisticById(id, req.user);
        return res.status(200).json(stat);
    } catch (err: any) {
        return handleError(err, res, "getDateStatisticByIdHandler");
    }
}

export async function getAnnualDateStatisticsHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.tamboId as string;
        const year = parseInt(req.params.year as string, 10);

        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: "Año inválido. Debe estar entre 2000 y 2100." });
        }

        const data = await getAnnualDateStatistics(tamboId, year, req.user);
        return res.status(200).json(data);
    } catch (err: any) {
        return handleError(err, res, "getAnnualDateStatisticsHandler");
    }
}

export async function updateDateStatisticHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const parsed = dateStatUpdateSchema.parse(req.body);
        const result = await updateDateStatistic(id, parsed, req.user);
        return res.status(200).json(result);
    } catch (err: any) {
        return handleError(err, res, "updateDateStatisticHandler");
    }
}

export async function deleteDateStatisticHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        await deleteDateStatistic(id, req.user);
        return res.status(200).json({ message: "Estadística eliminada exitosamente" });
    } catch (err: any) {
        return handleError(err, res, "deleteDateStatisticHandler");
    }
}
