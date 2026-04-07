import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client.js";
import { sendMail } from "./email.service.js";
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
export async function changePassword(email, oldPass, newPass) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    const isValid = await comparePassword(oldPass, user.password);
    if (!isValid)
        throw { status: 401, message: "La contraseña actual es incorrecta" };
    const newHashed = await hashPassword(newPass);
    await prisma.user.update({
        where: { email },
        data: { password: newHashed }
    });
    return { success: true, message: "Contraseña actualizada correctamente" };
}
export async function forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status === "DELETED") {
        return { success: true, message: "Si esta dirección de correo electrónico está registrada, recibirás instrucciones brevemente." };
    }
    // Stateless JWT trick: The secret is combining our generic secret + their current password hash.
    const secret = JWT_SECRET + user.password;
    const token = jwt.sign({ email: user.email, id: user.id }, secret, { expiresIn: '15m' });
    // In a real frontend setup, URL would be your SPA address. 
    // Example: const resetUrl = `https://tamo.com/reset-password?token=${token}&id=${user.id}`;
    const resetUrl = `http://localhost:3000/api/auth/reset-password-testlink?token=${token}&userId=${user.id}`;
    sendMail(user.email, "Recuperación de Contraseña - TAMO", `Hola ${user.firstName},\n\nHemos recibido una solicitud para restablecer tu contraseña.\nPodés hacerlo ingresando al siguiente enlace (válido por 15 minutos):\n\n${resetUrl}\n\nSi no fuiste vos, ignorá este mensaje.\n\nSaludos,\nEl equipo de TAMO.`).catch(err => console.error("Error sending forgot password email:", err));
    return { success: true, message: "Si esta dirección de correo electrónico está registrada, recibirás instrucciones brevemente." };
}
export async function resetPassword(userId, token, newPass) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === "DELETED") {
        throw { status: 400, message: "Enlace inválido o expirado" };
    }
    const secret = JWT_SECRET + user.password;
    try {
        jwt.verify(token, secret);
    }
    catch (e) {
        // If password was already changed, the secret changed, failing verify.
        // Or if 15 mins passed, it also fails.
        throw { status: 400, message: "Enlace inválido, utilizado o expirado" };
    }
    const newHashed = await hashPassword(newPass);
    await prisma.user.update({
        where: { id: userId },
        data: { password: newHashed }
    });
    return { success: true, message: "Tu contraseña ha sido restablecida correctamente. Ya podés iniciar sesión." };
}
