import { BillingCycle, BillingInstallmentStatus, BillingPlanType, EntityStatus, Prisma, Role } from "@prisma/client";
import type { BillingPlan } from "@prisma/client";
import prisma from "../prisma/client.js";

type EffectiveStatus = BillingInstallmentStatus | "OVERDUE";

type CreatePlanInput = {
    name: string;
    targetRole: Role;
    planType: BillingPlanType;
    minVo?: number | null;
    maxVo?: number | null;
    sigleaLiters?: number | null;
    fixedPrice?: number | null;
    isActive?: boolean;
    isDefault?: boolean;
    isBasic?: boolean;
};

type UpdatePlanInput = Partial<CreatePlanInput> & {
    id: string;
};

type GenerateInstallmentsInput = {
    period: string;
    dueDate: Date;
    sigleaLiterPrice?: number | null;
    userId?: string;
    userIds?: string[];
    targetRole?: Role;
};

type ListInstallmentsFilters = {
    period?: string;
    status?: EffectiveStatus;
    role?: Role;
    userId?: string;
};

const BILLING_ACTIVITY_WINDOW_MONTHS = 3;

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) return null;
    return Number(value);
}

function round2(value: number) {
    return Math.round(value * 100) / 100;
}

function clampDiscountPercent(value: Prisma.Decimal | number | string | null | undefined) {
    const percent = toNumber(value) ?? 0;
    return Math.min(100, Math.max(0, percent));
}

function getBillingCycle(value: BillingCycle | null | undefined) {
    return value === BillingCycle.ANNUAL ? BillingCycle.ANNUAL : BillingCycle.MONTHLY;
}

function getCycleMultiplier(cycle: BillingCycle) {
    return cycle === BillingCycle.ANNUAL ? 12 : 1;
}

function addMonthsToPeriod(period: string, monthsToAdd: number) {
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

function applyDiscount(grossAmount: number, discountPercent: number) {
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

function getEffectiveStatus(status: BillingInstallmentStatus, dueDate: Date): EffectiveStatus {
    if (status === BillingInstallmentStatus.PAID) return BillingInstallmentStatus.PAID;
    return dueDate < todayAtStart() ? "OVERDUE" : BillingInstallmentStatus.PENDING;
}

function serializePlan(plan: any) {
    return {
        ...plan,
        minVo: toNumber(plan.minVo),
        maxVo: toNumber(plan.maxVo),
        sigleaLiters: toNumber(plan.sigleaLiters),
        fixedPrice: toNumber(plan.fixedPrice),
    };
}

function serializeInstallmentItem(item: any) {
    return {
        ...item,
        voUsed: toNumber(item.voUsed),
        sigleaLitersSnapshot: toNumber(item.sigleaLitersSnapshot),
        amount: toNumber(item.amount),
    };
}

function serializeInstallment(installment: any) {
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
        effectiveStatus: getEffectiveStatus(installment.status, installment.dueDate),
        plan: installment.plan ? serializePlan(installment.plan) : null,
        items: Array.isArray(installment.items)
            ? installment.items.map(serializeInstallmentItem)
            : undefined,
    };
}

function validatePlanShape(input: CreatePlanInput) {
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

async function clearOtherCompanyDefaults(planId?: string) {
    await prisma.billingPlan.updateMany({
        where: {
            targetRole: Role.EMPRESA,
            ...(planId ? { id: { not: planId } } : {}),
        },
        data: { isDefault: false },
    });
}

async function clearOtherBasicPlans(planId?: string) {
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

export async function createBillingPlan(input: CreatePlanInput) {
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

export async function updateBillingPlan(input: UpdatePlanInput) {
    const existing = await prisma.billingPlan.findUnique({ where: { id: input.id } });
    if (!existing) throw { status: 404, message: "Plan no encontrado" };

    const merged: CreatePlanInput = {
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

export async function deleteBillingPlan(id: string) {
    const existing = await prisma.billingPlan.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Plan no encontrado" };

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

function getRecentPeriods(period: string, count: number) {
    const periods: string[] = [];
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

type TamboVo = {
    tamboId: string;
    tamboName: string;
    vo: number;
    voPeriod: string;
};

async function getLatestVoPerTambo(userId: string, period: string): Promise<TamboVo[]> {
    const tambos = await prisma.tambo.findMany({
        where: { userId, status: EntityStatus.ACTIVE },
        select: { id: true, name: true },
    });

    if (tambos.length === 0) return [];

    const stats = await prisma.monthlyStatistic.findMany({
        where: {
            tamboId: { in: tambos.map((tambo) => tambo.id) },
            period: { in: getRecentPeriods(period, BILLING_ACTIVITY_WINDOW_MONTHS) },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { tamboId: true, period: true, vacasOrdene: true },
    });

    const nameByTamboId = new Map(tambos.map((tambo) => [tambo.id, tambo.name]));
    const latestByTamboId = new Map<string, TamboVo>();

    for (const stat of stats) {
        if (latestByTamboId.has(stat.tamboId)) continue;
        latestByTamboId.set(stat.tamboId, {
            tamboId: stat.tamboId,
            tamboName: nameByTamboId.get(stat.tamboId) ?? "",
            vo: Number(stat.vacasOrdene),
            voPeriod: stat.period,
        });
    }

    return [...latestByTamboId.values()];
}

type ProducerPlansContext = {
    tierPlans: BillingPlan[];
    basicPlan: BillingPlan | null;
};

async function getProducerPlansContext(): Promise<ProducerPlansContext> {
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

function matchTierPlan(tierPlans: BillingPlan[], vo: number) {
    let best: BillingPlan | null = null;

    for (const plan of tierPlans) {
        if (plan.minVo === null) continue;
        const minVo = Number(plan.minVo);
        const maxVo = plan.maxVo === null ? null : Number(plan.maxVo);
        if (minVo > vo || (maxVo !== null && maxVo < vo)) continue;
        if (!best || Number(best.minVo) < minVo) best = plan;
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

    if (defaultPlan) return defaultPlan;

    return prisma.billingPlan.findFirst({
        where: {
            targetRole: Role.EMPRESA,
            planType: BillingPlanType.FIXED_ARS,
            isActive: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

type InstallmentItemData = {
    tamboId: string | null;
    planId: string | null;
    tamboNameSnapshot: string | null;
    voUsed: number | null;
    voPeriod: string | null;
    planNameSnapshot: string;
    sigleaLitersSnapshot: number | null;
    amount: number;
};

type InstallmentHeaderData = {
    planId: string | null;
    amount: number;
    voUsed: number | null;
    planNameSnapshot: string;
    planTypeSnapshot: BillingPlanType;
    targetRoleSnapshot: Role;
    sigleaLitersSnapshot: number | null;
    fixedPriceSnapshot: number | null;
};

async function createInstallmentForUser(
    user: {
        id: string;
        role: Role;
        billingPlan?: any | null;
        billingCycle?: BillingCycle | null;
        billingDiscountPercent?: Prisma.Decimal | number | string | null;
    },
    input: GenerateInstallmentsInput,
    producerPlans: ProducerPlansContext
) {
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
        return { status: "SKIPPED_OVERLAP" as const, userId: user.id };
    }

    if (!input.sigleaLiterPrice || input.sigleaLiterPrice <= 0) {
        return { status: "SKIPPED_NO_SIGLEA_PRICE" as const, userId: user.id };
    }

    let header: InstallmentHeaderData;
    const items: InstallmentItemData[] = [];

    if (user.role === Role.PRODUCTOR) {
        const price = input.sigleaLiterPrice;
        const tamboVos = await getLatestVoPerTambo(user.id, input.period);

        if (tamboVos.length === 0) {
            // Sin VO en la ventana de actividad: se cobra el Plan Básico
            const basicPlan = producerPlans.basicPlan;
            if (!basicPlan || basicPlan.sigleaLiters === null) {
                return { status: "SKIPPED_NO_BASIC_PLAN" as const, userId: user.id };
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
        } else {
            const unmatchedTambos: Array<{ tamboId: string; tamboName: string; voUsed: number }> = [];

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
                return { status: "SKIPPED_NO_PLAN" as const, userId: user.id, tambos: unmatchedTambos };
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
    } else if (user.role === Role.EMPRESA) {
        const assignedPlan = user.billingPlan?.isActive
            && user.billingPlan.targetRole === Role.EMPRESA
            && user.billingPlan.planType === BillingPlanType.FIXED_ARS
            ? user.billingPlan
            : null;

        const plan = assignedPlan || await findCompanyPlan();
        if (!plan || plan.fixedPrice === null) {
            return { status: "SKIPPED_NO_PLAN" as const, userId: user.id, tambos: [] };
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
    } else {
        return { status: "SKIPPED_NO_PLAN" as const, userId: user.id, tambos: [] };
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

    const discount = applyDiscount(header.amount, clampDiscountPercent(user.billingDiscountPercent));

    try {
        const installment = await prisma.billingInstallment.create({
            data: {
                userId: user.id,
                planId: header.planId,
                period: input.period,
                periodEnd,
                dueDate: input.dueDate,
                amount: discount.amount,
                grossAmount: discount.grossAmount,
                discountPercentSnapshot: discount.discountPercent,
                discountAmount: discount.discountAmount,
                sigleaLiterPrice: input.sigleaLiterPrice,
                voUsed: header.voUsed,
                billingCycleSnapshot: billingCycle,
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

        return { status: "CREATED" as const, installment: serializeInstallment(installment) };
    } catch (err: any) {
        if (err?.code === "P2002") {
            return { status: "SKIPPED_DUPLICATE" as const, userId: user.id };
        }
        throw err;
    }
}

export async function generateBillingInstallments(input: GenerateInstallmentsInput) {
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
        created: [] as any[],
        skippedDuplicates: [] as string[],
        skippedNoPlan: [] as Array<{ userId: string; tambos: Array<{ tamboId: string; tamboName: string; voUsed: number }> }>,
        skippedNoBasicPlan: [] as string[],
        skippedNoSigleaPrice: [] as string[],
        skippedOverlaps: [] as string[],
    };

    for (const user of users) {
        const outcome = await createInstallmentForUser(user, input, producerPlans);
        if (outcome.status === "CREATED") result.created.push(outcome.installment);
        if (outcome.status === "SKIPPED_DUPLICATE") result.skippedDuplicates.push(outcome.userId);
        if (outcome.status === "SKIPPED_NO_PLAN") result.skippedNoPlan.push({ userId: outcome.userId, tambos: outcome.tambos });
        if (outcome.status === "SKIPPED_NO_BASIC_PLAN") result.skippedNoBasicPlan.push(outcome.userId);
        if (outcome.status === "SKIPPED_NO_SIGLEA_PRICE") result.skippedNoSigleaPrice.push(outcome.userId);
        if (outcome.status === "SKIPPED_OVERLAP") result.skippedOverlaps.push(outcome.userId);
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

type BillingPreviewItem = {
    tamboId: string | null;
    tamboName: string | null;
    vo: number | null;
    voPeriod: string | null;
    planId: string;
    planName: string;
    sigleaLiters: number;
};

// Desglose estimado de la próxima cuota de un productor, con la misma lógica
// que la generación (tramos por tambo, ventana de actividad y Plan Básico)
export async function previewProducerBilling(userId: string, period?: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
    });
    if (!user) throw { status: 404, message: "Usuario no encontrado" };
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
            return { ...base, mode: "SIN_PLAN_BASICO" as const, items: [] as BillingPreviewItem[], unmatchedTambos: [], totalSigleaLiters: 0 };
        }

        const liters = Number(basicPlan.sigleaLiters);
        const items: BillingPreviewItem[] = [{
            tamboId: null,
            tamboName: null,
            vo: null,
            voPeriod: null,
            planId: basicPlan.id,
            planName: basicPlan.name,
            sigleaLiters: liters,
        }];

        return { ...base, mode: "BASICO" as const, items, unmatchedTambos: [], totalSigleaLiters: liters };
    }

    const items: BillingPreviewItem[] = [];
    const unmatchedTambos: TamboVo[] = [];

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
        mode: "TAMBOS" as const,
        items,
        unmatchedTambos,
        totalSigleaLiters: round2(items.reduce((sum, item) => sum + item.sigleaLiters, 0)),
    };
}

export async function listBillingInstallments(filters: ListInstallmentsFilters) {
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
            ...(dbStatus ? { status: dbStatus as BillingInstallmentStatus } : {}),
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

export async function listMyBillingInstallments(
    userId: string,
    filters: Pick<ListInstallmentsFilters, "period" | "status">
) {
    return listBillingInstallments({
        ...filters,
        userId,
    });
}

export async function markBillingInstallmentPaid(id: string) {
    const existing = await prisma.billingInstallment.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Cuota no encontrada" };

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

export async function markBillingInstallmentPending(id: string) {
    const existing = await prisma.billingInstallment.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Cuota no encontrada" };

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

export async function markBillingInstallmentInvoiced(id: string) {
    const existing = await prisma.billingInstallment.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Cuota no encontrada" };

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

export async function getMyBillingSummary(userId: string) {
    const installments = await prisma.billingInstallment.findMany({
        where: {
            userId,
            status: BillingInstallmentStatus.PENDING,
        },
        orderBy: { dueDate: "asc" },
        take: 20,
    });

    const serialized = installments.map(serializeInstallment);
    const overdue = serialized.filter((installment) => installment.effectiveStatus === "OVERDUE");
    const pending = serialized.filter((installment) => installment.effectiveStatus === BillingInstallmentStatus.PENDING);

    return {
        overdueCount: overdue.length,
        pendingCount: pending.length,
        next: overdue[0] ?? pending[0] ?? null,
    };
}
