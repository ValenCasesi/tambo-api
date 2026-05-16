import { Request, Response } from "express";
import { z } from "zod";
import { createTambo, getAllTambos, getTambosByUser, updateTambo, deleteTambo, hardDeleteTambo } from "../services/tambo.service.js";

const tamboSchema = z.object({
    userId: z.string().uuid("El userId debe ser un UUID válido"),
    name: z.string().min(1, "El nombre es requerido"),
    location: z.string().min(1, "La localidad es requerida"),
    province: z.string().min(1, "La provincia es requerida"),
    cuenca: z.enum([
        "CENTRO_CBA_VILLA_MARIA", "SANTA_FE_CENTRO", "SANTA_FE_NORTE",
        "CBA_SUR", "ENTRE_RIOS_OESTE", "ENTRE_RIOS_ESTE", "CBA_NORTE",
        "BSAS_OESTE", "BSAS_ABASTO_NORTE", "BSAS_ABASTO_SUR",
        "BSAS_MAR_Y_SIERRAS", "LA_PAMPA", "NOA", "NEA", "PATAGONICA"
    ]),
    size: z.enum(["CHICO", "MEDIANO", "GRANDE", "MEGA"]),
    system: z.enum([
        "PASTORIL", "PASTORIL_SUPLEMENTADO", "DRY_LOT",
        "FREE_STALL", "COMPOST_BARN"
    ])
});

export async function createTamboHandler(req: Request, res: Response) {
    try {
        // En un caso real con auth, el userId podría venir de req.user.id
        // Asumiendo que se pasa en el body por ahora:
        const parsed = tamboSchema.parse(req.body);
        if (req.user && req.user.role === "PRODUCTOR") {
            parsed.userId = req.user.id;
        }
        const tambo = await createTambo(parsed as any);
        return res.status(201).json(tambo);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Error de validación", details: err.issues });
        }
        console.error("createTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getAllTambosHandler(req: Request, res: Response) {
    try {
        const filters = {
            cuenca: req.query.cuenca as any,
            size: req.query.size as any,
            system: req.query.system as any
        };
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await getAllTambos(req.user, filters, { page, limit });
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("getAllTambosHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getTambosByUserHandler(req: Request, res: Response) {
    try {
        const userId = req.params.userId as string;
        if (req.user && req.user.role === "PRODUCTOR" && req.user.id !== userId) {
            return res.status(403).json({ error: "No puedes ver tambos de otros productores" });
        }
        const tambos = await getTambosByUser(userId);
        return res.status(200).json(tambos);
    } catch (err: any) {
        console.error("getTambosByUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const tamboUpdateSchema = tamboSchema.omit({ userId: true }).partial();

export async function updateTamboHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.id as string;
        const parsed = tamboUpdateSchema.parse(req.body);
        const tambo = await updateTambo(tamboId, parsed as any, req.user);
        return res.status(200).json(tambo);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Error de validación", details: err.issues });
        }
        console.error("updateTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteTamboHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.id as string;
        await deleteTambo(tamboId, req.user);
        return res.status(200).json({ message: "Tambo eliminado exitosamente" });
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function hardDeleteTamboHandler(req: Request, res: Response) {
    try {
        const tamboId = req.params.id as string;
        await hardDeleteTambo(tamboId, req.user);
        return res.status(200).json({ message: "Tambo eliminado físicamente exitosamente" });
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("hardDeleteTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
