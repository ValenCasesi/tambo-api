import { BillingCycle, BillingInstallmentStatus, BillingPaymentMethod, BillingPlanType, EntityStatus, Role } from "@prisma/client";
import prisma from "../prisma/client.js";
import { findBillingPromotionForDate, getMyCurrentBillingPromotion } from "./billing-promotion.service.js";
const BILLING_ACTIVITY_WINDOW_MONTHS = 3;
const BILLING_SETTINGS_ID = 1;
const AUTO_DEBIT_DISCOUNT_PERCENT = 20;
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
function getCycleMultiplier(cycle) {
    return cycle === BillingCycle.ANNUAL ? 12 : 1;
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
    if (input.isBasic && (input.targetRole !== Role.PRODUCTOR || input.planType !== BillingPlanType.SIGLEA_LITERS)) {
        throw { status: 400, message: "El Plan Básico debe ser para PRODUCTOR con litros Siglea" };
    }
    if (input.planType === BillingPlanType.SIGLEA_LITERS) {
        if (input.sigleaLiters === undefined || input.sigleaLiters === null || input.sigleaLiters <= 0) {
            throw { status: 400, message: "Los planes por Siglea requieren litros mayores a cero" };
        }
        if (!input.isBasic) {
            if (input.minVo === undefined || input.minVo === null || input.minVo < 0) {
                throw { status: 400, message: "Los planes por Siglea requieren VO mínimo" };
            }
            if (input.maxVo !== undefined && input.maxVo !== null && input.maxVo < input.minVo) {
                throw { status: 400, message: "El VO máximo no puede ser menor al VO mínimo" };
            }
        }
    }
    if (input.planType === BillingPlanType.FIXED_ARS) {
        if (input.fixedPrice === undefined || input.fixedPrice === null || input.fixedPrice <= 0) {
            throw { status: 400, message: "Los planes de empresa requieren litros Siglea mayores a cero" };
        }
    }
}
async function clearOtherCompanyDefaults(planId) {
    await prisma.billingPlan.updateMany({
        where: {
            targetRole: Role.EMPRESA,
            ...(planId ? { id: { not: planId } } : {}),
        },
        data: { isDefault: false },
    });
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
export async function getBillingSettings() {
    const settings = await prisma.billingSettings.findUnique({
        where: { id: BILLING_SETTINGS_ID },
        select: { whatsappNumber: true },
    });
    return { whatsappNumber: settings?.whatsappNumber ?? null };
}
export async function updateBillingSettings(input) {
    const settings = await prisma.billingSettings.upsert({
        where: { id: BILLING_SETTINGS_ID },
        create: { id: BILLING_SETTINGS_ID, whatsappNumber: input.whatsappNumber },
        update: { whatsappNumber: input.whatsappNumber },
        select: { whatsappNumber: true },
    });
    return settings;
}
export async function createBillingPlan(input) {
    validatePlanShape(input);
    const isBasic = input.targetRole === Role.PRODUCTOR ? input.isBasic ?? false : false;
    if (input.isDefault && input.targetRole === Role.EMPRESA) {
        await clearOtherCompanyDefaults();
    }
    if (isBasic) {
        await clearOtherBasicPlans();
    }
    const plan = await prisma.billingPlan.create({
        data: {
            name: input.name,
            targetRole: input.targetRole,
            planType: input.planType,
            minVo: input.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? input.minVo : null,
            maxVo: input.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? input.maxVo ?? null : null,
            sigleaLiters: input.planType === BillingPlanType.SIGLEA_LITERS ? input.sigleaLiters : null,
            fixedPrice: input.planType === BillingPlanType.FIXED_ARS ? input.fixedPrice : null,
            isActive: input.isActive ?? true,
            isDefault: input.targetRole === Role.EMPRESA ? input.isDefault ?? false : false,
            isBasic,
        },
    });
    return serializePlan(plan);
}
export async function updateBillingPlan(input) {
    const existing = await prisma.billingPlan.findUnique({ where: { id: input.id } });
    if (!existing)
        throw { status: 404, message: "Plan no encontrado" };
    const merged = {
        name: input.name ?? existing.name,
        targetRole: input.targetRole ?? existing.targetRole,
        planType: input.planType ?? existing.planType,
        minVo: input.minVo !== undefined ? input.minVo : toNumber(existing.minVo),
        maxVo: input.maxVo !== undefined ? input.maxVo : toNumber(existing.maxVo),
        sigleaLiters: input.sigleaLiters !== undefined ? input.sigleaLiters : toNumber(existing.sigleaLiters),
        fixedPrice: input.fixedPrice !== undefined ? input.fixedPrice : toNumber(existing.fixedPrice),
        isActive: input.isActive ?? existing.isActive,
        isDefault: input.isDefault ?? existing.isDefault,
        isBasic: input.isBasic ?? existing.isBasic,
    };
    validatePlanShape(merged);
    const isBasic = merged.targetRole === Role.PRODUCTOR ? merged.isBasic ?? false : false;
    if (merged.isDefault && merged.targetRole === Role.EMPRESA) {
        await clearOtherCompanyDefaults(input.id);
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
            minVo: merged.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? merged.minVo : null,
            maxVo: merged.planType === BillingPlanType.SIGLEA_LITERS && !isBasic ? merged.maxVo ?? null : null,
            sigleaLiters: merged.planType === BillingPlanType.SIGLEA_LITERS ? merged.sigleaLiters : null,
            fixedPrice: merged.planType === BillingPlanType.FIXED_ARS ? merged.fixedPrice : null,
            isActive: merged.isActive,
            isDefault: merged.targetRole === Role.EMPRESA ? merged.isDefault ?? false : false,
            isBasic,
        },
    });
    return serializePlan(plan);
}
export async function deleteBillingPlan(id) {
    const existing = await prisma.billingPlan.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Plan no encontrado" };
    const [linkedInstallments, linkedItems] = await Promise.all([
        prisma.billingInstallment.count({ where: { planId: id } }),
        prisma.billingInstallmentItem.count({ where: { planId: id } }),
    ]);
    if (linkedInstallments > 0 || linkedItems > 0) {
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
        if (minVo > vo || (maxVo !== null && maxVo < vo))
            continue;
        if (!best || Number(best.minVo) < minVo)
            best = plan;
    }
    return best;
}
async function findCompanyPlan() {
    const defaultPlan = await prisma.billingPlan.findFirst({
        where: {
            targetRole: Role.EMPRESA,
            planType: BillingPlanType.FIXED_ARS,
            isActive: true,
            isDefault: true,
        },
        orderBy: { createdAt: "desc" },
    });
    if (defaultPlan)
        return defaultPlan;
    return prisma.billingPlan.findFirst({
        where: {
            targetRole: Role.EMPRESA,
            planType: BillingPlanType.FIXED_ARS,
            isActive: true,
        },
        orderBy: { createdAt: "desc" },
    });
}
async function createInstallmentForUser(user, input, producerPlans) {
    const billingCycle = getBillingCycle(user.billingCycle);
    const cycleMultiplier = getCycleMultiplier(billingCycle);
    const periodEnd = billingCycle === BillingCycle.ANNUAL ? addMonthsToPeriod(input.period, 11) : null;
    const existing = await prisma.billingInstallment.findFirst({
        where: {
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
        const tamboVos = await getLatestVoPerTambo(user.id, input.period);
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
        const plan = assignedPlan || await findCompanyPlan();
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
    if (cycleMultiplier > 1) {
        for (const item of items) {
            item.amount = round2(item.amount * cycleMultiplier);
            item.sigleaLitersSnapshot = item.sigleaLitersSnapshot === null
                ? null
                : round2(item.sigleaLitersSnapshot * cycleMultiplier);
        }
        header.amount = round2(header.amount * cycleMultiplier);
        header.sigleaLitersSnapshot = header.sigleaLitersSnapshot === null
            ? null
            : round2(header.sigleaLitersSnapshot * cycleMultiplier);
        header.fixedPriceSnapshot = header.fixedPriceSnapshot === null
            ? null
            : round2(header.fixedPriceSnapshot * cycleMultiplier);
    }
    const billingPromotion = await findBillingPromotionForDate(user.id, input.dueDate);
    const baseDiscount = billingPromotion?.discountPercent ?? user.billingDiscountPercent;
    const discount = applyDiscount(header.amount, getEffectiveDiscountPercent(baseDiscount, user.billingPaymentMethod));
    try {
        const installment = await prisma.billingInstallment.create({
            data: {
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
                billingPromotionId: billingPromotion?.id ?? null,
                billingPromotionReasonSnapshot: billingPromotion?.reason ?? null,
                specialDiscountPercentSnapshot: billingPromotion?.discountPercent ?? null,
                planNameSnapshot: header.planNameSnapshot,
                planTypeSnapshot: header.planTypeSnapshot,
                targetRoleSnapshot: header.targetRoleSnapshot,
                sigleaLitersSnapshot: header.sigleaLitersSnapshot,
                fixedPriceSnapshot: header.fixedPriceSnapshot,
                ...(items.length > 0 ? { items: { create: items } } : {}),
            },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, email: true, role: true },
                },
                plan: true,
                items: true,
            },
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
export async function generateBillingInstallments(input) {
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
    const result = {
        created: [],
        skippedDuplicates: [],
        skippedNoPlan: [],
        skippedNoBasicPlan: [],
        skippedNoSigleaPrice: [],
        skippedOverlaps: [],
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
    }
    return {
        ...result,
        summary: {
            created: result.created.length,
            skippedDuplicates: result.skippedDuplicates.length,
            skippedNoPlan: result.skippedNoPlan.length,
            skippedNoBasicPlan: result.skippedNoBasicPlan.length,
            skippedNoSigleaPrice: result.skippedNoSigleaPrice.length,
            skippedOverlaps: result.skippedOverlaps.length,
        },
    };
}
// Desglose estimado de la próxima cuota de un productor, con la misma lógica
// que la generación (tramos por tambo, ventana de actividad y Plan Básico)
export async function previewProducerBilling(userId, period) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
    });
    if (!user)
        throw { status: 404, message: "Usuario no encontrado" };
    if (user.role !== Role.PRODUCTOR) {
        throw { status: 400, message: "El desglose de plan solo aplica a productores" };
    }
    const now = new Date();
    const effectivePeriod = period ?? `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [tambos, tamboVos, producerPlans] = await Promise.all([
        prisma.tambo.findMany({
            where: { userId, status: EntityStatus.ACTIVE },
            select: { id: true, name: true },
        }),
        getLatestVoPerTambo(userId, effectivePeriod),
        getProducerPlansContext(),
    ]);
    const voTamboIds = new Set(tamboVos.map((tambo) => tambo.tamboId));
    const tambosWithoutData = tambos
        .filter((tambo) => !voTamboIds.has(tambo.id))
        .map((tambo) => ({ tamboId: tambo.id, tamboName: tambo.name }));
    const base = {
        userId: user.id,
        period: effectivePeriod,
        windowPeriods: getRecentPeriods(effectivePeriod, BILLING_ACTIVITY_WINDOW_MONTHS),
        tambosWithoutData,
    };
    if (tamboVos.length === 0) {
        const basicPlan = producerPlans.basicPlan;
        if (!basicPlan || basicPlan.sigleaLiters === null) {
            return { ...base, mode: "SIN_PLAN_BASICO", items: [], unmatchedTambos: [], totalSigleaLiters: 0 };
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
            }];
        return { ...base, mode: "BASICO", items, unmatchedTambos: [], totalSigleaLiters: liters };
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
        });
    }
    return {
        ...base,
        mode: "TAMBOS",
        items,
        unmatchedTambos,
        totalSigleaLiters: round2(items.reduce((sum, item) => sum + item.sigleaLiters, 0)),
    };
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
    let monthlyGrossAmount = 0;
    let planName = "";
    if (user.role === Role.PRODUCTOR) {
        const currentPeriod = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const [tamboVos, producerPlans] = await Promise.all([
            getLatestVoPerTambo(user.id, currentPeriod),
            getProducerPlansContext(),
        ]);
        if (tamboVos.length === 0) {
            const basicPlan = producerPlans.basicPlan;
            if (!basicPlan || basicPlan.sigleaLiters === null) {
                return { available: false, reason: "No hay datos de ordeñe ni un Plan Básico configurado para estimar tu cuota." };
            }
            planName = basicPlan.name;
            monthlyGrossAmount = round2(Number(basicPlan.sigleaLiters) * sigleaLiterPrice);
        }
        else {
            const matchedPlans = tamboVos.map((tamboVo) => matchTierPlan(producerPlans.tierPlans, tamboVo.vo));
            if (matchedPlans.some((plan) => !plan || plan.sigleaLiters === null)) {
                return { available: false, reason: "Falta configurar un tramo de plan para tus datos de ordeñe actuales." };
            }
            monthlyGrossAmount = round2(matchedPlans.reduce((total, plan) => total + Number(plan.sigleaLiters) * sigleaLiterPrice, 0));
            planName = matchedPlans.length === 1 ? matchedPlans[0].name : `Planes por tambo (${matchedPlans.length})`;
        }
    }
    else {
        const assignedPlan = user.billingPlan?.isActive
            && user.billingPlan.targetRole === Role.EMPRESA
            && user.billingPlan.planType === BillingPlanType.FIXED_ARS
            ? user.billingPlan
            : null;
        const plan = assignedPlan || await findCompanyPlan();
        if (!plan || plan.fixedPrice === null) {
            return { available: false, reason: "No hay un plan de empresa configurado para estimar tu cuota." };
        }
        planName = plan.name;
        monthlyGrossAmount = round2(Number(plan.fixedPrice) * sigleaLiterPrice);
    }
    const specialPromotion = await getMyCurrentBillingPromotion(user.id);
    const usualDiscountPercent = clampDiscountPercent(user.billingDiscountPercent);
    const manualDiscountPercent = specialPromotion?.discountPercent ?? usualDiscountPercent;
    const autoDebitDiscountPercent = user.billingPaymentMethod === BillingPaymentMethod.AUTO_DEBIT
        ? AUTO_DEBIT_DISCOUNT_PERCENT
        : 0;
    const discountPercent = Math.min(100, manualDiscountPercent + autoDebitDiscountPercent);
    const monthly = applyDiscount(monthlyGrossAmount, discountPercent);
    const annual = user.role === Role.EMPRESA
        ? applyDiscount(round2(monthlyGrossAmount * 12), discountPercent)
        : null;
    const autoDebitMonthly = applyDiscount(monthlyGrossAmount, Math.min(100, manualDiscountPercent + AUTO_DEBIT_DISCOUNT_PERCENT));
    const autoDebitAnnual = user.role === Role.EMPRESA
        ? applyDiscount(round2(monthlyGrossAmount * 12), Math.min(100, manualDiscountPercent + AUTO_DEBIT_DISCOUNT_PERCENT))
        : null;
    return {
        available: true,
        role: user.role,
        planName,
        sigleaLiterPrice,
        paymentMethod: user.billingPaymentMethod,
        manualDiscountPercent,
        usualDiscountPercent,
        specialPromotion,
        autoDebitDiscountPercent,
        monthly,
        annual,
        autoDebitMonthly,
        autoDebitAnnual,
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
