import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client.js";
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";
export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}
export async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
export async function login(email, plainPassword) {
    // 1. Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw { status: 401, message: "Credenciales inválidas" };
    }
    if (user.status === "DELETED") {
        throw { status: 403, message: "El usuario está deshabilitado" };
    }
    if (user.status === "PENDING") {
        throw { status: 403, message: "Usuario en revision" };
    }
    // 2. Verificar contraseña
    const isValid = await comparePassword(plainPassword, user.password);
    if (!isValid) {
        throw { status: 401, message: "Credenciales inválidas" };
    }
    // 3. Generar token JWT
    const token = jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
    }, JWT_SECRET, { expiresIn: "24h" });
    // 4. Retornar token y datos básicos (sin password)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return {
        token,
        user: safeUser
    };
}
export async function logout(token) {
    // In a pure stateless JWT setup, logout is handled client-side by deleting the token.
    // If we wanted to invalidate the token server-side before it expires, 
    // we would add it to a blacklist (e.g., in Redis or a DB table 'RevokedToken').
    // For now, this is a placeholder that simply returns success.
    return { success: true, message: "Sesión cerrada correctamente" };
}
export async function acceptTerms(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    return await prisma.user.update({
        where: { id: userId },
        data: { termsAccepted: true },
        select: { id: true, termsAccepted: true }
    });
}
