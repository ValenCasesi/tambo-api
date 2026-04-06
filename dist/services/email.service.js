// src/services/email.service.ts
import nodemailer from "nodemailer";
// Configuración SMTP Básica (De momento será simulado)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
        user: process.env.SMTP_USER || "fake-user",
        pass: process.env.SMTP_PASS || "fake-pass"
    }
});
// Función central para envío
export async function sendMail(to, subject, text, html) {
    // Si no hay credenciales reales en .env, solo logeamos a la consola para no crashear
    if (!process.env.SMTP_USER) {
        console.log(`\n[EMAIL SIMULADO] Destino: ${to} | Asunto: ${subject}`);
        console.log(`[EMAIL CONTENIDO]:\n${text}\n---------------------------\n`);
        return true;
    }
    try {
        const info = await transporter.sendMail({
            from: `"Tamo Platform" <${process.env.SMTP_FROM || 'no-reply@tamo.com'}>`, // remitente
            to,
            subject,
            text,
            html
        });
        console.log("Mensaje enviado: %s", info.messageId);
        return info;
    }
    catch (error) {
        console.error("Error enviando email:", error);
        throw error;
    }
}
