import { z } from "zod";
import { createTambo, getAllTambos, getTambosByUser, updateTambo, deleteTambo } from "../services/tambo.service.js";
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
export async function createTamboHandler(req, res) {
    try {
        // En un caso real con auth, el userId podría venir de req.user.id
        // Asumiendo que se pasa en el body por ahora:
        const parsed = tamboSchema.parse(req.body);
        if (req.user && req.user.role === "PRODUCTOR") {
            parsed.userId = req.user.id;
        }
        const tambo = await createTambo(parsed);
        return res.status(201).json(tambo);
    }
    catch (err) {
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
export async function getAllTambosHandler(req, res) {
    try {
        const tambos = await getAllTambos(req.user);
        return res.status(200).json(tambos);
    }
    catch (err) {
        console.error("getAllTambosHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getTambosByUserHandler(req, res) {
    try {
        const userId = req.params.userId;
        if (req.user && req.user.role === "PRODUCTOR" && req.user.id !== userId) {
            return res.status(403).json({ error: "No puedes ver tambos de otros productores" });
        }
        const tambos = await getTambosByUser(userId);
        return res.status(200).json(tambos);
    }
    catch (err) {
        console.error("getTambosByUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const tamboUpdateSchema = tamboSchema.omit({ userId: true }).partial();
export async function updateTamboHandler(req, res) {
    try {
        const tamboId = req.params.id;
        const parsed = tamboUpdateSchema.parse(req.body);
        const tambo = await updateTambo(tamboId, parsed, req.user);
        return res.status(200).json(tambo);
    }
    catch (err) {
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
export async function deleteTamboHandler(req, res) {
    try {
        const tamboId = req.params.id;
        await deleteTambo(tamboId, req.user);
        return res.status(200).json({ message: "Tambo eliminado exitosamente" });
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteTamboHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
