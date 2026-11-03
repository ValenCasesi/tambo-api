import type { Request, Response } from "express";
import { z } from "zod";
import { BillingCycle, BillingPaymentMethod } from "@prisma/client";
import { createUser, updateUser, getAllUsers, deleteUser, getPendingUsers, approveUser, rejectUser, reactivateUser, getUserTambos } from "../services/user.service.js";
import { uploadImage } from "../services/cloudinary.service.js";

const optionalBillingPlanIdSchema = z.preprocess(
    (value) => value === "" ? null : value,
    z.string().uuid().nullable().optional()
);

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
    billingPlanId: optionalBillingPlanIdSchema,
    billingCycle: z.nativeEnum(BillingCycle).optional(),
    billingDiscountPercent: z.coerce.number().min(0).max(100).optional(),
    billingPaymentMethod: z.nativeEnum(BillingPaymentMethod).optional(),
});

export async function createUserHandler(req: Request, res: Response) {
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
    } catch (err: any) {
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
    billingPlanId: optionalBillingPlanIdSchema,
    billingCycle: z.nativeEnum(BillingCycle).optional(),
    billingDiscountPercent: z.coerce.number().min(0).max(100).optional(),
    billingPaymentMethod: z.nativeEnum(BillingPaymentMethod).optional(),
});

export async function updateUserHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;

        if (req.user && req.user.role !== "ADMIN") {
            if (id !== req.user.id) {
                return res.status(403).json({ error: "No tienes permisos para modificar este perfil" });
            }
            delete req.body.role;
            delete req.body.email;
            delete req.body.billingPlanId;
            delete req.body.billingCycle;
            delete req.body.billingDiscountPercent;
            delete req.body.billingPaymentMethod;
        }

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
    } catch (err: any) {
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

export async function getAllUsersHandler(req: Request, res: Response) {
    try {
        const users = await getAllUsers({
            status: req.query.status as string | undefined,
            search: req.query.search as string | undefined,
            localidad: req.query.localidad as string | undefined
        });
        return res.status(200).json(users);
    } catch (err: any) {
        console.error("getAllUsersHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getUserTambosHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const tambos = await getUserTambos(id);
        return res.status(200).json(tambos);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getUserTambosHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getPendingUsersHandler(req: Request, res: Response) {
    try {
        const users = await getPendingUsers();
        return res.status(200).json(users);
    } catch (err: any) {
        console.error("getPendingUsersHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function approveUserHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const parsed = z.object({
            billingPlanId: optionalBillingPlanIdSchema,
        }).parse(req.body ?? {});
        const result = await approveUser(id, parsed.billingPlanId);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("approveUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function rejectUserHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const result = await rejectUser(id);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("rejectUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteUserHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const result = await deleteUser(id, req.user?.id);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function reactivateUserHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const result = await reactivateUser(id);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("reactivateUserHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

