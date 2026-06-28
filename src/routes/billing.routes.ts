import { Router } from "express";
import { Role } from "@prisma/client";
import {
    createBillingPlanHandler,
    deleteBillingPlanHandler,
    generateBillingInstallmentsHandler,
    getBillingPlansHandler,
    getMyBillingSummaryHandler,
    listBillingInstallmentsHandler,
    markBillingInstallmentPaidHandler,
    markBillingInstallmentPendingHandler,
    updateBillingPlanHandler,
} from "../controller/billing.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/billing/me/summary", requireAuth, getMyBillingSummaryHandler);

router.get("/plans", requireAuth, requireRole([Role.ADMIN]), getBillingPlansHandler);
router.post("/plans", requireAuth, requireRole([Role.ADMIN]), createBillingPlanHandler);
router.put("/plans/:id", requireAuth, requireRole([Role.ADMIN]), updateBillingPlanHandler);
router.delete("/plans/:id", requireAuth, requireRole([Role.ADMIN]), deleteBillingPlanHandler);

router.get("/cuotas", requireAuth, requireRole([Role.ADMIN]), listBillingInstallmentsHandler);
router.post("/cuotas/generate", requireAuth, requireRole([Role.ADMIN]), generateBillingInstallmentsHandler);
router.put("/cuotas/:id/pay", requireAuth, requireRole([Role.ADMIN]), markBillingInstallmentPaidHandler);
router.put("/cuotas/:id/pending", requireAuth, requireRole([Role.ADMIN]), markBillingInstallmentPendingHandler);

export default router;
