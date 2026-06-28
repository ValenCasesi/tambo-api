import { BillingInstallmentStatus, BillingPlanType, Prisma, Role } from "@prisma/client";
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

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) return null;
    return Number(value);
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

function serializeInstallment(installment: any) {
    return {
        ...installment,
        amount: toNumber(installment.amount),
        sigleaLiterPrice: toNumber(installment.sigleaLiterPrice),
        voUsed: toNumber(installment.voUsed),
        sigleaLitersSnapshot: toNumber(installment.sigleaLitersSnapshot),
        fixedPriceSnapshot: toNumber(installment.fixedPriceSnapshot),
        effectiveStatus: getEffectiveStatus(installment.status, installment.dueDate),
        plan: installment.plan ? serializePlan(installment.plan) : null,
    };
}

function validatePlanShape(input: CreatePlanInput) {
    if (input.targetRole !== Role.PRODUCTOR && input.targetRole !== Role.EMPRESA) {
        throw { status: 400, message: "El plan solo puede ser para PRODUCTOR o EMPRESA" };
    }

    if (input.planType === BillingPlanType.SIGLEA_LITERS) {
        if (input.sigleaLiters === undefined || input.sigleaLiters === null || input.sigleaLiters <= 0) {
            throw { status: 400, message: "Los planes por Siglea requieren litros mayores a cero" };
        }
        if (input.minVo === undefined || input.minVo === null || input.minVo < 0) {
            throw { status: 400, message: "Los planes por Siglea requieren VO mínimo" };
        }
        if (input.maxVo !== undefined && input.maxVo !== null && input.maxVo < input.minVo) {
            throw { status: 400, message: "El VO máximo no puede ser menor al VO mínimo" };
        }
    }

    if (input.planType === BillingPlanType.FIXED_ARS) {
        if (input.fixedPrice === undefined || input.fixedPrice === null || input.fixedPrice <= 0) {
            throw { status: 400, message: "Los planes fijos requieren un monto mayor a cero" };
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

    if (input.isDefault && input.targetRole === Role.EMPRESA) {
        await clearOtherCompanyDefaults();
    }

    const plan = await prisma.billingPlan.create({
        data: {
            name: input.name,
            targetRole: input.targetRole,
            planType: input.planType,
            minVo: input.planType === BillingPlanType.SIGLEA_LITERS ? input.minVo : null,
            maxVo: input.planType === BillingPlanType.SIGLEA_LITERS ? input.maxVo ?? null : null,
            sigleaLiters: input.planType === BillingPlanType.SIGLEA_LITERS ? input.sigleaLiters : null,
            fixedPrice: input.planType === BillingPlanType.FIXED_ARS ? input.fixedPrice : null,
            isActive: input.isActive ?? true,
            isDefault: input.targetRole === Role.EMPRESA ? input.isDefault ?? false : false,
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
    };

    validatePlanShape(merged);

    if (merged.isDefault && merged.targetRole === Role.EMPRESA) {
        await clearOtherCompanyDefaults(input.id);
    }

    const plan = await prisma.billingPlan.update({
        where: { id: input.id },
        data: {
            name: merged.name,
            targetRole: merged.targetRole,
            planType: merged.planType,
            minVo: merged.planType === BillingPlanType.SIGLEA_LITERS ? merged.minVo : null,
            maxVo: merged.planType === BillingPlanType.SIGLEA_LITERS ? merged.maxVo ?? null : null,
            sigleaLiters: merged.planType === BillingPlanType.SIGLEA_LITERS ? merged.sigleaLiters : null,
            fixedPrice: merged.planType === BillingPlanType.FIXED_ARS ? merged.fixedPrice : null,
            isActive: merged.isActive,
            isDefault: merged.targetRole === Role.EMPRESA ? merged.isDefault ?? false : false,
        },
    });

    return serializePlan(plan);
}

export async function deleteBillingPlan(id: string) {
    const existing = await prisma.billingPlan.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Plan no encontrado" };

    const linkedInstallments = await prisma.billingInstallment.count({ where: { planId: id } });
    if (linkedInstallments > 0) {
        const plan = await prisma.billingPlan.update({
            where: { id },
            data: { isActive: false, isDefault: false },
        });
        return serializePlan(plan);
    }

    const plan = await prisma.billingPlan.delete({ where: { id } });
    return serializePlan(plan);
}

async function getLatestVoForUser(userId: string) {
    const latest = await prisma.monthlyStatistic.findFirst({
        where: { tambo: { userId } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { period: true },
    });

    if (!latest) return null;

    const stats = await prisma.monthlyStatistic.findMany({
        where: {
            period: latest.period,
            tambo: { userId },
        },
        select: { vacasOrdene: true },
    });

    return stats.reduce((sum, stat) => sum + Number(stat.vacasOrdene), 0);
}

async function findProducerPlan(vo: number) {
    return prisma.billingPlan.findFirst({
        where: {
            targetRole: Role.PRODUCTOR,
            planType: BillingPlanType.SIGLEA_LITERS,
            isActive: true,
            minVo: { lte: vo },
            OR: [
                { maxVo: null },
                { maxVo: { gte: vo } },
            ],
        },
        orderBy: { minVo: "desc" },
    });
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

async function createInstallmentForUser(user: { id: string; role: Role; billingPlan?: any | null }, input: GenerateInstallmentsInput) {
    const existing = await prisma.billingInstallment.findUnique({
        where: { userId_period: { userId: user.id, period: input.period } },
    });

    if (existing) {
        return { status: "SKIPPED_DUPLICATE" as const, userId: user.id };
    }

    let plan = null;
    let voUsed: number | null = null;
    let amount = 0;

    if (user.role === Role.PRODUCTOR) {
        if (!input.sigleaLiterPrice || input.sigleaLiterPrice <= 0) {
            return { status: "SKIPPED_NO_SIGLEA_PRICE" as const, userId: user.id };
        }

        const assignedPlan = user.billingPlan?.isActive
            && user.billingPlan.targetRole === Role.PRODUCTOR
            && user.billingPlan.planType === BillingPlanType.SIGLEA_LITERS
            ? user.billingPlan
            : null;

        voUsed = await getLatestVoForUser(user.id);
        if (assignedPlan) {
            plan = assignedPlan;
        } else {
            if (voUsed === null) {
                return { status: "SKIPPED_NO_VO" as const, userId: user.id };
            }
            plan = await findProducerPlan(voUsed);
        }

        if (!plan || plan.sigleaLiters === null) {
            return { status: "SKIPPED_NO_PLAN" as const, userId: user.id, voUsed };
        }

        amount = Number(plan.sigleaLiters) * input.sigleaLiterPrice;
    }

    if (user.role === Role.EMPRESA) {
        const assignedPlan = user.billingPlan?.isActive
            && user.billingPlan.targetRole === Role.EMPRESA
            && user.billingPlan.planType === BillingPlanType.FIXED_ARS
            ? user.billingPlan
            : null;

        plan = assignedPlan || await findCompanyPlan();
        if (!plan || plan.fixedPrice === null) {
            return { status: "SKIPPED_NO_PLAN" as const, userId: user.id };
        }

        amount = Number(plan.fixedPrice);
    }

    if (!plan) {
        return { status: "SKIPPED_NO_PLAN" as const, userId: user.id };
    }

    try {
        const installment = await prisma.billingInstallment.create({
            data: {
                userId: user.id,
                planId: plan.id,
                period: input.period,
                dueDate: input.dueDate,
                amount,
                sigleaLiterPrice: user.role === Role.PRODUCTOR ? input.sigleaLiterPrice : null,
                voUsed,
                planNameSnapshot: plan.name,
                planTypeSnapshot: plan.planType,
                targetRoleSnapshot: plan.targetRole,
                sigleaLitersSnapshot: plan.sigleaLiters,
                fixedPriceSnapshot: plan.fixedPrice,
            },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, email: true, role: true },
                },
                plan: true,
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

    const result = {
        created: [] as any[],
        skippedDuplicates: [] as string[],
        skippedNoPlan: [] as Array<{ userId: string; voUsed?: number | null }>,
        skippedNoVo: [] as string[],
        skippedNoSigleaPrice: [] as string[],
    };

    for (const user of users) {
        const outcome = await createInstallmentForUser(user, input);
        if (outcome.status === "CREATED") result.created.push(outcome.installment);
        if (outcome.status === "SKIPPED_DUPLICATE") result.skippedDuplicates.push(outcome.userId);
        if (outcome.status === "SKIPPED_NO_PLAN") result.skippedNoPlan.push({ userId: outcome.userId, voUsed: outcome.voUsed ?? null });
        if (outcome.status === "SKIPPED_NO_VO") result.skippedNoVo.push(outcome.userId);
        if (outcome.status === "SKIPPED_NO_SIGLEA_PRICE") result.skippedNoSigleaPrice.push(outcome.userId);
    }

    return {
        ...result,
        summary: {
            created: result.created.length,
            skippedDuplicates: result.skippedDuplicates.length,
            skippedNoPlan: result.skippedNoPlan.length,
            skippedNoVo: result.skippedNoVo.length,
            skippedNoSigleaPrice: result.skippedNoSigleaPrice.length,
        },
    };
}

export async function listBillingInstallments(filters: ListInstallmentsFilters) {
    const dbStatus = filters.status === "OVERDUE" ? BillingInstallmentStatus.PENDING : filters.status;

    const installments = await prisma.billingInstallment.findMany({
        where: {
            ...(filters.period ? { period: filters.period } : {}),
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
        },
        orderBy: [{ period: "desc" }, { dueDate: "asc" }],
    });

    return installments
        .map(serializeInstallment)
        .filter((installment) => !filters.status || installment.effectiveStatus === filters.status);
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
