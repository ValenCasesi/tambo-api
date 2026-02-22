import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client.js";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

export async function hashPassword(plain: string) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
}

export async function login(email: string, plainPassword: string) {
    // 1. Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw { status: 401, message: "Credenciales inválidas" };
    }

    if (user.status === "DELETED") {
        throw { status: 403, message: "El usuario está deshabilitado" };
    }

    // 2. Verificar contraseña
    const isValid = await comparePassword(plainPassword, user.password);
    if (!isValid) {
        throw { status: 401, message: "Credenciales inválidas" };
    }

    // 3. Generar token JWT
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: "24h" }
    );

    // 4. Retornar token y datos básicos (sin password)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;

    return {
        token,
        user: safeUser
    };
}

export async function logout(token?: string) {
    // In a pure stateless JWT setup, logout is handled client-side by deleting the token.
    // If we wanted to invalidate the token server-side before it expires, 
    // we would add it to a blacklist (e.g., in Redis or a DB table 'RevokedToken').
    // For now, this is a placeholder that simply returns success.
    return { success: true, message: "Sesión cerrada correctamente" };
}