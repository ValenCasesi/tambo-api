import { z } from "zod";
import { login, logout } from "../services/auth.service.js";
const loginSchema = z.object({
    email: z.string().email("Debe ser un correo electrónico válido"),
    password: z.string().min(1, "La contraseña es obligatoria")
});
export async function loginHandler(req, res) {
    try {
        const parsed = loginSchema.parse(req.body);
        const result = await login(parsed.email, parsed.password);
        return res.status(200).json(result);
    }
    catch (err) {
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
export async function logoutHandler(req, res) {
    try {
        // Obtenemos el token del header Authorization si existe (Bear token)
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];
        const result = await logout(token);
        return res.status(200).json(result);
    }
    catch (err) {
        console.error("logoutHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
