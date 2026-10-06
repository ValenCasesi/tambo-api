import { BillingCycle, BillingGenerationStatus, BillingGenerationTrigger, BillingInstallmentStatus, BillingPaymentMethod, BillingPlanType, EntityStatus, Role } from "@prisma/client";
import prisma from "../prisma/client.js";
import { findBillingPromotionForDate, getMyCurrentBillingPromotion } from "./billing-promotion.service.js";
import { getProducerTierName, isVoInProducerTier, validateProducerTierConfiguration, } from "./producer-tier-config.js";
const BILLING_ACTIVITY_WINDOW_MONTHS = 3;
const BILLING_SETTINGS_ID = 1;
const AUTO_DEBIT_DISCOUNT_PERCENT = 20;
export const PRODUCER_ANNUAL_PRICE_MULTIPLIER = 10;
function toNumber(value) {
    if (value === null || value === undefined)
        return null;
    return Number(value);
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
function clampDiscountPercent(value) {
    const percent = toNumber(value) ?? 0;
    return Math.min(100, Math.max(0, percent));
}
function getEffectiveDiscountPercent(manualDiscount, paymentMethod) {
    const automaticDebitDiscount = paymentMethod === BillingPaymentMethod.AUTO_DEBIT
        ? AUTO_DEBIT_DISCOUNT_PERCENT
        : 0;
    return Math.min(100, clampDiscountPercent(manualDiscount) + automaticDebitDiscount);
}
function getBillingCycle(value) {
    return value === BillingCycle.ANNUAL ? BillingCycle.ANNUAL : BillingCycle.MONTHLY;
}
export function getProducerPriceMultiplier(cycle) {
    return cycle === BillingCycle.ANNUAL ? PRODUCER_ANNUAL_PRICE_MULTIPLIER : 1;
}
export function calculateProducerCycleCharge(monthlySigleaLiters, sigleaLiterPrice, cycle) {
    const priceMultiplier = getProducerPriceMultiplier(cycle);
    const cycleSigleaLiters = round2(monthlySigleaLiters * priceMultiplier);
    return {
        priceMultiplier,
        cycleSigleaLiters,
        grossAmount: round2(cycleSigleaLiters * sigleaLiterPrice),
    };
}
function addMonthsToPeriod(period, monthsToAdd) {
    let year = Number(period.slice(0, 4));
    let month = Number(period.slice(4, 6)) + monthsToAdd;
    while (month > 12) {
        month -= 12;
        year += 1;
    }
    while (month < 1) {
        month += 12;
        year -= 1;
    }
    return `${year}${String(month).padStart(2, "0")}`;
}
export function getBillingPeriodEnd(period, cycle) {
    return cycle === BillingCycle.ANNUAL ? addMonthsToPeriod(period, 11) : null;
}
function getCurrentPeriodInArgentina() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Cordoba",
        year: "numeric",
        month: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    return `${year}${month}`;
}
function applyDiscount(grossAmount, discountPercent) {
    const discountAmount = round2(grossAmount * discountPercent / 100);
    return {
        grossAmount: round2(grossAmount),
        discountPercent: round2(discountPercent),
        discountAmount,
        amount: round2(grossAmount - discountAmount),
    };
}
function todayAtStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function getEffectiveStatus(status, dueDate) {
    if (status === BillingInstallmentStatus.PAID || status === BillingInstallmentStatus.BONIFIED)
        return status;
    return dueDate < todayAtStart() ? "OVERDUE" : BillingInstallmentStatus.PENDING;
}
function serializePlan(plan) {
    return {
        ...plan,
        minVo: toNumber(plan.minVo),
        maxVo: toNumber(plan.maxVo),
        sigleaLiters: toNumber(plan.sigleaLiters),
        fixedPrice: toNumber(plan.fixedPrice),
    };
}
function serializeInstallmentItem(item) {
    return {
        ...item,
        voUsed: toNumber(item.voUsed),
        sigleaLitersSnapshot: toNumber(item.sigleaLitersSnapshot),
        amount: toNumber(item.amount),
    };
}
function serializeInstallment(installment) {
    const amount = toNumber(installment.amount);
    const rawGrossAmount = toNumber(installment.grossAmount);
    const grossAmount = rawGrossAmount && rawGrossAmount > 0 ? rawGrossAmount : amount;
    return {
        ...installment,
        amount,
        grossAmount,
        discountPercentSnapshot: toNumber(installment.discountPercentSnapshot) ?? 0,
        discountAmount: toNumber(installment.discountAmount) ?? 0,
        sigleaLiterPrice: toNumber(installment.sigleaLiterPrice),
        voUsed: toNumber(installment.voUsed),
        sigleaLitersSnapshot: toNumber(installment.sigleaLitersSnapshot),
        fixedPriceSnapshot: toNumber(installment.fixedPriceSnapshot),
        billingCycleSnapshot: installment.billingCycleSnapshot ?? BillingCycle.MONTHLY,
        priceMultiplierSnapshot: toNumber(installment.priceMultiplierSnapshot) ?? 1,
        specialDiscountPercentSnapshot: toNumber(installment.specialDiscountPercentSnapshot),
        effectiveStatus: getEffectiveStatus(installment.status, installment.dueDate),
        plan: installment.plan ? serializePlan(installment.plan) : null,
        items: Array.isArray(installment.items)
            ? installment.items.map(serializeInstallmentItem)
            : undefined,
    };
}
function validatePlanShape(input) {
    if (input.targetRole !== Role.PRODUCTOR && input.targetRole !== Role.EMPRESA) {
        throw { status: 400, message: "El plan solo puede ser para PRODUCTOR o EMPRESA" };
    }
    if (input.targetRole === Role.PRODUCTOR) {
        if (input.planType !== BillingPlanType.SIGLEA_LITERS || !input.isBasic) {
            throw { status: 400, message: "Para productores solo se puede administrar el Plan Básico" };
        }
        if (input.billingCycle && input.billingCycle !== BillingCycle.MONTHLY) {
            throw { status: 400, message: "El Plan Básico de productores debe ser mensual" };
        }
        if (input.sigleaLiters === undefined || input.sigleaLiters === null || input.sigleaLiters <= 0) {
            throw { status: 400, message: "El Plan Básico requiere litros Siglea mayores a cero" };
        }
        return;
    }
    if (input.planType !== BillingPlanType.FIXED_ARS || input.isBasic) {
        throw { status: 400, message: "Los planes de empresa deben configurarse en litros Siglea" };
    }
    if (!input.billingCycle) {
        throw { status: 400, message: "La duración del plan de empresa es obligatoria" };
    }
    if (input.fixedPrice === undefined || input.fixedPrice === null || input.fixedPrice <= 0) {
        throw { status: 400, message: "Los planes de empresa requieren litros Siglea mayores a cero" };
    }
}
async function clearOtherBasicPlans(planId) {
    await prisma.billingPlan.updateMany({
        where: {
            targetRole: Role.PRODUCTOR,
            isBasic: true,
            ...(planId ? { id: { not: planId } } : {}),
        },
        data: { isBasic: false },
    });
}
export async function getBillingPlans() {
    const plans = await prisma.billingPlan.findMany({
        orderBy: [
            { targetRole: "asc" },
            { minVo: "asc" },
            { createdAt: "desc" },
        ],
    });
    return plans.map(serializePlan);
}
export async function getProducerTierPlans() {
    const plans = await prisma.billingPlan.findMany({
        where: {
            targetRole: Role.PRODUCTOR,
            planType: BillingPlanType.SIGLEA_LITERS,
            isBasic: false,
            isActive: true,
        },
        orderBy: { minVo: "asc" },
    });
    return plans.map(serializePlan);
}
export async function replaceProducerTierPlans(tiers) {
    validateProducerTierConfiguration(tiers);
    const plans = await prisma.$transaction(async (tx) => {
        const requestedIds = tiers.flatMap((tier) => tier.id ? [tier.id] : []);
        const existingPlans = requestedIds.length > 0
            ? await tx.billingPlan.findMany({ where: { id: { in: requestedIds } } })
            : [];
        const existingById = new Map(existingPlans.map((plan) => [plan.id, plan]));
        for (const id of requestedIds) {
            const existing = existingById.get(id);
            if (!existing
                || existing.targetRole !== Role.PRODUCTOR
                || existing.planType !== BillingPlanType.SIGLEA_LITERS
                || existing.isBasic) {
                throw { status: 400, message: "Uno de los planes no corresponde a un tramo de productor" };
            }
        }
        const activeIds = [];
        for (const tier of tiers) {
            const data = {
                name: getProducerTierName(tier.minVo, tier.maxVo),
                targetRole: Role.PRODUCTOR,
                planType: BillingPlanType.SIGLEA_LITERS,
                billingCycle: BillingCycle.MONTHLY,
                minVo: tier.minVo,
                maxVo: tier.maxVo,
                sigleaLiters: tier.sigleaLiters,
                fixedPrice: null,
                isActive: true,
                isDefault: false,
                isBasic: false,
            };
            const saved = tier.id
                ? await tx.billingPlan.update({ where: { id: tier.id }, data })
                : await tx.billingPlan.create({ data });
            activeIds.push(saved.id);
        }
        await tx.billingPlan.updateMany({
            where: {
                targetRole: Role.PRODUCTOR,
                planType: BillingPlanType.SIGLEA_LITERS,
                isBasic: false,
                isActive: true,
                id: { notIn: activeIds },
            },
            data: { isActive: false },
        });
        return tx.billingPlan.findMany({
            where: { id: { in: activeIds } },
            orderBy: { minVo: "asc" },
        });
    });
    return plans.map(serializePlan);
}
const BILLING_SETTINGS_SELECT = {
    whatsappNumber: true,
    accountHolder: true,
    accountTaxId: true,
    bankName: true,
    cbu: true,
    alias: true,
    sigleaLiterPrice: true,
    installmentDueDay: true,
    autoGenerateEnabled: true,
};
export async function getBillingSettings() {
    const settings = await prisma.billingSettings.findUnique({
        where: { id: BILLING_SETTINGS_ID },
        select: BILLING_SETTINGS_SELECT,
    });
    return {
        whatsappNumber: settings?.whatsappNumber ?? null,
        accountHolder: settings?.accountHolder ?? null,
        accountTaxId: settings?.accountTaxId ?? null,
        bankName: settings?.bankName ?? null,
        cbu: settings?.cbu ?? null,
        alias: settings?.alias ?? null,
        sigleaLiterPrice: toNumber(settings?.sigleaLiterPrice),
        installmentDueDay: settings?.installmentDueDay ?? DEFAULT_INSTALLMENT_DUE_DAY,
        autoGenerateEnabled: settings?.autoGenerateEnabled ?? true,
    };
}
/** Actualiza sólo contacto y cuenta bancaria: nunca toca el precio Siglea. */
export async function updateBillingSettings(input) {
    await prisma.billingSettings.upsert({
        where: { id: BILLING_SETTINGS_ID },
        create: { id: BILLING_SETTINGS_ID, ...input },
        update: input,
        select: { id: true },
    });
    return getBillingSettings();
}
/** Ajustes del cron. Se guardan aparte para no pisar precio ni datos de cobro. */
export async function updateBillingScheduleSettings(input) {
    const dueDay = Math.min(28, Math.max(1, Math.trunc(input.installmentDueDay)));
    await prisma.billingSettings.upsert({
        where: { id: BILLING_SETTINGS_ID },
        create: {
            id: BILLING_SETTINGS_ID,
            installmentDueDay: dueDay,
            autoGenerateEnabled: input.autoGenerateEnabled,
        },
        update: {
            installmentDueDay: dueDay,
            autoGenerateEnabled: input.autoGenerateEnabled,
        },
        select: { id: true },
    });
    return getBillingSettings();
}
export async function getConfiguredSigleaLiterPrice() {
    const settings = await prisma.billingSettings.findUnique({
        where: { id: BILLING_SETTINGS_ID },
        select: { sigleaLiterPrice: true },
    });
    return toNumber(settings?.sigleaLiterPrice);
}
/**
 * Guarda el precio Siglea (no toca contacto ni datos bancarios) y devuelve
 * cuántas cuotas hay para recalcular. El recálculo NO ocurre acá: lo dispara el
 * cliente lote a lote vía `repriceUnpaidInstallmentsBatch`, para poder mostrar
 * progreso y para que ninguna request se acerque al timeout del hosting.
 */
export async function updateSigleaLiterPrice(sigleaLiterPrice) {
    if (!Number.isFinite(sigleaLiterPrice) || sigleaLiterPrice <= 0) {
        throw { status: 400, message: "El precio del litro Siglea debe ser mayor a 0" };
    }
    const price = round2(sigleaLiterPrice);
    await prisma.billingSettings.upsert({
        where: { id: BILLING_SETTINGS_ID },
        create: { id: BILLING_SETTINGS_ID, sigleaLiterPrice: price },
        update: { sigleaLiterPrice: price },
        select: { id: true },
    });
    return {
        settings: await getBillingSettings(),
        totalToReprice: await countUnpaidInstallments(),
        batchSize: REPRICE_BATCH_SIZE,
    };
}
export async function createBillingPlan(input) {
    validatePlanShape(input);
    const isBasic = input.targetRole === Role.PRODUCTOR ? input.isBasic ?? false : false;
    if (isBasic) {
        const existingBasicPlan = await prisma.billingPlan.findFirst({
            where: {
                targetRole: Role.PRODUCTOR,
                isBasic: true,
            },
            select: { id: true },
        });
        if (existingBasicPlan) {
            throw { status: 409, message: "Ya existe un Plan Básico para productores; podés editar el actual" };
        }
    }
    const plan = await prisma.billingPlan.create({
        data: {
            name: input.name,
            targetRole: input.targetRole,
            planType: input.planType,
            billingCycle: input.targetRole === Role.EMPRESA
                ? input.billingCycle
                : BillingCycle.MONTHLY,
            minVo: input.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? input.minVo : null,
            maxVo: input.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? input.maxVo ?? null : null,
            sigleaLiters: input.planType === BillingPlanType.SIGLEA_LITERS ? input.sigleaLiters : null,
            fixedPrice: input.planType === BillingPlanType.FIXED_ARS ? input.fixedPrice : null,
            isActive: input.isActive ?? true,
            isDefault: false,
            isBasic,
        },
    });
    return serializePlan(plan);
}
export async function updateBillingPlan(input) {
    const existing = await prisma.billingPlan.findUnique({ where: { id: input.id } });
    if (!existing)
        throw { status: 404, message: "Plan no encontrado" };
    if (input.billingCycle !== undefined && input.billingCycle !== existing.billingCycle) {
        throw {
            status: 400,
            message: "La duración de un plan existente no se puede modificar; creá un nuevo plan",
        };
    }
    if ((input.targetRole !== undefined && input.targetRole !== existing.targetRole)
        || (input.planType !== undefined && input.planType !== existing.planType)
        || (input.isBasic !== undefined && input.isBasic !== existing.isBasic)) {
        throw {
            status: 400,
            message: "El tipo de un plan existente no se puede modificar; creá un nuevo plan",
        };
    }
    const merged = {
        name: input.name ?? existing.name,
        targetRole: input.targetRole ?? existing.targetRole,
        planType: input.planType ?? existing.planType,
        billingCycle: existing.billingCycle,
        minVo: input.minVo !== undefined ? input.minVo : toNumber(existing.minVo),
        maxVo: input.maxVo !== undefined ? input.maxVo : toNumber(existing.maxVo),
        sigleaLiters: input.sigleaLiters !== undefined ? input.sigleaLiters : toNumber(existing.sigleaLiters),
        fixedPrice: input.fixedPrice !== undefined ? input.fixedPrice : toNumber(existing.fixedPrice),
        isActive: input.isActive ?? existing.isActive,
        isBasic: input.isBasic ?? existing.isBasic,
    };
    validatePlanShape(merged);
    const isBasic = merged.targetRole === Role.PRODUCTOR ? merged.isBasic ?? false : false;
    if (existing.isActive && !merged.isActive) {
        const assignedActiveCompanies = await prisma.user.count({
            where: {
                billingPlanId: input.id,
                role: Role.EMPRESA,
                status: EntityStatus.ACTIVE,
            },
        });
        if (assignedActiveCompanies > 0) {
            throw {
                status: 409,
                message: "No podés desactivar un plan asignado a empresas activas; reasignalas primero",
            };
        }
    }
    if (isBasic) {
        await clearOtherBasicPlans(input.id);
    }
    const plan = await prisma.billingPlan.update({
        where: { id: input.id },
        data: {
            name: merged.name,
            targetRole: merged.targetRole,
            planType: merged.planType,
            billingCycle: existing.billingCycle,
            minVo: merged.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? merged.minVo : null,
            maxVo: merged.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? merged.maxVo ?? null : null,
            sigleaLiters: merged.planType === BillingPlanType.SIGLEA_LITERS ? merged.sigleaLiters : null,
            fixedPrice: merged.planType === BillingPlanType.FIXED_ARS ? merged.fixedPrice : null,
            isActive: merged.isActive,
            isDefault: false,
            isBasic,
        },
    });
    return serializePlan(plan);
}
export async function deleteBillingPlan(id) {
    const existing = await prisma.billingPlan.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Plan no encontrado" };
    if (existing.targetRole === Role.PRODUCTOR
        && existing.planType === BillingPlanType.SIGLEA_LITERS
        && !existing.isBasic) {
        throw {
            status: 400,
            message: "Los tramos de productor se administran desde la configuración conjunta de planes por VO",
        };
    }
    const [assignedUsers, assignedActiveCompanies, linkedInstallments, linkedItems] = await Promise.all([
        prisma.user.count({ where: { billingPlanId: id } }),
        prisma.user.count({
            where: {
                billingPlanId: id,
                role: Role.EMPRESA,
                status: EntityStatus.ACTIVE,
            },
        }),
        prisma.billingInstallment.count({ where: { planId: id } }),
        prisma.billingInstallmentItem.count({ where: { planId: id } }),
    ]);
    if (assignedActiveCompanies > 0) {
        throw {
            status: 409,
            message: "No podés eliminar un plan asignado a empresas activas; reasignalas primero",
        };
    }
    if (assignedUsers > 0 || linkedInstallments > 0 || linkedItems > 0) {
        const plan = await prisma.billingPlan.update({
            where: { id },
            data: { isActive: false, isDefault: false, isBasic: false },
        });
        return serializePlan(plan);
    }
    const plan = await prisma.billingPlan.delete({ where: { id } });
    return serializePlan(plan);
}
function getRecentPeriods(period, count) {
    const periods = [];
    let year = Number(period.slice(0, 4));
    let month = Number(period.slice(4, 6));
    for (let i = 0; i < count; i++) {
        periods.push(`${year}${String(month).padStart(2, "0")}`);
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
    }
    return periods;
}
async function getLatestVoPerTambo(userId, period) {
    const tambos = await prisma.tambo.findMany({
        where: { userId, status: EntityStatus.ACTIVE },
        select: { id: true, name: true },
    });
    if (tambos.length === 0)
        return [];
    const stats = await prisma.monthlyStatistic.findMany({
        where: {
            tamboId: { in: tambos.map((tambo) => tambo.id) },
            period: { in: getRecentPeriods(period, BILLING_ACTIVITY_WINDOW_MONTHS) },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { tamboId: true, period: true, vacasOrdene: true },
    });
    const nameByTamboId = new Map(tambos.map((tambo) => [tambo.id, tambo.name]));
    const latestByTamboId = new Map();
    for (const stat of stats) {
        if (latestByTamboId.has(stat.tamboId))
            continue;
        latestByTamboId.set(stat.tamboId, {
            tamboId: stat.tamboId,
            tamboName: nameByTamboId.get(stat.tamboId) ?? "",
            vo: Number(stat.vacasOrdene),
            voPeriod: stat.period,
        });
    }
    return [...latestByTamboId.values()];
}
async function getExactVoPerTambo(userId, period) {
    const tambos = await prisma.tambo.findMany({
        where: { userId, status: EntityStatus.ACTIVE },
        select: { id: true, name: true },
    });
    if (tambos.length === 0)
        return { tambos, tamboVos: [], missingTambos: [] };
    const stats = await prisma.monthlyStatistic.findMany({
        where: {
            tamboId: { in: tambos.map((tambo) => tambo.id) },
            period,
        },
        select: { tamboId: true, period: true, vacasOrdene: true },
    });
    const statByTamboId = new Map(stats.map((stat) => [stat.tamboId, stat]));
    const tamboVos = [];
    const missingTambos = [];
    for (const tambo of tambos) {
        const stat = statByTamboId.get(tambo.id);
        if (!stat) {
            missingTambos.push({ tamboId: tambo.id, tamboName: tambo.name });
            continue;
        }
        tamboVos.push({
            tamboId: tambo.id,
            tamboName: tambo.name,
            vo: Number(stat.vacasOrdene),
            voPeriod: stat.period,
        });
    }
    return { tambos, tamboVos, missingTambos };
}
export async function getUserBillingSchedule(userId, configuredCycle, currentPeriod = getCurrentPeriodInArgentina()) {
    const currentCoverage = await prisma.billingInstallment.findFirst({
        where: {
            userId,
            period: { lte: currentPeriod },
            OR: [
                { periodEnd: { gte: currentPeriod } },
                { periodEnd: null, period: currentPeriod },
            ],
        },
        orderBy: [{ periodEnd: "desc" }, { period: "desc" }],
        select: { billingCycleSnapshot: true, period: true, periodEnd: true },
    });
    const coverageThrough = currentCoverage?.periodEnd ?? currentCoverage?.period ?? null;
    return {
        configuredCycle,
        currentCoverage: currentCoverage ? {
            billingCycle: currentCoverage.billingCycleSnapshot,
            period: currentCoverage.period,
            periodEnd: currentCoverage.periodEnd,
        } : null,
        coverageThrough,
        effectivePeriod: coverageThrough ? addMonthsToPeriod(coverageThrough, 1) : currentPeriod,
    };
}
async function getProducerPlansContext() {
    const plans = await prisma.billingPlan.findMany({
        where: {
            targetRole: Role.PRODUCTOR,
            planType: BillingPlanType.SIGLEA_LITERS,
            isActive: true,
        },
    });
    return {
        tierPlans: plans.filter((plan) => !plan.isBasic),
        basicPlan: plans.find((plan) => plan.isBasic) ?? null,
    };
}
function matchTierPlan(tierPlans, vo) {
    let best = null;
    for (const plan of tierPlans) {
        if (plan.minVo === null)
            continue;
        const minVo = Number(plan.minVo);
        const maxVo = plan.maxVo === null ? null : Number(plan.maxVo);
        if (!isVoInProducerTier(vo, minVo, maxVo))
            continue;
        if (!best || Number(best.minVo) < minVo)
            best = plan;
    }
    return best;
}
async function createInstallmentForUser(user, input, producerPlans, options = {}) {
    const billingCycle = options.billingCycleOverride ?? (user.role === Role.EMPRESA
        ? getBillingCycle(user.billingPlan?.billingCycle)
        : getBillingCycle(user.billingCycle));
    const priceMultiplier = user.role === Role.PRODUCTOR
        ? getProducerPriceMultiplier(billingCycle)
        : 1;
    const periodEnd = getBillingPeriodEnd(input.period, billingCycle);
    const existing = await prisma.billingInstallment.findFirst({
        where: {
            ...(options.existingInstallmentId ? { id: { not: options.existingInstallmentId } } : {}),
            userId: user.id,
            period: { lte: periodEnd ?? input.period },
            OR: [
                { periodEnd: { gte: input.period } },
                { periodEnd: null, period: { gte: input.period } },
            ],
        },
    });
    if (existing) {
        return { status: "SKIPPED_OVERLAP", userId: user.id };
    }
    if (!input.sigleaLiterPrice || input.sigleaLiterPrice <= 0) {
        return { status: "SKIPPED_NO_SIGLEA_PRICE", userId: user.id };
    }
    let header;
    const items = [];
    if (user.role === Role.PRODUCTOR) {
        const price = input.sigleaLiterPrice;
        const exactContext = billingCycle === BillingCycle.ANNUAL
            ? await getExactVoPerTambo(user.id, input.period)
            : null;
        const tamboVos = exactContext?.tamboVos ?? await getLatestVoPerTambo(user.id, input.period);
        if (billingCycle === BillingCycle.ANNUAL
            && (exactContext.tambos.length === 0 || exactContext.missingTambos.length > 0)) {
            return {
                status: "SKIPPED_MISSING_CURRENT_VO",
                userId: user.id,
                tambos: exactContext.missingTambos,
                noActiveTambos: exactContext.tambos.length === 0,
            };
        }
        if (tamboVos.length === 0) {
            // Sin VO en la ventana de actividad: se cobra el Plan Básico
            const basicPlan = producerPlans.basicPlan;
            if (!basicPlan || basicPlan.sigleaLiters === null) {
                return { status: "SKIPPED_NO_BASIC_PLAN", userId: user.id };
            }
            const liters = Number(basicPlan.sigleaLiters);
            const itemAmount = round2(liters * price);
            items.push({
                tamboId: null,
                planId: basicPlan.id,
                tamboNameSnapshot: null,
                voUsed: null,
                voPeriod: null,
                planNameSnapshot: basicPlan.name,
                sigleaLitersSnapshot: liters,
                amount: itemAmount,
            });
            header = {
                planId: basicPlan.id,
                amount: itemAmount,
                voUsed: null,
                planNameSnapshot: basicPlan.name,
                planTypeSnapshot: basicPlan.planType,
                targetRoleSnapshot: basicPlan.targetRole,
                sigleaLitersSnapshot: liters,
                fixedPriceSnapshot: null,
            };
        }
        else {
            const unmatchedTambos = [];
            for (const tamboVo of tamboVos) {
                const tierPlan = matchTierPlan(producerPlans.tierPlans, tamboVo.vo);
                if (!tierPlan || tierPlan.sigleaLiters === null) {
                    unmatchedTambos.push({
                        tamboId: tamboVo.tamboId,
                        tamboName: tamboVo.tamboName,
                        voUsed: tamboVo.vo,
                    });
                    continue;
                }
                const liters = Number(tierPlan.sigleaLiters);
                items.push({
                    tamboId: tamboVo.tamboId,
                    planId: tierPlan.id,
                    tamboNameSnapshot: tamboVo.tamboName,
                    voUsed: tamboVo.vo,
                    voPeriod: tamboVo.voPeriod,
                    planNameSnapshot: tierPlan.name,
                    sigleaLitersSnapshot: liters,
                    amount: round2(liters * price),
                });
            }
            // Si algún tambo activo no matchea ningún tramo, se saltea el usuario
            // completo para que el admin corrija los planes (sin cuota parcial)
            if (unmatchedTambos.length > 0) {
                return { status: "SKIPPED_NO_PLAN", userId: user.id, tambos: unmatchedTambos };
            }
            header = {
                planId: items.length === 1 ? items[0].planId : null,
                amount: round2(items.reduce((sum, item) => sum + item.amount, 0)),
                voUsed: tamboVos.reduce((sum, tambo) => sum + tambo.vo, 0),
                planNameSnapshot: items.length === 1
                    ? items[0].planNameSnapshot
                    : `Planes por tambo (${items.length})`,
                planTypeSnapshot: BillingPlanType.SIGLEA_LITERS,
                targetRoleSnapshot: Role.PRODUCTOR,
                sigleaLitersSnapshot: items.reduce((sum, item) => sum + (item.sigleaLitersSnapshot ?? 0), 0),
                fixedPriceSnapshot: null,
            };
        }
    }
    else if (user.role === Role.EMPRESA) {
        const assignedPlan = user.billingPlan?.isActive
            && user.billingPlan.targetRole === Role.EMPRESA
            && user.billingPlan.planType === BillingPlanType.FIXED_ARS
            ? user.billingPlan
            : null;
        const plan = assignedPlan;
        if (!plan || plan.fixedPrice === null) {
            return { status: "SKIPPED_NO_PLAN", userId: user.id, tambos: [] };
        }
        header = {
            planId: plan.id,
            amount: round2(Number(plan.fixedPrice) * input.sigleaLiterPrice),
            voUsed: null,
            planNameSnapshot: plan.name,
            planTypeSnapshot: plan.planType,
            targetRoleSnapshot: plan.targetRole,
            sigleaLitersSnapshot: toNumber(plan.sigleaLiters),
            fixedPriceSnapshot: Number(plan.fixedPrice),
        };
    }
    else {
        return { status: "SKIPPED_NO_PLAN", userId: user.id, tambos: [] };
    }
    if (priceMultiplier > 1) {
        for (const item of items) {
            item.amount = round2(item.amount * priceMultiplier);
            item.sigleaLitersSnapshot = item.sigleaLitersSnapshot === null
                ? null
                : round2(item.sigleaLitersSnapshot * priceMultiplier);
        }
        header.amount = round2(header.amount * priceMultiplier);
        header.sigleaLitersSnapshot = header.sigleaLitersSnapshot === null
            ? null
            : round2(header.sigleaLitersSnapshot * priceMultiplier);
        header.fixedPriceSnapshot = header.fixedPriceSnapshot === null
            ? null
            : round2(header.fixedPriceSnapshot * priceMultiplier);
    }
    const billingPromotion = await findBillingPromotionForDate(user.id, input.dueDate);
    const baseDiscount = billingPromotion?.discountPercent ?? user.billingDiscountPercent;
    const discount = applyDiscount(header.amount, getEffectiveDiscountPercent(baseDiscount, user.billingPaymentMethod));
    const installmentData = {
        userId: user.id,
        planId: header.planId,
        period: input.period,
        periodEnd,
        dueDate: input.dueDate,
        status: discount.amount === 0
            ? BillingInstallmentStatus.BONIFIED
            : BillingInstallmentStatus.PENDING,
        amount: discount.amount,
        grossAmount: discount.grossAmount,
        discountPercentSnapshot: discount.discountPercent,
        discountAmount: discount.discountAmount,
        sigleaLiterPrice: input.sigleaLiterPrice,
        voUsed: header.voUsed,
        billingCycleSnapshot: billingCycle,
        priceMultiplierSnapshot: priceMultiplier,
        billingPromotionId: billingPromotion?.id ?? null,
        billingPromotionReasonSnapshot: billingPromotion?.reason ?? null,
        specialDiscountPercentSnapshot: billingPromotion?.discountPercent ?? null,
        planNameSnapshot: header.planNameSnapshot,
        planTypeSnapshot: header.planTypeSnapshot,
        targetRoleSnapshot: header.targetRoleSnapshot,
        sigleaLitersSnapshot: header.sigleaLitersSnapshot,
        fixedPriceSnapshot: header.fixedPriceSnapshot,
    };
    const include = {
        user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true, razonSocial: true },
        },
        plan: true,
        items: true,
    };
    try {
        if (options.existingInstallmentId) {
            const installment = await prisma.$transaction(async (tx) => {
                const updated = await tx.billingInstallment.updateMany({
                    where: {
                        id: options.existingInstallmentId,
                        status: BillingInstallmentStatus.PENDING,
                    },
                    data: installmentData,
                });
                if (updated.count !== 1) {
                    throw { status: 409, message: "Solo se pueden recalcular cuotas pendientes o vencidas" };
                }
                await tx.billingInstallmentItem.deleteMany({
                    where: { installmentId: options.existingInstallmentId },
                });
                if (items.length > 0) {
                    await tx.billingInstallmentItem.createMany({
                        data: items.map((item) => ({
                            ...item,
                            installmentId: options.existingInstallmentId,
                        })),
                    });
                }
                return tx.billingInstallment.findUniqueOrThrow({
                    where: { id: options.existingInstallmentId },
                    include,
                });
            });
            return { status: "RECALCULATED", installment: serializeInstallment(installment) };
        }
        const installment = await prisma.billingInstallment.create({
            data: {
                ...installmentData,
                ...(items.length > 0 ? { items: { create: items } } : {}),
            },
            include,
        });
        return { status: "CREATED", installment: serializeInstallment(installment) };
    }
    catch (err) {
        if (err?.code === "P2002") {
            return { status: "SKIPPED_DUPLICATE", userId: user.id };
        }
        throw err;
    }
}
const REPRICE_BATCH_SIZE = 25;
const REPRICE_MAX_BATCH_SIZE = 100;
const REPRICE_SELECT = {
    id: true,
    targetRoleSnapshot: true,
    sigleaLitersSnapshot: true,
    fixedPriceSnapshot: true,
    discountPercentSnapshot: true,
    items: { select: { id: true, sigleaLitersSnapshot: true } },
};
/**
 * Calcula los montos de una cuota para un precio dado, respetando la base con
 * la que se emitió: las de empresa sobre `fixedPriceSnapshot` y las de productor
 * sobre los litros snapshot de sus items (o del encabezado si no tiene items).
 * Los snapshots ya traen aplicado el multiplicador del ciclo, no se re-aplica.
 * Devuelve null si la cuota no tiene base para recalcularse.
 */
function calculateRepricedInstallment(installment, sigleaLiterPrice) {
    const isEmpresa = installment.targetRoleSnapshot === Role.EMPRESA;
    const recalculatedItems = isEmpresa
        ? []
        : installment.items
            .filter((item) => item.sigleaLitersSnapshot !== null)
            .map((item) => ({
            id: item.id,
            amount: round2(Number(item.sigleaLitersSnapshot) * sigleaLiterPrice),
        }));
    let grossAmount = null;
    if (recalculatedItems.length > 0) {
        grossAmount = round2(recalculatedItems.reduce((total, item) => total + item.amount, 0));
    }
    else {
        const base = isEmpresa
            ? toNumber(installment.fixedPriceSnapshot)
            : toNumber(installment.sigleaLitersSnapshot);
        if (base !== null)
            grossAmount = round2(base * sigleaLiterPrice);
    }
    if (grossAmount === null)
        return null;
    const discount = applyDiscount(grossAmount, clampDiscountPercent(installment.discountPercentSnapshot));
    return {
        amount: discount.amount,
        grossAmount: discount.grossAmount,
        discountAmount: discount.discountAmount,
        items: recalculatedItems,
    };
}
/** Cuotas impagas: PENDING incluye a las vencidas (OVERDUE se deriva de dueDate). */
export async function countUnpaidInstallments() {
    return prisma.billingInstallment.count({
        where: { status: BillingInstallmentStatus.PENDING },
    });
}
/**
 * Cuenta las cuotas impagas que todavía no quedaron al precio configurado.
 * Sirve para detectar un recálculo por lotes que quedó a medias.
 */
export async function countOutdatedUnpaidInstallments(sigleaLiterPrice) {
    if (!sigleaLiterPrice || sigleaLiterPrice <= 0)
        return 0;
    return prisma.billingInstallment.count({
        where: {
            status: BillingInstallmentStatus.PENDING,
            OR: [
                { sigleaLiterPrice: null },
                { sigleaLiterPrice: { not: sigleaLiterPrice } },
            ],
        },
    });
}
export async function getSigleaRepriceStatus() {
    const sigleaLiterPrice = await getConfiguredSigleaLiterPrice();
    const [totalUnpaid, outdatedCount] = await Promise.all([
        countUnpaidInstallments(),
        countOutdatedUnpaidInstallments(sigleaLiterPrice),
    ]);
    return { sigleaLiterPrice, totalUnpaid, outdatedCount };
}
/**
 * Recalcula un lote de cuotas impagas con el precio Siglea configurado y
 * devuelve el cursor para continuar. Se procesa de a lotes acotados para que
 * cada request entre cómoda en el timeout de 60s del hosting.
 *
 * El precio se lee de la configuración (no se recibe por parámetro) para que
 * todos los lotes de una corrida usen la misma fuente de verdad. El recorrido
 * es por cursor de `id` ascendente, así que es determinístico y reanudable.
 */
export async function repriceUnpaidInstallmentsBatch(options = {}) {
    const sigleaLiterPrice = await getConfiguredSigleaLiterPrice();
    if (!sigleaLiterPrice || sigleaLiterPrice <= 0) {
        throw { status: 400, message: "No hay un precio del litro Siglea configurado" };
    }
    const batchSize = Math.min(REPRICE_MAX_BATCH_SIZE, Math.max(1, Math.trunc(options.batchSize ?? REPRICE_BATCH_SIZE)));
    const cursor = options.cursor || null;
    const installments = await prisma.billingInstallment.findMany({
        where: { status: BillingInstallmentStatus.PENDING },
        select: REPRICE_SELECT,
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    let repricedCount = 0;
    let skippedCount = 0;
    if (installments.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const installment of installments) {
                const recalculated = calculateRepricedInstallment(installment, sigleaLiterPrice);
                if (!recalculated) {
                    // Sin base snapshot no hay forma de recalcularla sin inventar datos.
                    skippedCount += 1;
                    continue;
                }
                await tx.billingInstallment.update({
                    where: { id: installment.id },
                    data: {
                        amount: recalculated.amount,
                        grossAmount: recalculated.grossAmount,
                        discountAmount: recalculated.discountAmount,
                        sigleaLiterPrice,
                    },
                });
                for (const item of recalculated.items) {
                    await tx.billingInstallmentItem.update({
                        where: { id: item.id },
                        data: { amount: item.amount },
                    });
                }
                repricedCount += 1;
            }
        }, { timeout: 45_000 });
    }
    const nextCursor = installments.length === batchSize
        ? installments[installments.length - 1].id
        : null;
    return {
        processedCount: installments.length,
        repricedCount,
        skippedCount,
        nextCursor,
        done: nextCursor === null,
    };
}
/**
 * Recorre todos los lotes de una. Se usa desde scripts y tareas internas: la UI
 * llama a `repriceUnpaidInstallmentsBatch` para poder mostrar el progreso.
 */
export async function repriceUnpaidInstallments(sigleaLiterPrice) {
    if (!Number.isFinite(sigleaLiterPrice) || sigleaLiterPrice <= 0) {
        return { repricedCount: 0, skippedCount: 0, processedCount: 0 };
    }
    let cursor = null;
    let repricedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;
    do {
        const batch = await repriceUnpaidInstallmentsBatch({ cursor });
        repricedCount += batch.repricedCount;
        skippedCount += batch.skippedCount;
        processedCount += batch.processedCount;
        cursor = batch.nextCursor;
    } while (cursor !== null);
    return { repricedCount, skippedCount, processedCount };
}
async function updatePendingProducerInstallments(period, sigleaLiterPrice) {
    if (!sigleaLiterPrice || sigleaLiterPrice <= 0) {
        return [];
    }
    // Las cuotas vencidas también permanecen como PENDING; su estado
    // OVERDUE se calcula al serializarlas a partir de dueDate.
    // Leer fuera de la transacción evita mantenerla abierta mientras se
    // recorren todas las cuotas históricas.
    const installments = await prisma.billingInstallment.findMany({
        where: {
            status: BillingInstallmentStatus.PENDING,
            targetRoleSnapshot: Role.PRODUCTOR,
            billingCycleSnapshot: BillingCycle.MONTHLY,
            period: { lt: period },
            sigleaLitersSnapshot: { not: null },
            OR: [
                { sigleaLiterPrice: null },
                { sigleaLiterPrice: { not: sigleaLiterPrice } },
            ],
        },
        select: {
            id: true,
            sigleaLitersSnapshot: true,
            discountPercentSnapshot: true,
            items: {
                select: {
                    id: true,
                    sigleaLitersSnapshot: true,
                },
            },
        },
    });
    const updatedIds = [];
    for (const installment of installments) {
        const recalculatedItems = installment.items
            .filter((item) => item.sigleaLitersSnapshot !== null)
            .map((item) => ({
            id: item.id,
            amount: round2(Number(item.sigleaLitersSnapshot) * sigleaLiterPrice),
        }));
        const grossAmount = recalculatedItems.length > 0
            ? round2(recalculatedItems.reduce((total, item) => total + item.amount, 0))
            : round2(Number(installment.sigleaLitersSnapshot) * sigleaLiterPrice);
        const discount = applyDiscount(grossAmount, clampDiscountPercent(installment.discountPercentSnapshot));
        // La cuota y sus items se actualizan juntos, pero cada cuota tiene
        // su propia transacción corta. Una corrida masiva ya no acumula
        // todas las consultas dentro del timeout de una sola transacción.
        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.billingInstallment.updateMany({
                where: {
                    id: installment.id,
                    status: BillingInstallmentStatus.PENDING,
                    OR: [
                        { sigleaLiterPrice: null },
                        { sigleaLiterPrice: { not: sigleaLiterPrice } },
                    ],
                },
                data: {
                    amount: discount.amount,
                    grossAmount: discount.grossAmount,
                    discountAmount: discount.discountAmount,
                    sigleaLiterPrice,
                },
            });
            if (result.count === 0)
                return false;
            for (const item of recalculatedItems) {
                await tx.billingInstallmentItem.update({
                    where: { id: item.id },
                    data: { amount: item.amount },
                });
            }
            return true;
        });
        if (updated)
            updatedIds.push(installment.id);
    }
    return updatedIds;
}
export async function generateBillingInstallments(rawInput) {
    // El precio Siglea se administra desde la configuración de cobros: la
    // generación siempre usa el vigente en lugar de recibirlo por request.
    const configuredPrice = await getConfiguredSigleaLiterPrice();
    if (!configuredPrice || configuredPrice <= 0) {
        throw {
            status: 400,
            message: "Configurá el precio del litro Siglea en \"Configurar cobros\" antes de generar cuotas",
        };
    }
    const input = { ...rawInput, sigleaLiterPrice: configuredPrice };
    const roleFilter = input.targetRole ? [input.targetRole] : [Role.PRODUCTOR, Role.EMPRESA];
    const selectedUserIds = input.userIds?.length ? input.userIds : input.userId ? [input.userId] : [];
    const users = await prisma.user.findMany({
        where: selectedUserIds.length > 0
            ? { id: { in: selectedUserIds }, status: "ACTIVE", role: { in: roleFilter } }
            : { status: "ACTIVE", role: { in: roleFilter } },
        include: { billingPlan: true },
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
    });
    if (selectedUserIds.length > 0 && users.length === 0) {
        throw { status: 404, message: "Usuarios activos no encontrados para generar cuotas" };
    }
    const producerPlans = await getProducerPlansContext();
    const updatedPending = await updatePendingProducerInstallments(input.period, input.sigleaLiterPrice);
    const result = {
        created: [],
        updatedPending,
        skippedDuplicates: [],
        skippedNoPlan: [],
        skippedNoBasicPlan: [],
        skippedNoSigleaPrice: [],
        skippedOverlaps: [],
        skippedMissingCurrentVo: [],
    };
    for (const user of users) {
        const outcome = await createInstallmentForUser(user, input, producerPlans);
        if (outcome.status === "CREATED")
            result.created.push(outcome.installment);
        if (outcome.status === "SKIPPED_DUPLICATE")
            result.skippedDuplicates.push(outcome.userId);
        if (outcome.status === "SKIPPED_NO_PLAN")
            result.skippedNoPlan.push({ userId: outcome.userId, tambos: outcome.tambos });
        if (outcome.status === "SKIPPED_NO_BASIC_PLAN")
            result.skippedNoBasicPlan.push(outcome.userId);
        if (outcome.status === "SKIPPED_NO_SIGLEA_PRICE")
            result.skippedNoSigleaPrice.push(outcome.userId);
        if (outcome.status === "SKIPPED_OVERLAP")
            result.skippedOverlaps.push(outcome.userId);
        if (outcome.status === "SKIPPED_MISSING_CURRENT_VO")
            result.skippedMissingCurrentVo.push({
                userId: outcome.userId,
                tambos: outcome.tambos,
                noActiveTambos: outcome.noActiveTambos,
            });
    }
    return {
        ...result,
        summary: {
            created: result.created.length,
            updatedPending: result.updatedPending.length,
            skippedDuplicates: result.skippedDuplicates.length,
            skippedNoPlan: result.skippedNoPlan.length,
            skippedNoBasicPlan: result.skippedNoBasicPlan.length,
            skippedNoSigleaPrice: result.skippedNoSigleaPrice.length,
            skippedOverlaps: result.skippedOverlaps.length,
            skippedMissingCurrentVo: result.skippedMissingCurrentVo.length,
        },
    };
}
// ---------------------------------------------------------------------------
// Generación automática de cuotas (corridas por lotes reanudables)
// ---------------------------------------------------------------------------
const GENERATION_BATCH_SIZE = 10;
const DEFAULT_INSTALLMENT_DUE_DAY = 10;
/**
 * Margen de trabajo por invocación. Vercel Hobby corta a los 60s, así que se
 * deja lugar para cerrar la request. Igual el progreso se guarda lote a lote:
 * si la función muriera de golpe, la corrida se reanuda sin perder lo hecho.
 */
const DEFAULT_GENERATION_TIME_BUDGET_MS = 45_000;
function getGenerationTimeBudgetMs() {
    const configured = Number(process.env.CRON_TIME_BUDGET_MS);
    if (Number.isFinite(configured) && configured >= 5_000)
        return Math.trunc(configured);
    return DEFAULT_GENERATION_TIME_BUDGET_MS;
}
/** Fecha de vencimiento del período, con el día configurado en cobros. */
export function buildDueDateForPeriod(period, dueDay) {
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(4, 6));
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(Math.max(1, Math.trunc(dueDay ?? DEFAULT_INSTALLMENT_DUE_DAY)), lastDayOfMonth);
    return new Date(Date.UTC(year, month - 1, day));
}
export function getCurrentBillingPeriod() {
    return getCurrentPeriodInArgentina();
}
/** Día del mes en Argentina, para decidir si toca generar. */
export function getCurrentDayInArgentina() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Cordoba",
        day: "2-digit",
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "day")?.value ?? "0");
}
const BILLABLE_ROLES = [Role.PRODUCTOR, Role.EMPRESA];
function countBillableUsers() {
    return prisma.user.count({
        where: { status: "ACTIVE", role: { in: BILLABLE_ROLES } },
    });
}
export async function getBillingGenerationRun(period, trigger) {
    return prisma.billingGenerationRun.findUnique({
        where: { period_trigger: { period, trigger } },
    });
}
/** Corrida sin terminar, si quedó alguna (para reanudarla desde el cron o la UI). */
export async function getUnfinishedBillingGenerationRun() {
    return prisma.billingGenerationRun.findFirst({
        where: { status: BillingGenerationStatus.RUNNING },
        orderBy: { startedAt: "asc" },
    });
}
/**
 * Crea la corrida del período (o devuelve la que ya existe, para que una doble
 * invocación del cron no genere cuotas por duplicado).
 */
export async function startBillingGenerationRun(options) {
    const period = options.period ?? getCurrentBillingPeriod();
    const trigger = options.trigger ?? BillingGenerationTrigger.CRON;
    const existing = await getBillingGenerationRun(period, trigger);
    if (existing)
        return { run: existing, alreadyExisted: true };
    const settings = await prisma.billingSettings.findUnique({
        where: { id: BILLING_SETTINGS_ID },
        select: { installmentDueDay: true },
    });
    const dueDate = options.dueDate ?? buildDueDateForPeriod(period, settings?.installmentDueDay);
    try {
        const run = await prisma.billingGenerationRun.create({
            data: {
                period,
                dueDate,
                trigger,
                totalUsers: await countBillableUsers(),
            },
        });
        return { run, alreadyExisted: false };
    }
    catch (err) {
        // Carrera con otra invocación del cron: nos quedamos con la que ganó.
        if (err?.code === "P2002") {
            const run = await getBillingGenerationRun(period, trigger);
            if (run)
                return { run, alreadyExisted: true };
        }
        throw err;
    }
}
/**
 * Procesa usuarios de la corrida en lotes mientras quede presupuesto de tiempo.
 * Devuelve el estado para que el llamador (cron o UI) sepa si falta trabajo.
 */
export async function advanceBillingGenerationRun(options) {
    const startedAt = Date.now();
    const timeBudgetMs = options.timeBudgetMs ?? getGenerationTimeBudgetMs();
    const batchSize = Math.min(50, Math.max(1, Math.trunc(options.batchSize ?? GENERATION_BATCH_SIZE)));
    const run = await prisma.billingGenerationRun.findUnique({ where: { id: options.runId } });
    if (!run)
        throw { status: 404, message: "Corrida de generación no encontrada" };
    if (run.status !== BillingGenerationStatus.RUNNING) {
        return { run, done: true, batches: 0 };
    }
    const configuredPrice = await getConfiguredSigleaLiterPrice();
    if (!configuredPrice || configuredPrice <= 0) {
        const failed = await prisma.billingGenerationRun.update({
            where: { id: run.id },
            data: {
                status: BillingGenerationStatus.FAILED,
                error: "No hay un precio del litro Siglea configurado",
                finishedAt: new Date(),
            },
        });
        return { run: failed, done: true, batches: 0 };
    }
    const input = {
        period: run.period,
        dueDate: run.dueDate,
        sigleaLiterPrice: configuredPrice,
    };
    const producerPlans = await getProducerPlansContext();
    let current = run;
    let batches = 0;
    // Siempre se procesa al menos un lote: si el presupuesto ya estuviera
    // consumido por las consultas previas, la corrida nunca avanzaría y cada
    // invocación devolvería "falta trabajo" sin haber hecho ninguno.
    while (batches === 0 || Date.now() - startedAt < timeBudgetMs) {
        const users = await prisma.user.findMany({
            where: { status: "ACTIVE", role: { in: BILLABLE_ROLES } },
            include: { billingPlan: true },
            orderBy: { id: "asc" },
            take: batchSize,
            ...(current.cursor ? { cursor: { id: current.cursor }, skip: 1 } : {}),
        });
        if (users.length === 0) {
            current = await prisma.billingGenerationRun.update({
                where: { id: current.id },
                data: { status: BillingGenerationStatus.COMPLETED, finishedAt: new Date() },
            });
            return { run: current, done: true, batches };
        }
        const tally = {
            createdCount: 0,
            skippedDuplicates: 0,
            skippedNoPlan: 0,
            skippedNoBasicPlan: 0,
            skippedNoSigleaPrice: 0,
            skippedOverlaps: 0,
            skippedMissingCurrentVo: 0,
        };
        for (const user of users) {
            const outcome = await createInstallmentForUser(user, input, producerPlans);
            if (outcome.status === "CREATED")
                tally.createdCount += 1;
            if (outcome.status === "SKIPPED_DUPLICATE")
                tally.skippedDuplicates += 1;
            if (outcome.status === "SKIPPED_NO_PLAN")
                tally.skippedNoPlan += 1;
            if (outcome.status === "SKIPPED_NO_BASIC_PLAN")
                tally.skippedNoBasicPlan += 1;
            if (outcome.status === "SKIPPED_NO_SIGLEA_PRICE")
                tally.skippedNoSigleaPrice += 1;
            if (outcome.status === "SKIPPED_OVERLAP")
                tally.skippedOverlaps += 1;
            if (outcome.status === "SKIPPED_MISSING_CURRENT_VO")
                tally.skippedMissingCurrentVo += 1;
        }
        // El cursor se persiste junto con los contadores del lote: si la función
        // muere después de esto, la próxima invocación arranca del usuario justo.
        current = await prisma.billingGenerationRun.update({
            where: { id: current.id },
            data: {
                cursor: users[users.length - 1].id,
                processedUsers: { increment: users.length },
                createdCount: { increment: tally.createdCount },
                skippedDuplicates: { increment: tally.skippedDuplicates },
                skippedNoPlan: { increment: tally.skippedNoPlan },
                skippedNoBasicPlan: { increment: tally.skippedNoBasicPlan },
                skippedNoSigleaPrice: { increment: tally.skippedNoSigleaPrice },
                skippedOverlaps: { increment: tally.skippedOverlaps },
                skippedMissingCurrentVo: { increment: tally.skippedMissingCurrentVo },
            },
        });
        batches += 1;
        if (users.length < batchSize) {
            current = await prisma.billingGenerationRun.update({
                where: { id: current.id },
                data: { status: BillingGenerationStatus.COMPLETED, finishedAt: new Date() },
            });
            return { run: current, done: true, batches };
        }
    }
    return { run: current, done: false, batches };
}
/**
 * Punto de entrada del cron. Genera sólo el día configurado (por defecto el 1),
 * y cualquier otro día se limita a retomar una corrida que haya quedado a medias
 * — así una invocación cortada por timeout no queda esperando un mes.
 */
export async function runScheduledBillingGeneration(options = {}) {
    const settings = await prisma.billingSettings.findUnique({
        where: { id: BILLING_SETTINGS_ID },
        select: { autoGenerateEnabled: true },
    });
    if (settings && settings.autoGenerateEnabled === false && !options.force) {
        return { action: "DISABLED", run: null, done: true };
    }
    const unfinished = await getUnfinishedBillingGenerationRun();
    if (unfinished) {
        const advanced = await advanceBillingGenerationRun({ runId: unfinished.id });
        return { action: "RESUMED", ...advanced };
    }
    const period = getCurrentBillingPeriod();
    const isGenerationDay = getCurrentDayInArgentina() === 1;
    const existing = await getBillingGenerationRun(period, BillingGenerationTrigger.CRON);
    if (!isGenerationDay && !options.force) {
        return { action: "SKIPPED_NOT_DUE", run: existing, done: true };
    }
    if (existing) {
        return { action: "ALREADY_DONE", run: existing, done: true };
    }
    const { run } = await startBillingGenerationRun({ period, trigger: BillingGenerationTrigger.CRON });
    const advanced = await advanceBillingGenerationRun({ runId: run.id });
    return { action: "STARTED", ...advanced };
}
// Desglose estimado de la próxima cuota de un productor, con la misma lógica
// que la generación (tramos por tambo, ventana de actividad y Plan Básico)
export async function previewProducerBilling(userId, period, requestedCycle) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true, billingCycle: true },
    });
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    if (user.role !== Role.PRODUCTOR) {
        throw { status: 400, message: "El desglose de plan solo aplica a productores" };
    }
    const previewPeriod = period ?? getCurrentPeriodInArgentina();
    const billingCycle = getBillingCycle(requestedCycle ?? user.billingCycle);
    const priceMultiplier = getProducerPriceMultiplier(billingCycle);
    const [exactContext, recentVos, producerPlans, billingSchedule] = await Promise.all([
        getExactVoPerTambo(userId, previewPeriod),
        billingCycle === BillingCycle.MONTHLY ? getLatestVoPerTambo(userId, previewPeriod) : Promise.resolve([]),
        getProducerPlansContext(),
        getUserBillingSchedule(userId, billingCycle),
    ]);
    const tambos = exactContext.tambos;
    const tamboVos = billingCycle === BillingCycle.ANNUAL ? exactContext.tamboVos : recentVos;
    const voTamboIds = new Set(tamboVos.map((tambo) => tambo.tamboId));
    const tambosWithoutData = billingCycle === BillingCycle.ANNUAL
        ? exactContext.missingTambos
        : tambos
            .filter((tambo) => !voTamboIds.has(tambo.id))
            .map((tambo) => ({ tamboId: tambo.id, tamboName: tambo.name }));
    const base = {
        userId: user.id,
        period: previewPeriod,
        billingCycle,
        priceMultiplier,
        coverageMonths: billingCycle === BillingCycle.ANNUAL ? 12 : 1,
        windowPeriods: billingCycle === BillingCycle.ANNUAL
            ? [previewPeriod]
            : getRecentPeriods(previewPeriod, BILLING_ACTIVITY_WINDOW_MONTHS),
        tambosWithoutData,
        billingSchedule,
    };
    if (billingCycle === BillingCycle.ANNUAL && tambos.length === 0) {
        return {
            ...base,
            mode: "SIN_TAMBOS",
            eligible: false,
            eligibilityReason: "El productor no tiene tambos activos.",
            items: [],
            unmatchedTambos: [],
            totalSigleaLiters: 0,
            cycleSigleaLiters: 0,
        };
    }
    if (tamboVos.length === 0) {
        if (billingCycle === BillingCycle.ANNUAL) {
            return {
                ...base,
                mode: "TAMBOS",
                eligible: false,
                eligibilityReason: "Todos los tambos activos deben tener VO cargado en el mes corriente.",
                items: [],
                unmatchedTambos: [],
                totalSigleaLiters: 0,
                cycleSigleaLiters: 0,
            };
        }
        const basicPlan = producerPlans.basicPlan;
        if (!basicPlan || basicPlan.sigleaLiters === null) {
            return { ...base, mode: "SIN_PLAN_BASICO", eligible: false, items: [], unmatchedTambos: [], totalSigleaLiters: 0, cycleSigleaLiters: 0 };
        }
        const liters = Number(basicPlan.sigleaLiters);
        const items = [{
                tamboId: null,
                tamboName: null,
                vo: null,
                voPeriod: null,
                planId: basicPlan.id,
                planName: basicPlan.name,
                sigleaLiters: liters,
                cycleSigleaLiters: liters,
            }];
        return { ...base, mode: "BASICO", eligible: true, items, unmatchedTambos: [], totalSigleaLiters: liters, cycleSigleaLiters: liters };
    }
    const items = [];
    const unmatchedTambos = [];
    for (const tamboVo of tamboVos) {
        const tierPlan = matchTierPlan(producerPlans.tierPlans, tamboVo.vo);
        if (!tierPlan || tierPlan.sigleaLiters === null) {
            unmatchedTambos.push(tamboVo);
            continue;
        }
        items.push({
            tamboId: tamboVo.tamboId,
            tamboName: tamboVo.tamboName,
            vo: tamboVo.vo,
            voPeriod: tamboVo.voPeriod,
            planId: tierPlan.id,
            planName: tierPlan.name,
            sigleaLiters: Number(tierPlan.sigleaLiters),
            cycleSigleaLiters: round2(Number(tierPlan.sigleaLiters) * priceMultiplier),
        });
    }
    const totalSigleaLiters = round2(items.reduce((sum, item) => sum + item.sigleaLiters, 0));
    const eligible = unmatchedTambos.length === 0
        && (billingCycle !== BillingCycle.ANNUAL || tambosWithoutData.length === 0);
    return {
        ...base,
        mode: "TAMBOS",
        eligible,
        eligibilityReason: eligible
            ? null
            : tambosWithoutData.length > 0
                ? "Todos los tambos activos deben tener VO cargado en el mes corriente."
                : "Hay tambos cuyo VO no coincide con ningún tramo activo.",
        items,
        unmatchedTambos,
        totalSigleaLiters,
        cycleSigleaLiters: round2(totalSigleaLiters * priceMultiplier),
    };
}
export async function updateProducerBillingCycle(userId, billingCycle) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true, billingCycle: true },
    });
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    if (user.role !== Role.PRODUCTOR)
        throw { status: 400, message: "La frecuencia individual solo aplica a productores" };
    if (user.status !== EntityStatus.ACTIVE)
        throw { status: 400, message: "El productor debe estar activo para cambiar su frecuencia" };
    if (user.billingCycle === billingCycle) {
        return { ...user, billingSchedule: await getUserBillingSchedule(userId, billingCycle) };
    }
    if (billingCycle === BillingCycle.ANNUAL) {
        const preview = await previewProducerBilling(userId, getCurrentPeriodInArgentina(), BillingCycle.ANNUAL);
        if (!preview.eligible) {
            throw {
                status: 422,
                message: ("eligibilityReason" in preview ? preview.eligibilityReason : null)
                    ?? "No se puede activar el anual con los datos actuales",
                details: {
                    tambosWithoutData: preview.tambosWithoutData,
                    unmatchedTambos: preview.unmatchedTambos,
                },
            };
        }
    }
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { billingCycle },
        select: { id: true, role: true, status: true, billingCycle: true },
    });
    const billingSchedule = await getUserBillingSchedule(userId, billingCycle);
    return { ...updated, billingSchedule };
}
export async function listBillingInstallments(filters) {
    const dbStatus = filters.status === "OVERDUE" ? BillingInstallmentStatus.PENDING : filters.status;
    const installments = await prisma.billingInstallment.findMany({
        where: {
            ...(filters.period ? {
                period: { lte: filters.period },
                OR: [
                    { periodEnd: { gte: filters.period } },
                    { periodEnd: null, period: filters.period },
                ],
            } : {}),
            ...(dbStatus ? { status: dbStatus } : {}),
            ...(filters.userId ? { userId: filters.userId } : {}),
            ...(filters.role ? { user: { role: filters.role } } : {}),
        },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                    razonSocial: true,
                },
            },
            plan: true,
            items: { orderBy: { createdAt: "asc" } },
        },
        orderBy: [{ period: "desc" }, { dueDate: "asc" }],
    });
    return installments
        .map(serializeInstallment)
        .filter((installment) => !filters.status || installment.effectiveStatus === filters.status);
}
export async function listMyBillingInstallments(userId, filters) {
    return listBillingInstallments({
        ...filters,
        userId,
    });
}
/**
 * Recalcula una sola cuota impaga con la configuración vigente del usuario:
 * tambos y VO, tramo/plan, precio Siglea, forma de pago y bonificación.
 * Conserva el ciclo de la cuota original para no alterar el período cubierto.
 */
export async function recalculateBillingInstallment(id) {
    const existing = await prisma.billingInstallment.findUnique({
        where: { id },
        include: { user: { include: { billingPlan: true } } },
    });
    if (!existing)
        throw { status: 404, message: "Cuota no encontrada" };
    if (existing.status !== BillingInstallmentStatus.PENDING) {
        throw { status: 409, message: "Solo se pueden recalcular cuotas pendientes o vencidas" };
    }
    const sigleaLiterPrice = await getConfiguredSigleaLiterPrice();
    if (!sigleaLiterPrice || sigleaLiterPrice <= 0) {
        throw { status: 400, message: "No hay un precio del litro Siglea configurado" };
    }
    const result = await createInstallmentForUser(existing.user, {
        period: existing.period,
        dueDate: existing.dueDate,
        sigleaLiterPrice,
        userId: existing.userId,
    }, await getProducerPlansContext(), {
        existingInstallmentId: existing.id,
        billingCycleOverride: existing.billingCycleSnapshot,
    });
    if (result.status === "RECALCULATED")
        return result.installment;
    if (result.status === "SKIPPED_NO_BASIC_PLAN") {
        throw { status: 422, message: "No hay un Plan Básico activo para recalcular la cuota" };
    }
    if (result.status === "SKIPPED_NO_PLAN") {
        throw { status: 422, message: "La configuración actual del usuario no coincide con ningún plan activo" };
    }
    if (result.status === "SKIPPED_MISSING_CURRENT_VO") {
        throw { status: 422, message: "Faltan datos de VO del período para recalcular la cuota anual" };
    }
    if (result.status === "SKIPPED_OVERLAP") {
        throw { status: 409, message: "Otra cuota ya cubre el período que se intenta recalcular" };
    }
    throw { status: 422, message: "No se pudo recalcular la cuota con los datos actuales" };
}
export async function markBillingInstallmentPaid(id) {
    const existing = await prisma.billingInstallment.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Cuota no encontrada" };
    const installment = await prisma.billingInstallment.update({
        where: { id },
        data: {
            status: BillingInstallmentStatus.PAID,
            paidAt: new Date(),
        },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, role: true, razonSocial: true },
            },
            plan: true,
            items: { orderBy: { createdAt: "asc" } },
        },
    });
    return serializeInstallment(installment);
}
export async function markBillingInstallmentPending(id) {
    const existing = await prisma.billingInstallment.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Cuota no encontrada" };
    const installment = await prisma.billingInstallment.update({
        where: { id },
        data: {
            status: BillingInstallmentStatus.PENDING,
            paidAt: null,
        },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, role: true, razonSocial: true },
            },
            plan: true,
            items: { orderBy: { createdAt: "asc" } },
        },
    });
    return serializeInstallment(installment);
}
export async function markBillingInstallmentInvoiced(id) {
    const existing = await prisma.billingInstallment.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Cuota no encontrada" };
    const installment = await prisma.billingInstallment.update({
        where: { id },
        data: {
            isInvoiced: true,
            invoicedAt: new Date(),
        },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, role: true, razonSocial: true },
            },
            plan: true,
            items: { orderBy: { createdAt: "asc" } },
        },
    });
    return serializeInstallment(installment);
}
async function getLatestSigleaLiterPrice() {
    const configuredPrice = await getConfiguredSigleaLiterPrice();
    if (configuredPrice && configuredPrice > 0)
        return configuredPrice;
    // Fallback para instalaciones que todavía no configuraron el precio central.
    const latestInstallment = await prisma.billingInstallment.findFirst({
        where: { sigleaLiterPrice: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { sigleaLiterPrice: true },
    });
    return toNumber(latestInstallment?.sigleaLiterPrice);
}
async function getMyBillingEstimate(userId) {
    const [user, sigleaLiterPrice] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            include: { billingPlan: true },
        }),
        getLatestSigleaLiterPrice(),
    ]);
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    if (user.role !== Role.PRODUCTOR && user.role !== Role.EMPRESA) {
        return { available: false, reason: "No hay un plan de cuotas para este usuario." };
    }
    if (!sigleaLiterPrice || sigleaLiterPrice <= 0) {
        return { available: false, reason: "Todavía no hay un precio Siglea vigente para estimar tu cuota." };
    }
    let planGrossAmount = 0;
    let planName = "";
    let billingCycle = getBillingCycle(user.billingCycle);
    let priceMultiplier = 1;
    if (user.role === Role.PRODUCTOR) {
        const currentPeriod = getCurrentPeriodInArgentina();
        priceMultiplier = getProducerPriceMultiplier(billingCycle);
        const [exactContext, recentVos, producerPlans] = await Promise.all([
            billingCycle === BillingCycle.ANNUAL
                ? getExactVoPerTambo(user.id, currentPeriod)
                : Promise.resolve(null),
            billingCycle === BillingCycle.MONTHLY
                ? getLatestVoPerTambo(user.id, currentPeriod)
                : Promise.resolve([]),
            getProducerPlansContext(),
        ]);
        if (billingCycle === BillingCycle.ANNUAL
            && (exactContext.tambos.length === 0 || exactContext.missingTambos.length > 0)) {
            return {
                available: false,
                billingCycle,
                reason: exactContext.tambos.length === 0
                    ? "No hay tambos activos para estimar el plan anual."
                    : "Todos tus tambos deben tener VO cargado en el mes corriente para estimar el plan anual.",
            };
        }
        const tamboVos = exactContext?.tamboVos ?? recentVos;
        if (tamboVos.length === 0) {
            const basicPlan = producerPlans.basicPlan;
            if (!basicPlan || basicPlan.sigleaLiters === null) {
                return { available: false, reason: "No hay datos de ordeñe ni un Plan Básico configurado para estimar tu cuota." };
            }
            planName = basicPlan.name;
            planGrossAmount = round2(Number(basicPlan.sigleaLiters) * sigleaLiterPrice);
        }
        else {
            const matchedPlans = tamboVos.map((tamboVo) => matchTierPlan(producerPlans.tierPlans, tamboVo.vo));
            if (matchedPlans.some((plan) => !plan || plan.sigleaLiters === null)) {
                return { available: false, reason: "Falta configurar un tramo de plan para tus datos de ordeñe actuales." };
            }
            planGrossAmount = round2(matchedPlans.reduce((total, plan) => total + Number(plan.sigleaLiters) * sigleaLiterPrice, 0));
            planName = matchedPlans.length === 1 ? matchedPlans[0].name : `Planes por tambo (${matchedPlans.length})`;
        }
        planGrossAmount = round2(planGrossAmount * priceMultiplier);
    }
    else {
        const assignedPlan = user.billingPlan?.isActive
            && user.billingPlan.targetRole === Role.EMPRESA
            && user.billingPlan.planType === BillingPlanType.FIXED_ARS
            ? user.billingPlan
            : null;
        const plan = assignedPlan;
        if (!plan || plan.fixedPrice === null) {
            return { available: false, reason: "No hay un plan de empresa configurado para estimar tu cuota." };
        }
        planName = plan.name;
        billingCycle = getBillingCycle(plan.billingCycle);
        planGrossAmount = round2(Number(plan.fixedPrice) * sigleaLiterPrice);
    }
    const specialPromotion = await getMyCurrentBillingPromotion(user.id);
    const usualDiscountPercent = clampDiscountPercent(user.billingDiscountPercent);
    const manualDiscountPercent = specialPromotion?.discountPercent ?? usualDiscountPercent;
    const autoDebitDiscountPercent = user.billingPaymentMethod === BillingPaymentMethod.AUTO_DEBIT
        ? AUTO_DEBIT_DISCOUNT_PERCENT
        : 0;
    const discountPercent = Math.min(100, manualDiscountPercent + autoDebitDiscountPercent);
    const current = applyDiscount(planGrossAmount, discountPercent);
    const autoDebitCurrent = applyDiscount(planGrossAmount, Math.min(100, manualDiscountPercent + AUTO_DEBIT_DISCOUNT_PERCENT));
    // El plan anual cobra PRODUCER_ANNUAL_PRICE_MULTIPLIER meses en lugar de 12: la diferencia es el descuento.
    const annualDiscountPercent = round2(((12 - PRODUCER_ANNUAL_PRICE_MULTIPLIER) / 12) * 100);
    const monthlyGrossAmount = user.role === Role.PRODUCTOR
        ? round2(planGrossAmount / priceMultiplier)
        : null;
    const annualCurrent = monthlyGrossAmount !== null
        ? applyDiscount(round2(monthlyGrossAmount * PRODUCER_ANNUAL_PRICE_MULTIPLIER), discountPercent)
        : null;
    const monthlyCurrent = monthlyGrossAmount !== null
        ? applyDiscount(monthlyGrossAmount, discountPercent)
        : null;
    const annualSavingAmount = monthlyCurrent && annualCurrent
        ? round2(round2(monthlyCurrent.amount * 12) - annualCurrent.amount)
        : null;
    return {
        available: true,
        role: user.role,
        planName,
        billingCycle,
        priceMultiplier,
        coverageMonths: billingCycle === BillingCycle.ANNUAL ? 12 : 1,
        sigleaLiterPrice,
        paymentMethod: user.billingPaymentMethod,
        manualDiscountPercent,
        usualDiscountPercent,
        specialPromotion,
        autoDebitDiscountPercent,
        annualDiscountPercent,
        annualPriceMultiplier: PRODUCER_ANNUAL_PRICE_MULTIPLIER,
        annualSavingAmount,
        monthlyCurrent,
        annualCurrent,
        current,
        autoDebitCurrent,
        // Compatibilidad temporal con clientes anteriores.
        monthly: current,
        annual: null,
        autoDebitMonthly: autoDebitCurrent,
        autoDebitAnnual: null,
    };
}
export async function getMyBillingSummary(userId) {
    const [installments, payment, estimate, specialPromotion] = await Promise.all([
        prisma.billingInstallment.findMany({
            where: {
                userId,
                status: BillingInstallmentStatus.PENDING,
            },
            orderBy: { dueDate: "asc" },
            take: 20,
        }),
        getBillingSettings(),
        getMyBillingEstimate(userId),
        getMyCurrentBillingPromotion(userId),
    ]);
    const serialized = installments.map(serializeInstallment);
    const overdue = serialized.filter((installment) => installment.effectiveStatus === "OVERDUE");
    const pending = serialized.filter((installment) => installment.effectiveStatus === BillingInstallmentStatus.PENDING);
    return {
        overdueCount: overdue.length,
        pendingCount: pending.length,
        next: overdue[0] ?? pending[0] ?? null,
        payment,
        estimate,
        specialPromotion,
    };
}
