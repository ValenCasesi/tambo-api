import { z } from "zod";
import { BillingCycle, BillingInstallmentStatus, BillingPlanType, Role } from "@prisma/client";
import { createBillingPlan, deleteBillingPlan, generateBillingInstallments, getBillingPlans, getProducerTierPlans, getBillingSettings, getMyBillingSummary, listBillingInstallments, listMyBillingInstallments, markBillingInstallmentInvoiced, markBillingInstallmentPaid, markBillingInstallmentPending, previewProducerBilling, replaceProducerTierPlans, updateBillingPlan, updateBillingSettings, } from "../services/billing.service.js";
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
    sigleaLiterPrice: z.coerce.number().min(0).nullable().optional(),
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
});
const billingSettingsSchema = z.object({
    whatsappNumber: z.preprocess((value) => value === "" ? null : value, z.string().regex(/^\d{7,15}$/, "El WhatsApp debe estar en formato internacional, solo números").nullable()),
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
            return res.status(400).json({ error: "Validation error", details: err.issues });
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
        const preview = await previewProducerBilling(userId, parsed.period);
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
