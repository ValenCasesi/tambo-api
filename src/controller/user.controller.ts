import type { Request, Response } from "express";
import { z } from "zod";
import { createUser } from "../services/user.service.js";

const createUserSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["PRODUCTOR", "EMPRESA", "ADMIN"]).optional(),
    phone: z.string().optional(),
    cuit: z.string().optional(),
    imageUrl: z.string().url().optional(),
});

export async function createUserHandler(req: Request, res: Response) {
    try {
        const parsed = createUserSchema.parse(req.body);
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