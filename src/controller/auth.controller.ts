import type { Request, Response } from "express";
import { z } from "zod";
import { login, logout, acceptTerms, changePassword, forgotPassword, resetPassword } from "../services/auth.service.js";

const loginSchema = z.object({
    email: z.string().email("Debe ser un correo electrónico válido"),
    password: z.string().min(1, "La contraseña es obligatoria")
});

export async function loginHandler(req: Request, res: Response) {
    try {
        const parsed = loginSchema.parse(req.body);
        const result = await login(parsed.email, parsed.password);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("loginHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function logoutHandler(req: Request, res: Response) {
    try {
        // Obtenemos el token del header Authorization si existe (Bear token)
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        const result = await logout(token);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("logoutHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function acceptTermsHandler(req: Request, res: Response) {
    try {
        const userId = req.body.userId; // in a real app, from req.user
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const result = await acceptTerms(userId);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("acceptTermsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const changePasswordSchema = z.object({
    email: z.string().email(),
    oldPassword: z.string().min(1, "La contraseña actual es requerida"),
    newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres")
});

export async function changePasswordHandler(req: Request, res: Response) {
    try {
        const parsed = changePasswordSchema.parse(req.body);
        const result = await changePassword(parsed.email, parsed.oldPassword, parsed.newPassword);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("changePasswordHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const forgotPasswordSchema = z.object({
    email: z.string().email()
});

export async function forgotPasswordHandler(req: Request, res: Response) {
    try {
        const parsed = forgotPasswordSchema.parse(req.body);
        const result = await forgotPassword(parsed.email);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("forgotPasswordHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const resetPasswordSchema = z.object({
    userId: z.string().uuid(),
    token: z.string().min(1),
    newPassword: z.string().min(6)
});

export async function resetPasswordHandler(req: Request, res: Response) {
    try {
        const parsed = resetPasswordSchema.parse(req.body);
        const result = await resetPassword(parsed.userId, parsed.token, parsed.newPassword);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("resetPasswordHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
