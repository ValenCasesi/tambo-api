import type { Request, Response } from "express";
import { z } from "zod";
import { BillingInstallmentStatus, BillingPlanType, Role } from "@prisma/client";
import {
    createBillingPlan,
    deleteBillingPlan,
    generateBillingInstallments,
    getBillingPlans,
    getMyBillingSummary,
    listBillingInstallments,
    markBillingInstallmentPaid,
    markBillingInstallmentPending,
    updateBillingPlan,
} from "../services/billing.service.js";

const billingRoleSchema = z.enum([Role.PRODUCTOR, Role.EMPRESA]);

const planSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    targetRole: billingRoleSchema,
    planType: z.nativeEnum(BillingPlanType),
    minVo: z.coerce.number().min(0).nullable().optional(),
    maxVo: z.coerce.number().min(0).nullable().optional(),
    sigleaLiters: z.coerce.number().min(0).nullable().optional(),
    fixedPrice: z.coerce.number().min(0).nullable().optional(),
    isActive: z.coerce.boolean().optional(),
    isDefault: z.coerce.boolean().optional(),
});

const updatePlanSchema = planSchema.partial();

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
    status: z.enum([BillingInstallmentStatus.PENDING, BillingInstallmentStatus.PAID, "OVERDUE"]).optional(),
    role: billingRoleSchema.optional(),
    userId: z.string().uuid().optional(),
});

export async function getBillingPlansHandler(_req: Request, res: Response) {
    try {
        const plans = await getBillingPlans();
        return res.status(200).json(plans);
    } catch (err: any) {
        console.error("getBillingPlansHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function createBillingPlanHandler(req: Request, res: Response) {
    try {
        const parsed = planSchema.parse(req.body);
        const plan = await createBillingPlan(parsed);
        return res.status(201).json(plan);
    } catch (err: any) {
        if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
        if (err?.issues) return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("createBillingPlanHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateBillingPlanHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const parsed = updatePlanSchema.parse(req.body);
        const plan = await updateBillingPlan({ id, ...parsed });
        return res.status(200).json(plan);
    } catch (err: any) {
        if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
        if (err?.issues) return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("updateBillingPlanHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteBillingPlanHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const plan = await deleteBillingPlan(id);
        return res.status(200).json(plan);
    } catch (err: any) {
        if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
        console.error("deleteBillingPlanHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function generateBillingInstallmentsHandler(req: Request, res: Response) {
    try {
        const parsed = generateSchema.parse(req.body);
        const result = await generateBillingInstallments(parsed);
        return res.status(201).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
        if (err?.issues) return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("generateBillingInstallmentsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function listBillingInstallmentsHandler(req: Request, res: Response) {
    try {
        const parsed = listInstallmentsSchema.parse(req.query);
        const cuotas = await listBillingInstallments(parsed);
        return res.status(200).json(cuotas);
    } catch (err: any) {
        if (err?.issues) return res.status(400).json({ error: "Validation error", details: err.issues });
        console.error("listBillingInstallmentsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function markBillingInstallmentPaidHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const cuota = await markBillingInstallmentPaid(id);
        return res.status(200).json(cuota);
    } catch (err: any) {
        if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
        console.error("markBillingInstallmentPaidHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function markBillingInstallmentPendingHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const cuota = await markBillingInstallmentPending(id);
        return res.status(200).json(cuota);
    } catch (err: any) {
        if (err?.status && err?.message) return res.status(err.status).json({ error: err.message });
        console.error("markBillingInstallmentPendingHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getMyBillingSummaryHandler(req: Request, res: Response) {
    try {
        if (!req.user) return res.status(401).json({ error: "No autenticado" });
        const summary = await getMyBillingSummary(req.user.id);
        return res.status(200).json(summary);
    } catch (err: any) {
        console.error("getMyBillingSummaryHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
