import { z } from "zod";
import { upsertDateStatistic, getDateStatisticsByTambo, getDateStatisticById, getAnnualDateStatistics, updateDateStatistic, deleteDateStatistic } from "../services/date-stats.service.js";
const dateStatSchema = z.object({
    tamboId: z.string().uuid("El tamboId debe ser un UUID válido"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    vacasElegidas: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
    vacasEnCelo: z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
    vacasPreniadas: z.coerce.number().min(0, "Debe ser mayor o igual a 0")
}).refine(data => data.endDate > data.startDate, {
    message: "endDate debe ser posterior a startDate",
    path: ["endDate"]
});
const dateStatUpdateSchema = z.object({
    vacasElegidas: z.coerce.number().min(0).optional(),
    vacasEnCelo: z.coerce.number().min(0).optional(),
    vacasPreniadas: z.coerce.number().min(0).optional()
}).refine(data => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
});
function handleError(err, res, context) {
    if (err?.status && err?.message) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err?.issues) {
        return res.status(400).json({ error: "Error de validación", details: err.issues });
    }
    console.error(`${context}:`, err);
    return res.status(500).json({ error: "Internal server error" });
}
export async function upsertDateStatisticHandler(req, res) {
    try {
        const parsed = dateStatSchema.parse(req.body);
        const result = await upsertDateStatistic(parsed);
        return res.status(200).json(result);
    }
    catch (err) {
        return handleError(err, res, "upsertDateStatisticHandler");
    }
}
export async function getDateStatisticsByTamboHandler(req, res) {
    try {
        const tamboId = req.params.tamboId;
        const stats = await getDateStatisticsByTambo(tamboId);
        return res.status(200).json(stats);
    }
    catch (err) {
        return handleError(err, res, "getDateStatisticsByTamboHandler");
    }
}
export async function getDateStatisticByIdHandler(req, res) {
    try {
        const id = req.params.id;
        const stat = await getDateStatisticById(id);
        return res.status(200).json(stat);
    }
    catch (err) {
        return handleError(err, res, "getDateStatisticByIdHandler");
    }
}
export async function getAnnualDateStatisticsHandler(req, res) {
    try {
        const tamboId = req.params.tamboId;
        const year = parseInt(req.params.year, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: "Año inválido. Debe estar entre 2000 y 2100." });
        }
        const data = await getAnnualDateStatistics(tamboId, year);
        return res.status(200).json(data);
    }
    catch (err) {
        return handleError(err, res, "getAnnualDateStatisticsHandler");
    }
}
export async function updateDateStatisticHandler(req, res) {
    try {
        const id = req.params.id;
        const parsed = dateStatUpdateSchema.parse(req.body);
        const result = await updateDateStatistic(id, parsed);
        return res.status(200).json(result);
    }
    catch (err) {
        return handleError(err, res, "updateDateStatisticHandler");
    }
}
export async function deleteDateStatisticHandler(req, res) {
    try {
        const id = req.params.id;
        await deleteDateStatistic(id);
        return res.status(200).json({ message: "Estadística eliminada exitosamente" });
    }
    catch (err) {
        return handleError(err, res, "deleteDateStatisticHandler");
    }
}
