import { z } from "zod";
import { createUser, updateUser, getAllUsers, deleteUser, getPendingUsers, approveUser, rejectUser, reactivateUser } from "../services/user.service.js";
import { uploadImage } from "../services/cloudinary.service.js";
const createUserSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["PRODUCTOR", "EMPRESA", "ADMIN"]).optional(),
    phone: z.string().optional(),
    cuit: z.string().min(1, "El CUIT es obligatorio"),
    razonSocial: z.string().min(1, "La Razón Social es obligatoria"),
    localidad: z.string().min(1, "La Localidad es obligatoria"),
    imageUrl: z.string().url().optional(),
});
export async function createUserHandler(req, res) {
    try {
        let imageUrl = undefined;
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            imageUrl = await uploadImage(dataURI);
        }
        const parsed = createUserSchema.parse({
            ...req.body,
            imageUrl: imageUrl || req.body.imageUrl,
        });
        const user = await createUser(parsed);
        return res.status(201).json(user);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("createUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const updateUserSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.enum(["PRODUCTOR", "EMPRESA", "ADMIN"]).optional(),
    phone: z.string().optional().nullable(),
    cuit: z.string().optional().nullable(),
    razonSocial: z.string().optional().nullable(),
    localidad: z.string().optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
});
export async function updateUserHandler(req, res) {
    try {
        const id = req.params.id;
        let imageUrl = undefined;
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            imageUrl = await uploadImage(dataURI);
        }
        const parsed = updateUserSchema.parse({
            ...req.body,
            ...(imageUrl ? { imageUrl } : {}),
        });
        const user = await updateUser({ id, ...parsed });
        return res.status(200).json(user);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("updateUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getAllUsersHandler(req, res) {
    try {
        const status = req.query.status;
        const users = await getAllUsers(status);
        return res.status(200).json(users);
    }
    catch (err) {
        console.error("getAllUsersHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getPendingUsersHandler(req, res) {
    try {
        const users = await getPendingUsers();
        return res.status(200).json(users);
    }
    catch (err) {
        console.error("getPendingUsersHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function approveUserHandler(req, res) {
    try {
        const id = req.params.id;
        const result = await approveUser(id);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("approveUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function rejectUserHandler(req, res) {
    try {
        const id = req.params.id;
        const result = await rejectUser(id);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("rejectUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function deleteUserHandler(req, res) {
    try {
        const id = req.params.id;
        const result = await deleteUser(id);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function reactivateUserHandler(req, res) {
    try {
        const id = req.params.id;
        const result = await reactivateUser(id);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("reactivateUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
