import { z } from "zod";
import { BillingCycle, BillingInstallmentStatus, BillingPlanType, Role, BillingGenerationTrigger } from "@prisma/client";
import { createBillingPlan, deleteBillingPlan, generateBillingInstallments, getBillingPlans, getProducerTierPlans, getBillingSettings, getMyBillingSummary, listBillingInstallments, listMyBillingInstallments, markBillingInstallmentInvoiced, markBillingInstallmentPaid, markBillingInstallmentPending, previewProducerBilling, recalculateBillingInstallment, replaceProducerTierPlans, updateProducerBillingCycle, updateSigleaLiterPrice, repriceUnpaidInstallmentsBatch, getSigleaRepriceStatus, updateBillingScheduleSettings, runScheduledBillingGeneration, getBillingGenerationRun, getUnfinishedBillingGenerationRun, advanceBillingGenerationRun, startBillingGenerationRun, getCurrentBillingPeriod, updateBillingPlan, updateBillingSettings, } from "../services/billing.service.js";
const billingRoleSchema = z.enum([Role.PRODUCTOR, Role.EMPRESA]);
const planSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    targetRole: billingRoleSchema,
    planType: z.nativeEnum(BillingPlanType),
    minVo: z.coerce.number().min(0).nullable().optional(),
    maxVo: z.coerce.number().min(0).nullable().optional(),
    sigleaLiters: z.coerce.number().min(0).nullable().optional(),
    fixedPrice: z.coerce.number().min(0).nullable().optional(),
    billingCycle: z.nativeEnum(BillingCycle).optional(),
    isActive: z.coerce.boolean().optional(),
    isBasic: z.coerce.boolean().optional(),
});
const updatePlanSchema = planSchema.partial();
const producerTierSchema = z.object({
    id: z.string().uuid().optional(),
    minVo: z.coerce.number().int().min(0),
    // Evaluar null antes del coercion: Number(null) es 0 y rompería el
    // significado de "sin límite" del último tramo.
    maxVo: z.union([z.null(), z.coerce.number().int().min(0)]),
    sigleaLiters: z.coerce.number().positive(),
});
export const producerTiersSchema = z.object({
    tiers: z.array(producerTierSchema).min(1),
});
const generateSchema = z.object({
    period: z.string().regex(/^\d{6}$/, "El periodo debe ser YYYYMM"),
    dueDate: z.coerce.date(),
    userId: z.string().uuid().optional(),
    userIds: z.array(z.string().uuid()).optional(),
    targetRole: billingRoleSchema.optional(),
});
const listInstallmentsSchema = z.object({
    period: z.string().regex(/^\d{6}$/).optional(),
    status: z.enum([BillingInstallmentStatus.PENDING, BillingInstallmentStatus.PAID, BillingInstallmentStatus.BONIFIED, "OVERDUE"]).optional(),
    role: billingRoleSchema.optional(),
    userId: z.string().uuid().optional(),
});
const listMyInstallmentsSchema = listInstallmentsSchema.pick({
    period: true,
    status: true,
});
const previewBillingSchema = z.object({
    period: z.string().regex(/^\d{6}$/, "El periodo debe ser YYYYMM").optional(),
    billingCycle: z.nativeEnum(BillingCycle).optional(),
});
const updateProducerCycleSchema = z.object({
    billingCycle: z.nativeEnum(BillingCycle),
});
const optionalText = (max, label) => z.preprocess((value) => typeof value === "string" ? (value.trim() === "" ? null : value.trim()) : value, z.string().max(max, `${label} no puede superar los ${max} caracteres`).nullable().default(null));
const billingSettingsSchema = z.object({
    whatsappNumber: z.preprocess((value) => value === "" ? null : value, z.string().regex(/^\d{7,15}$/, "El WhatsApp debe estar en formato internacional, solo números").nullable()),
    accountHolder: optionalText(120, "El titular"),
    accountTaxId: z.preprocess((value) => typeof value === "string" ? (value.replace(/\D/g, "") || null) : value, z.string().regex(/^\d{11}$/, "El CUIT/CUIL debe tener 11 dígitos").nullable().default(null)),
    bankName: optionalText(120, "El banco"),
    cbu: z.preprocess((value) => typeof value === "string" ? (value.replace(/\D/g, "") || null) : value, z.string().regex(/^\d{22}$/, "El CBU/CVU debe tener 22 dígitos").nullable().default(null)),
    alias: z.preprocess((value) => typeof value === "string" ? (value.trim().toLowerCase() || null) : value, z.string()
        .regex(/^[a-z0-9.\-]{6,20}$/, "El alias debe tener entre 6 y 20 caracteres (letras, números, puntos o guiones)")
        .nullable()
        .default(null)),
});
export async function getBillingPlansHandler(_req, res) {
    try {
        const plans = await getBillingPlans();
        return res.status(200).json(plans);
    }
    catch (err) {
        console.error("getBillingPlansHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getProducerTierPlansHandler(_req, res) {
    try {
        return res.status(200).json(await getProducerTierPlans());
    }
    catch (err) {
        console.error("getProducerTierPlansHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function replaceProducerTierPlansHandler(req, res) {
    try {
        const { tiers } = producerTiersSchema.parse(req.body);
        return res.status(200).json(await replaceProducerTierPlans(tiers));
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("replaceProducerTierPlansHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const sigleaLiterPriceSchema = z.object({
    sigleaLiterPrice: z.coerce
        .number({ error: "El precio del litro Siglea debe ser un número" })
        .positive("El precio del litro Siglea debe ser mayor a 0"),
});
export async function updateSigleaLiterPriceHandler(req, res) {
    try {
        const { sigleaLiterPrice } = sigleaLiterPriceSchema.parse(req.body);
        const result = await updateSigleaLiterPrice(sigleaLiterPrice);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: err.issues[0]?.message ?? "Validation error", details: err.issues });
        console.error("updateSigleaLiterPriceHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const repriceBatchSchema = z.object({
    cursor: z.string().uuid().nullable().optional(),
    batchSize: z.coerce.number().int().positive().max(100).optional(),
});
export async function repriceInstallmentsBatchHandler(req, res) {
    try {
        const parsed = repriceBatchSchema.parse(req.body ?? {});
        const result = await repriceUnpaidInstallmentsBatch(parsed);
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: err.issues[0]?.message ?? "Validation error", details: err.issues });
        console.error("repriceInstallmentsBatchHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getSigleaRepriceStatusHandler(_req, res) {
    try {
        return res.status(200).json(await getSigleaRepriceStatus());
    }
    catch (err) {
        console.error("getSigleaRepriceStatusHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const scheduleSettingsSchema = z.object({
    installmentDueDay: z.coerce.number().int().min(1, "El día de vencimiento debe estar entre 1 y 28").max(28, "El día de vencimiento debe estar entre 1 y 28"),
    autoGenerateEnabled: z.coerce.boolean(),
});
export async function updateBillingScheduleSettingsHandler(req, res) {
    try {
        const parsed = scheduleSettingsSchema.parse(req.body);
        return res.status(200).json(await updateBillingScheduleSettings(parsed));
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: err.issues[0]?.message ?? "Validation error", details: err.issues });
        console.error("updateBillingScheduleSettingsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * Cron de Vercel: genera las cuotas del mes. Procesa lo que entra en el
 * presupuesto de tiempo y deja el progreso guardado; si queda trabajo, la
 * próxima invocación diaria (o el admin desde la UI) lo retoma.
 */
export async function runScheduledBillingGenerationHandler(req, res) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const result = await runScheduledBillingGeneration();
        return res.status(200).json(result);
    }
    catch (err) {
        console.error("runScheduledBillingGenerationHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/** Estado de la corrida del período, para mostrarlo y reanudarlo desde el admin. */
export async function getBillingGenerationStatusHandler(_req, res) {
    try {
        const period = getCurrentBillingPeriod();
        const [cronRun, unfinished] = await Promise.all([
            getBillingGenerationRun(period, BillingGenerationTrigger.CRON),
            getUnfinishedBillingGenerationRun(),
        ]);
        return res.status(200).json({ period, cronRun, unfinishedRun: unfinished });
    }
    catch (err) {
        console.error("getBillingGenerationStatusHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
const advanceRunSchema = z.object({
    runId: z.string().uuid().optional(),
    batchSize: z.coerce.number().int().positive().max(50).optional(),
});
/**
 * Avanza una corrida desde el admin: la red de seguridad para cuando el cron no
 * llegó a completarla (o directamente no corrió).
 */
export async function advanceBillingGenerationRunHandler(req, res) {
    try {
        const { runId, batchSize } = advanceRunSchema.parse(req.body ?? {});
        const targetRunId = runId ?? (await getUnfinishedBillingGenerationRun())?.id;
        if (!targetRunId) {
            return res.status(404).json({ error: "No hay una corrida de generación pendiente" });
        }
        // Presupuesto corto: la UI encadena los lotes y muestra el progreso.
        const result = await advanceBillingGenerationRun({ runId: targetRunId, timeBudgetMs: 20_000, batchSize });
        return res.status(200).json(result);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: err.issues[0]?.message ?? "Validation error", details: err.issues });
        console.error("advanceBillingGenerationRunHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
/** Arranca a mano la corrida del período (por si el cron no se disparó). */
export async function startBillingGenerationRunHandler(req, res) {
    try {
        const parsed = z.object({ period: z.string().regex(/^\d{6}$/).optional() }).parse(req.body ?? {});
        const { run, alreadyExisted } = await startBillingGenerationRun({
            period: parsed.period,
            trigger: BillingGenerationTrigger.CRON,
        });
        return res.status(alreadyExisted ? 200 : 201).json({ run, alreadyExisted });
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: err.issues[0]?.message ?? "Validation error", details: err.issues });
        console.error("startBillingGenerationRunHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getBillingSettingsHandler(_req, res) {
    try {
        const settings = await getBillingSettings();
        return res.status(200).json(settings);
    }
    catch (err) {
        console.error("getBillingSettingsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function updateBillingSettingsHandler(req, res) {
    try {
        const parsed = billingSettingsSchema.parse(req.body);
        const settings = await updateBillingSettings(parsed);
        return res.status(200).json(settings);
    }
    catch (err) {
        if (err?.issues)
            return res.status(400).json({ error: err.issues[0]?.message ?? "Validation error", details: err.issues });
        console.error("updateBillingSettingsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function createBillingPlanHandler(req, res) {
    try {
        const parsed = planSchema.parse(req.body);
        const plan = await createBillingPlan(parsed);
        return res.status(201).json(plan);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("createBillingPlanHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function updateBillingPlanHandler(req, res) {
    try {
        const id = req.params.id;
        const parsed = updatePlanSchema.parse(req.body);
        const plan = await updateBillingPlan({ id, ...parsed });
        return res.status(200).json(plan);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("updateBillingPlanHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function deleteBillingPlanHandler(req, res) {
    try {
        const id = req.params.id;
        const plan = await deleteBillingPlan(id);
        return res.status(200).json(plan);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        console.error("deleteBillingPlanHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function generateBillingInstallmentsHandler(req, res) {
    try {
        const parsed = generateSchema.parse(req.body);
        const result = await generateBillingInstallments(parsed);
        return res.status(201).json(result);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("generateBillingInstallmentsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function previewProducerBillingHandler(req, res) {
    try {
        const userId = req.params.userId;
        const parsed = previewBillingSchema.parse(req.query);
        const preview = await previewProducerBilling(userId, parsed.period, parsed.billingCycle);
        // Es un cálculo en vivo: no debe reutilizarse después de cambiar VO,
        // tambos o tramos de planes.
        res.set({
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });
        return res.status(200).json(preview);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("previewProducerBillingHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function updateProducerBillingCycleHandler(req, res) {
    try {
        const userId = req.params.userId;
        const { billingCycle } = updateProducerCycleSchema.parse(req.body);
        return res.status(200).json(await updateProducerBillingCycle(userId, billingCycle));
    }
    catch (err) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
        }
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("updateProducerBillingCycleHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function listBillingInstallmentsHandler(req, res) {
    try {
        const parsed = listInstallmentsSchema.parse(req.query);
        const cuotas = await listBillingInstallments(parsed);
        return res.status(200).json(cuotas);
    }
    catch (err) {
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("listBillingInstallmentsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function listMyBillingInstallmentsHandler(req, res) {
    try {
        if (!req.user)
            return res.status(401).json({ error: "No autenticado" });
        const parsed = listMyInstallmentsSchema.parse(req.query);
        const cuotas = await listMyBillingInstallments(req.user.id, parsed);
        return res.status(200).json(cuotas);
    }
    catch (err) {
        if (err?.issues)
            return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("listMyBillingInstallmentsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function markBillingInstallmentPaidHandler(req, res) {
    try {
        const id = req.params.id;
        const cuota = await markBillingInstallmentPaid(id);
        return res.status(200).json(cuota);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        console.error("markBillingInstallmentPaidHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function recalculateBillingInstallmentHandler(req, res) {
    try {
        const id = req.params.id;
        return res.status(200).json(await recalculateBillingInstallment(id));
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        console.error("recalculateBillingInstallmentHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function markBillingInstallmentPendingHandler(req, res) {
    try {
        const id = req.params.id;
        const cuota = await markBillingInstallmentPending(id);
        return res.status(200).json(cuota);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        console.error("markBillingInstallmentPendingHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function markBillingInstallmentInvoicedHandler(req, res) {
    try {
        const id = req.params.id;
        const cuota = await markBillingInstallmentInvoiced(id);
        return res.status(200).json(cuota);
    }
    catch (err) {
        if (err?.status && err?.message)
            return res.status(err.status).json({ error: err.message });
        console.error("markBillingInstallmentInvoicedHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getMyBillingSummaryHandler(req, res) {
    try {
        if (!req.user)
            return res.status(401).json({ error: "No autenticado" });
        const summary = await getMyBillingSummary(req.user.id);
        return res.status(200).json(summary);
    }
    catch (err) {
        console.error("getMyBillingSummaryHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
