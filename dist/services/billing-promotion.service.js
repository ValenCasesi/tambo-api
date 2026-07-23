import { BillingPromotionNotificationRecipient, BillingPromotionNotificationStatus, Role, } from "@prisma/client";
import prisma from "../prisma/client.js";
import { buildHtmlTemplate, sendMail } from "./email.service.js";
const DAY_MS = 24 * 60 * 60 * 1000;
const ALERT_MILESTONES = [30, 7, 0];
function dateOnly(value) {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw { status: 400, message: "Las fechas deben tener formato YYYY-MM-DD" };
    }
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
        throw { status: 400, message: "La fecha indicada no es válida" };
    }
    return parsed;
}
function todayDate() {
    const argentinaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Cordoba",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    return dateOnly(argentinaDate);
}
function addDays(date, amount) {
    return new Date(date.getTime() + amount * DAY_MS);
}
function daysBetween(from, to) {
    return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}
export function getPromotionStatus(promotion, referenceDate = todayDate()) {
    if (promotion.cancelledAt)
        return "CANCELLED";
    if (referenceDate < promotion.startDate)
        return "SCHEDULED";
    if (referenceDate > promotion.endDate)
        return "EXPIRED";
    return "ACTIVE";
}
export function serializeBillingPromotion(promotion) {
    return {
        ...promotion,
        discountPercent: Number(promotion.discountPercent),
        startDate: promotion.startDate.toISOString().slice(0, 10),
        endDate: promotion.endDate.toISOString().slice(0, 10),
        status: getPromotionStatus(promotion),
        daysUntilEnd: daysBetween(todayDate(), promotion.endDate),
    };
}
function notificationRows(input) {
    const today = todayDate();
    const daysUntilEnd = daysBetween(today, input.endDate);
    if (daysUntilEnd < 0)
        return [];
    const futureMilestones = ALERT_MILESTONES.filter((milestone) => milestone < daysUntilEnd);
    const immediateMilestone = [...ALERT_MILESTONES]
        .reverse()
        .find((milestone) => milestone >= daysUntilEnd);
    const milestones = immediateMilestone === undefined
        ? futureMilestones
        : [immediateMilestone, ...futureMilestones];
    const recipients = [
        { type: BillingPromotionNotificationRecipient.USER, email: input.userEmail },
    ];
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (adminEmail)
        recipients.push({ type: BillingPromotionNotificationRecipient.ADMIN, email: adminEmail });
    return milestones.flatMap((milestone) => recipients.map((recipient) => ({
        promotionId: input.promotionId,
        version: input.version,
        milestoneDays: milestone,
        recipientType: recipient.type,
        recipientEmail: recipient.email,
        scheduledFor: addDays(input.endDate, -milestone) < today
            ? today
            : addDays(input.endDate, -milestone),
    })));
}
async function validatePromotion(input, excludeId, db = prisma) {
    const startDate = dateOnly(input.startDate);
    const endDate = dateOnly(input.endDate);
    if (endDate < startDate) {
        throw { status: 400, message: "La fecha de fin no puede ser anterior a la fecha de inicio" };
    }
    const user = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    if (user.role !== Role.PRODUCTOR && user.role !== Role.EMPRESA) {
        throw { status: 400, message: "Las bonificaciones solo se pueden asignar a productores o empresas" };
    }
    const overlap = await db.billingPromotion.findFirst({
        where: {
            userId: input.userId,
            cancelledAt: null,
            ...(excludeId ? { id: { not: excludeId } } : {}),
            startDate: { lte: endDate },
            endDate: { gte: startDate },
        },
        select: { id: true },
    });
    if (overlap) {
        throw { status: 409, message: "El usuario ya tiene una bonificación que se superpone con esas fechas" };
    }
    return { user, startDate, endDate };
}
export async function createBillingPromotion(input, createdById) {
    const validated = await validatePromotion(input);
    const promotion = await prisma.$transaction(async (tx) => {
        const created = await tx.billingPromotion.create({
            data: {
                userId: input.userId,
                discountPercent: input.discountPercent,
                reason: input.reason.trim(),
                startDate: validated.startDate,
                endDate: validated.endDate,
                createdById,
            },
        });
        const rows = notificationRows({
            promotionId: created.id,
            version: created.version,
            endDate: created.endDate,
            userEmail: validated.user.email,
        });
        if (rows.length)
            await tx.billingPromotionNotification.createMany({ data: rows });
        return created;
    });
    return serializeBillingPromotion({ ...promotion, user: validated.user });
}
export async function updateBillingPromotion(id, input) {
    const existing = await prisma.billingPromotion.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Bonificación no encontrada" };
    if (existing.cancelledAt)
        throw { status: 400, message: "Una bonificación cancelada no se puede editar" };
    if (existing.userId !== input.userId) {
        throw { status: 400, message: "No se puede transferir una bonificación a otro usuario" };
    }
    const validated = await validatePromotion(input, id);
    const datesChanged = existing.startDate.getTime() !== validated.startDate.getTime()
        || existing.endDate.getTime() !== validated.endDate.getTime();
    const version = datesChanged ? existing.version + 1 : existing.version;
    const promotion = await prisma.$transaction(async (tx) => {
        if (datesChanged) {
            await tx.billingPromotionNotification.updateMany({
                where: { promotionId: id, status: BillingPromotionNotificationStatus.PENDING },
                data: { status: BillingPromotionNotificationStatus.SKIPPED },
            });
        }
        const updated = await tx.billingPromotion.update({
            where: { id },
            data: {
                userId: input.userId,
                discountPercent: input.discountPercent,
                reason: input.reason.trim(),
                startDate: validated.startDate,
                endDate: validated.endDate,
                version,
            },
        });
        if (datesChanged) {
            const rows = notificationRows({
                promotionId: updated.id,
                version,
                endDate: updated.endDate,
                userEmail: validated.user.email,
            });
            if (rows.length)
                await tx.billingPromotionNotification.createMany({ data: rows });
        }
        return updated;
    });
    return serializeBillingPromotion({ ...promotion, user: validated.user });
}
export async function cancelBillingPromotion(id) {
    const existing = await prisma.billingPromotion.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Bonificación no encontrada" };
    if (existing.cancelledAt)
        return serializeBillingPromotion(existing);
    const promotion = await prisma.$transaction(async (tx) => {
        await tx.billingPromotionNotification.updateMany({
            where: { promotionId: id, status: BillingPromotionNotificationStatus.PENDING },
            data: { status: BillingPromotionNotificationStatus.SKIPPED },
        });
        return tx.billingPromotion.update({ where: { id }, data: { cancelledAt: new Date() } });
    });
    return serializeBillingPromotion(promotion);
}
export async function listBillingPromotions(filters = {}) {
    const promotions = await prisma.billingPromotion.findMany({
        where: filters.userId ? { userId: filters.userId } : {},
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, razonSocial: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
    });
    return promotions
        .map(serializeBillingPromotion)
        .filter((promotion) => !filters.status || promotion.status === filters.status);
}
export async function findBillingPromotionForDate(userId, billingDate) {
    // Las fechas de vencimiento llegan desde un input HTML `date` y Zod las
    // convierte a medianoche UTC. Conservar los componentes UTC evita moverlas
    // al día anterior al aplicar el huso horario argentino.
    const day = dateOnly(billingDate.toISOString().slice(0, 10));
    return prisma.billingPromotion.findFirst({
        where: {
            userId,
            cancelledAt: null,
            startDate: { lte: day },
            endDate: { gte: day },
        },
    });
}
export async function getMyCurrentBillingPromotion(userId) {
    const today = todayDate();
    const promotion = await prisma.billingPromotion.findFirst({
        where: { userId, cancelledAt: null, startDate: { lte: today }, endDate: { gte: today } },
        orderBy: { endDate: "asc" },
    });
    return promotion ? serializeBillingPromotion(promotion) : null;
}
export async function getBillingPromotionAlerts() {
    const today = todayDate();
    const limit = addDays(today, 30);
    const promotions = await prisma.billingPromotion.findMany({
        where: { cancelledAt: null, endDate: { gte: today, lte: limit } },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, razonSocial: true } } },
        orderBy: { endDate: "asc" },
    });
    const items = promotions.map(serializeBillingPromotion);
    return {
        total: items.length,
        expiringToday: items.filter((item) => item.daysUntilEnd === 0).length,
        withinSevenDays: items.filter((item) => item.daysUntilEnd >= 0 && item.daysUntilEnd <= 7).length,
        withinThirtyDays: items.length,
        items,
    };
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[character]));
}
export async function processBillingPromotionNotifications() {
    const today = todayDate();
    const notifications = await prisma.billingPromotionNotification.findMany({
        where: { status: BillingPromotionNotificationStatus.PENDING, scheduledFor: { lte: today } },
        include: { promotion: { include: { user: true } } },
        orderBy: { scheduledFor: "asc" },
        take: 100,
    });
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const notification of notifications) {
        const { promotion } = notification;
        if (promotion.cancelledAt || notification.version !== promotion.version) {
            await prisma.billingPromotionNotification.update({
                where: { id: notification.id },
                data: { status: BillingPromotionNotificationStatus.SKIPPED },
            });
            skipped += 1;
            continue;
        }
        const userName = `${promotion.user.firstName} ${promotion.user.lastName}`.trim();
        const timing = notification.milestoneDays === 0
            ? "vence hoy"
            : `vence en ${notification.milestoneDays} días`;
        const subject = notification.recipientType === BillingPromotionNotificationRecipient.USER
            ? `Tu bonificación especial ${timing}`
            : `Bonificación de ${userName}: ${timing}`;
        const text = notification.recipientType === BillingPromotionNotificationRecipient.USER
            ? `Hola ${promotion.user.firstName}, tu bonificación especial del ${Number(promotion.discountPercent)}% (${promotion.reason}) ${timing}, el ${promotion.endDate.toISOString().slice(0, 10)}.`
            : `La bonificación especial del ${Number(promotion.discountPercent)}% de ${userName} (${promotion.user.email}), por ${promotion.reason}, ${timing}.`;
        const html = buildHtmlTemplate({
            title: "Vencimiento de bonificación especial",
            messageLines: [
                notification.recipientType === BillingPromotionNotificationRecipient.USER
                    ? `Hola ${escapeHtml(promotion.user.firstName)},`
                    : `Bonificación asignada a <b>${escapeHtml(userName)}</b> (${escapeHtml(promotion.user.email)}).`,
                `La bonificación del <b>${Number(promotion.discountPercent)}%</b> por “${escapeHtml(promotion.reason)}” ${timing}.`,
                `Fecha de finalización: <b>${promotion.endDate.toISOString().slice(0, 10)}</b>.`,
            ],
            buttonText: "Ir a Sinergia",
            buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000",
        });
        try {
            const recipientEmail = notification.recipientType === BillingPromotionNotificationRecipient.USER
                ? promotion.user.email
                : process.env.ADMIN_EMAIL || process.env.SMTP_USER || notification.recipientEmail;
            await sendMail(recipientEmail, subject, text, html);
            await prisma.billingPromotionNotification.update({
                where: { id: notification.id },
                data: {
                    status: BillingPromotionNotificationStatus.SENT,
                    sentAt: new Date(),
                    recipientEmail,
                    attemptCount: { increment: 1 },
                    lastError: null,
                },
            });
            sent += 1;
        }
        catch (error) {
            await prisma.billingPromotionNotification.update({
                where: { id: notification.id },
                data: {
                    attemptCount: { increment: 1 },
                    lastError: error instanceof Error ? error.message : "Error desconocido al enviar email",
                },
            });
            failed += 1;
        }
    }
    return { processed: notifications.length, sent, failed, skipped };
}
