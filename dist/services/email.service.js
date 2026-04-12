// src/services/email.service.ts
import nodemailer from "nodemailer";
// Configuración SMTP Básica (De momento será simulado)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // SSL para 465, TLS para 587
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
            from: `"Sinergia Plataforma" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, // remitente hostinger
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
export function buildHtmlTemplate({ title, messageLines, buttonText, buttonUrl }) {
    const linesHtml = messageLines.map(line => `<p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">${line}</p>`).join("");
    const buttonHtml = buttonText && buttonUrl ? `
        <div style="text-align: center; margin: 32px 0;">
            <a href="${buttonUrl}" style="background-color: #4a34db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">${buttonText}</a>
        </div>
    ` : "";
    return `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <tr>
                <td style="padding: 32px; border-bottom: 2px solid #f3f4f6;">
                    <h1 style="color: #4a34db; font-size: 24px; font-weight: 700; margin: 0; text-align: center;">Sinergia</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 32px;">
                    <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin: 0 0 24px;">${title}</h2>
                    ${linesHtml}
                    ${buttonHtml}
                </td>
            </tr>
            <tr>
                <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 14px; margin: 0;">&copy; ${new Date().getFullYear()} Sinergia Plataforma. Todos los derechos reservados.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}
