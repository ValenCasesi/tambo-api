import { z } from "zod";
import { cancelBillingPromotion, createBillingPromotion, getBillingPromotionAlerts, listBillingPromotions, processBillingPromotionNotifications, updateBillingPromotion, } from "../services/billing-promotion.service.js";
const promotionSchema = z.object({
    userId: z.string().uuid(),
    discountPercent: z.coerce.number().min(0).max(100),
    reason: z.string().trim().min(1).max(500),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const listSchema = z.object({
    userId: z.string().uuid().optional(),
    status: z.enum(["SCHEDULED", "ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
});
function handleError(res, error, context) {
    if (error?.status && error?.message)
        return res.status(error.status).json({ error: error.message });
    if (error?.issues)
        return res.status(400).json({ error: "Validation error", details: error.issues });
    console.error(context, error);
    return res.status(500).json({ error: "Internal server error" });
}
export async function listBillingPromotionsHandler(req, res) {
    try {
        return res.status(200).json(await listBillingPromotions(listSchema.parse(req.query)));
    }
    catch (error) {
        return handleError(res, error, "listBillingPromotionsHandler:");
    }
}
export async function createBillingPromotionHandler(req, res) {
    try {
        if (!req.user)
            return res.status(401).json({ error: "No autenticado" });
        return res.status(201).json(await createBillingPromotion(promotionSchema.parse(req.body), req.user.id));
    }
    catch (error) {
        return handleError(res, error, "createBillingPromotionHandler:");
    }
}
export async function updateBillingPromotionHandler(req, res) {
    try {
        return res.status(200).json(await updateBillingPromotion(req.params.id, promotionSchema.parse(req.body)));
    }
    catch (error) {
        return handleError(res, error, "updateBillingPromotionHandler:");
    }
}
export async function cancelBillingPromotionHandler(req, res) {
    try {
        return res.status(200).json(await cancelBillingPromotion(req.params.id));
    }
    catch (error) {
        return handleError(res, error, "cancelBillingPromotionHandler:");
    }
}
export async function getBillingPromotionAlertsHandler(_req, res) {
    try {
        return res.status(200).json(await getBillingPromotionAlerts());
    }
    catch (error) {
        return handleError(res, error, "getBillingPromotionAlertsHandler:");
    }
}
export async function processBillingPromotionNotificationsHandler(req, res) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        return res.status(200).json(await processBillingPromotionNotifications());
    }
    catch (error) {
        return handleError(res, error, "processBillingPromotionNotificationsHandler:");
    }
}
