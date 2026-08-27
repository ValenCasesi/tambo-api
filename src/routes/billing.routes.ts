import { Router } from "express";
import { Role } from "@prisma/client";
import {
    createBillingPlanHandler,
    deleteBillingPlanHandler,
    generateBillingInstallmentsHandler,
    getBillingPlansHandler,
    getProducerTierPlansHandler,
    getBillingSettingsHandler,
    getMyBillingSummaryHandler,
    listBillingInstallmentsHandler,
    listMyBillingInstallmentsHandler,
    markBillingInstallmentInvoicedHandler,
    markBillingInstallmentPaidHandler,
    markBillingInstallmentPendingHandler,
    previewProducerBillingHandler,
    replaceProducerTierPlansHandler,
    updateBillingPlanHandler,
    updateProducerBillingCycleHandler,
    updateBillingSettingsHandler,
    updateSigleaLiterPriceHandler,
    repriceInstallmentsBatchHandler,
    getSigleaRepriceStatusHandler,
    updateBillingScheduleSettingsHandler,
    runScheduledBillingGenerationHandler,
    getBillingGenerationStatusHandler,
    startBillingGenerationRunHandler,
    advanceBillingGenerationRunHandler,
} from "../controller/billing.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import {
    cancelBillingPromotionHandler,
    createBillingPromotionHandler,
    getBillingPromotionAlertsHandler,
    listBillingPromotionsHandler,
    processBillingPromotionNotificationsHandler,
    updateBillingPromotionHandler,
} from "../controller/billing-promotion.controller.js";

const router = Router();

router.get("/billing/me/summary", requireAuth, getMyBillingSummaryHandler);
router.get("/billing/me/installments", requireAuth, listMyBillingInstallmentsHandler);
router.get("/cron/billing-promotions", processBillingPromotionNotificationsHandler);
// Cron de Vercel: se autentica con CRON_SECRET, no con sesión de admin.
router.get("/cron/billing-installments", runScheduledBillingGenerationHandler);

router.get("/plans", requireAuth, requireRole([Role.ADMIN]), getBillingPlansHandler);
router.post("/plans", requireAuth, requireRole([Role.ADMIN]), createBillingPlanHandler);
router.get("/plans/producer-tiers", requireAuth, requireRole([Role.ADMIN]), getProducerTierPlansHandler);
router.put("/plans/producer-tiers", requireAuth, requireRole([Role.ADMIN]), replaceProducerTierPlansHandler);
router.put("/plans/:id", requireAuth, requireRole([Role.ADMIN]), updateBillingPlanHandler);
router.delete("/plans/:id", requireAuth, requireRole([Role.ADMIN]), deleteBillingPlanHandler);
router.get("/billing/settings", requireAuth, requireRole([Role.ADMIN]), getBillingSettingsHandler);
router.put("/billing/settings", requireAuth, requireRole([Role.ADMIN]), updateBillingSettingsHandler);
router.put("/billing/settings/siglea-price", requireAuth, requireRole([Role.ADMIN]), updateSigleaLiterPriceHandler);
router.get("/billing/settings/siglea-price/status", requireAuth, requireRole([Role.ADMIN]), getSigleaRepriceStatusHandler);
router.put("/billing/settings/schedule", requireAuth, requireRole([Role.ADMIN]), updateBillingScheduleSettingsHandler);
router.get("/billing/generation/status", requireAuth, requireRole([Role.ADMIN]), getBillingGenerationStatusHandler);
router.post("/billing/generation/start", requireAuth, requireRole([Role.ADMIN]), startBillingGenerationRunHandler);
router.post("/billing/generation/advance", requireAuth, requireRole([Role.ADMIN]), advanceBillingGenerationRunHandler);
router.post("/billing/settings/siglea-price/reprice-batch", requireAuth, requireRole([Role.ADMIN]), repriceInstallmentsBatchHandler);
router.put("/billing/users/:userId/cycle", requireAuth, requireRole([Role.ADMIN]), updateProducerBillingCycleHandler);
router.get("/billing/promotions", requireAuth, requireRole([Role.ADMIN]), listBillingPromotionsHandler);
router.post("/billing/promotions", requireAuth, requireRole([Role.ADMIN]), createBillingPromotionHandler);
router.put("/billing/promotions/:id", requireAuth, requireRole([Role.ADMIN]), updateBillingPromotionHandler);
router.post("/billing/promotions/:id/cancel", requireAuth, requireRole([Role.ADMIN]), cancelBillingPromotionHandler);
router.get("/billing/promotions-alerts", requireAuth, requireRole([Role.ADMIN]), getBillingPromotionAlertsHandler);

router.get("/cuotas", requireAuth, requireRole([Role.ADMIN]), listBillingInstallmentsHandler);
router.get("/cuotas/preview/:userId", requireAuth, requireRole([Role.ADMIN]), previewProducerBillingHandler);
router.post("/cuotas/generate", requireAuth, requireRole([Role.ADMIN]), generateBillingInstallmentsHandler);
router.put("/cuotas/:id/pay", requireAuth, requireRole([Role.ADMIN]), markBillingInstallmentPaidHandler);
router.put("/cuotas/:id/pending", requireAuth, requireRole([Role.ADMIN]), markBillingInstallmentPendingHandler);
router.put("/cuotas/:id/invoice", requireAuth, requireRole([Role.ADMIN]), markBillingInstallmentInvoicedHandler);

export default router;
