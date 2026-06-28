import { Role } from "@prisma/client";
import prisma from "../prisma/client.js";
import { hashPassword } from "./auth.service.js";
import { sendMail, buildHtmlTemplate } from "./email.service.js";

type CreateUserInput = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: Role | string;
    phone?: string | null;
    cuit?: string | null;
    razonSocial?: string | null;
    localidad?: string | null;
    imageUrl?: string | null;
    billingPlanId?: string | null;
};

type UserFilters = {
    status?: string;
    search?: string;
    localidad?: string;
};

const normalizeSearchText = (value?: string | null) =>
    (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

const splitSearchTokens = (value?: string | null) =>
    normalizeSearchText(value).split(/\s+/).filter(Boolean);

const getFuzzyThreshold = (length: number) => {
    if (length <= 2) return 0;
    if (length <= 5) return 1;
    if (length <= 8) return 2;
    return Math.ceil(length * 0.25);
};

const getLevenshteinDistance = (a: string, b: string) => {
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array.from({ length: b.length + 1 }, () => 0);

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;

        for (let j = 1; j <= b.length; j += 1) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + substitutionCost
            );
        }

        for (let j = 0; j <= b.length; j += 1) {
            previous[j] = current[j];
        }
    }

    return previous[b.length];
};

const scoreTokenMatch = (value: string, query: string) => {
    if (value === query) return 0;
    if (value.startsWith(query)) return 1;
    if (value.includes(query)) return 2;

    const distance = getLevenshteinDistance(value, query);
    return distance <= getFuzzyThreshold(query.length) ? 3 + distance : Number.POSITIVE_INFINITY;
};

const scoreSearchMatch = (value: string, query: string) => {
    if (!query) return 0;
    if (value === query) return 0;
    if (value.startsWith(query)) return 1;
    if (value.includes(query)) return 2;

    const valueTokens = splitSearchTokens(value);
    const queryTokens = splitSearchTokens(query);

    if (!valueTokens.length || !queryTokens.length) {
        return Number.POSITIVE_INFINITY;
    }

    let totalScore = 0;
    for (const queryToken of queryTokens) {
        const tokenScore = Math.min(...valueTokens.map((valueToken) => scoreTokenMatch(valueToken, queryToken)));
        if (!Number.isFinite(tokenScore)) return Number.POSITIVE_INFINITY;
        totalScore += tokenScore;
    }

    return 3 + totalScore / queryTokens.length;
};

export async function createUser(input: CreateUserInput) {
    const { email, cuit, razonSocial, localidad, password, role = "PRODUCTOR", firstName, lastName, phone, imageUrl, billingPlanId } = input;

    // check email uniqueness
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) throw { status: 409, message: "Email already in use" };

    // check cuit uniqueness if provided
    if (cuit) {
        const existingByCuit = await prisma.user.findUnique({ where: { cuit } });
        if (existingByCuit) throw { status: 409, message: "CUIT already in use" };
    }

    const hashed = await hashPassword(password);
    const safeBillingPlanId = await validateBillingPlanForUser(role as Role, billingPlanId);

    // Asignar PENDING por defecto a Productores o Empresas
    const isPending = role === "PRODUCTOR" || role === "EMPRESA";

    const created = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: hashed,
            role: role as Role,
            phone,
            cuit,
            razonSocial,
            localidad,
            imageUrl,
            billingPlanId: safeBillingPlanId,
            status: isPending ? "PENDING" : "ACTIVE"
        },
    });

    if (isPending) {
        const adminDest = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        sendMail(
            adminDest as string,
            "Nueva Solicitud de Registro - Sinergia Plataforma",
            `Hola Admin,\n\nUn nuevo usuario acaba de registrarse y espera tu aprobación para ingresar.\n\nNombre: ${firstName} ${lastName}\nRol: ${role}\nEmail: ${email}\n\nIngresá al panel administrativo para aprobarlo.\n`,
            buildHtmlTemplate({
                title: "Nueva Solicitud de Registro",
                messageLines: [
                    "Hola Admin,",
                    "Un nuevo usuario acaba de registrarse y espera tu aprobación para ingresar.",
                    `<b>Nombre y Apellido:</b> ${firstName} ${lastName}`,
                    `<b>Razón Social:</b> ${razonSocial || "No especificada"}`,
                    `<b>Localidad:</b> ${localidad || "No especificada"}`,
                    `<b>Rol:</b> ${role}`,
                    `<b>Email:</b> ${email}`,
                    `<b>CUIT:</b> ${cuit}`,
                    "Ingresa al panel administrativo para revisar la solicitud y aprobarla."
                ],
                buttonText: "Ir al Panel de Administración",
                buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
            })
        ).catch(err => console.error("Error firing admin register check email:", err));
    }

    // remove password from returned object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = created;
    return safe;
}

type UpdateUserInput = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    role?: Role | string;
    phone?: string | null;
    cuit?: string | null;
    razonSocial?: string | null;
    localidad?: string | null;
    imageUrl?: string | null;
    billingPlanId?: string | null;
};

export async function updateUser(input: UpdateUserInput) {
    const { id, email, cuit, razonSocial, localidad, password, role, firstName, lastName, phone, imageUrl, billingPlanId } = input;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "User not found" };

    if (email && email !== existing.email) {
        const existingByEmail = await prisma.user.findUnique({ where: { email } });
        if (existingByEmail) throw { status: 409, message: "Email already in use" };
    }

    if (cuit && cuit !== existing.cuit) {
        const existingByCuit = await prisma.user.findUnique({ where: { cuit } });
        if (existingByCuit) throw { status: 409, message: "CUIT already in use" };
    }

    let hashed;
    if (password) {
        hashed = await hashPassword(password);
    }

    const nextRole = (role || existing.role) as Role;
    const billingPlanUpdate = billingPlanId !== undefined
        ? { billingPlanId: await validateBillingPlanForUser(nextRole, billingPlanId) }
        : role && role !== existing.role
            ? { billingPlanId: null }
            : {};

    const updated = await prisma.user.update({
        where: { id },
        data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(email && { email }),
            ...(phone !== undefined && { phone }),
            ...(cuit !== undefined && { cuit }),
            ...(razonSocial !== undefined && { razonSocial }),
            ...(localidad !== undefined && { localidad }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(role && { role: role as Role }),
            ...(hashed && { password: hashed }),
            ...billingPlanUpdate,
        },
        include: {
            billingPlan: true
        }
    });

    // remove password from returned object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = updated;
    return safe;
}

export async function getAllUsers(filters: UserFilters = {}) {
    const { status: statusFilter, search, localidad } = filters;
    const whereClause: any = {};
    
    if (statusFilter) {
        whereClause.status = statusFilter;
    } else {
        whereClause.status = { not: "PENDING" }; // Default
    }

    const users = await prisma.user.findMany({
        where: whereClause,
        include: {
            billingPlan: true,
            _count: {
                select: { tambos: true }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    const normalizedSearch = normalizeSearchText(search);
    const normalizedLocalidad = normalizeSearchText(localidad);

    const filteredUsers = users
        .map((u) => {
            const searchableText = normalizeSearchText([
                u.firstName,
                u.lastName,
                u.email,
                u.cuit
            ].filter(Boolean).join(" "));
            const localidadText = normalizeSearchText(u.localidad);

            return {
                user: u,
                searchScore: scoreSearchMatch(searchableText, normalizedSearch),
                localidadScore: scoreSearchMatch(localidadText, normalizedLocalidad)
            };
        })
        .filter(({ searchScore, localidadScore }) => Number.isFinite(searchScore) && Number.isFinite(localidadScore))
        .sort((a, b) => {
            if (!normalizedSearch && !normalizedLocalidad) {
                return b.user.createdAt.getTime() - a.user.createdAt.getTime();
            }

            return a.searchScore - b.searchScore
                || a.localidadScore - b.localidadScore
                || b.user.createdAt.getTime() - a.user.createdAt.getTime();
        })
        .map(({ user }) => user);

    return filteredUsers.map((u) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pwd, ...safe } = u;
        return safe;
    });
}

async function validateBillingPlanForUser(role: Role, billingPlanId?: string | null) {
    if (!billingPlanId || role === "ADMIN") return null;

    const plan = await prisma.billingPlan.findUnique({ where: { id: billingPlanId } });
    if (!plan) throw { status: 404, message: "Plan no encontrado" };
    if (!plan.isActive) throw { status: 400, message: "El plan seleccionado está inactivo" };
    if (plan.targetRole !== role) throw { status: 400, message: "El plan seleccionado no corresponde al rol del usuario" };

    return plan.id;
}

export async function getUserTambos(userId: string) {
    const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
    });
    if (!existing) throw { status: 404, message: "User not found" };

    return await prisma.tambo.findMany({
        where: { userId },
        select: {
            id: true,
            name: true,
            location: true,
            province: true,
            cuenca: true
        },
        orderBy: { createdAt: "desc" }
    });
}

export async function getPendingUsers() {
    const users = await prisma.user.findMany({
        where: {
            status: "PENDING"
        }
    });

    return users.map((u) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pwd, ...safe } = u;
        return safe;
    });
}

export async function approveUser(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "User not found" };
    if (existing.status !== "PENDING") throw { status: 400, message: "User is not in PENDING status" };

    const approved = await prisma.user.update({
        where: { id },
        data: { status: "ACTIVE" }
    });

    sendMail(
        existing.email,
        "¡Bienvenido! Tu cuenta ha sido activada - Sinergia Plataforma",
        `Hola ${existing.firstName},\n\nTenemos el agrado de informarte que el administrador validó tus datos y tu cuenta registrada como ${existing.role} ya se encuentra ACTIVA.\n\nPodés ingresar a la plataforma con las credenciales que creaste.\n\nSaludos,\nEl equipo de Sinergia.`,
        buildHtmlTemplate({
            title: "¡Tu cuenta ha sido activada!",
            messageLines: [
                `Hola ${existing.firstName},`,
                `Tenemos el agrado de informarte que el administrador validó tus datos y tu cuenta registrada como <b>${existing.role}</b> ya se encuentra ACTIVA.`,
                "Ya puedes ingresar a la plataforma con las credenciales que creaste."
            ],
            buttonText: "Iniciar Sesión",
            buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
        })
    ).catch(err => console.error("Error firing approved user email:", err));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = approved;
    return safe;
}

export async function rejectUser(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "User not found" };
    if (existing.status !== "PENDING") throw { status: 400, message: "Solo se pueden rechazar usuarios en estado PENDING" };

    // Procedemos a eliminar físicamente al usuario para que pueda volver a intentar registrarse
    const rejected = await prisma.user.delete({
        where: { id }
    });

    sendMail(
        existing.email,
        "Solicitud de Alta Rechazada - Sinergia Plataforma",
        `Hola ${existing.firstName},\n\nTe informamos que el administrador revisó tu solicitud de registro y determinó que no cumple con los requisitos necesarios para ingresar a la plataforma en este momento.\n\nPor favor, verificá tus datos o ponete en contacto con la administración.\n\nSaludos,\nEl equipo de Sinergia.`,
        buildHtmlTemplate({
            title: "Solicitud de Alta Rechazada",
            messageLines: [
                `Hola ${existing.firstName},`,
                "Te informamos que el administrador revisó tu solicitud de registro y determinó que no cumple con los requisitos necesarios para ingresar a la plataforma en este momento.",
                "Por favor, revisa tus datos de contacto o comunícate directamente con la administración."
            ],
            buttonText: "Ir a Sinergia",
            buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
        })
    ).catch(err => console.error("Error firing rejected user email:", err));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = rejected;
    return safe;
}

export async function deleteUser(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "User not found" };
    if (existing.status === "DELETED") throw { status: 400, message: "User is already deleted" };

    // Realizamos un borrado lógico (soft-delete) modificando el status 
    // para evitar errores de Foreign Key Constraint con tablas relacionadas (Tambos, Foros, etc)
    const deleted = await prisma.user.update({
        where: { id },
        data: { status: "DELETED" }
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = deleted;
    return safe;
}

export async function reactivateUser(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "User not found" };
    if (existing.status === "ACTIVE") throw { status: 400, message: "User is already active" };

    const reactivated = await prisma.user.update({
        where: { id },
        data: { status: "ACTIVE" }
    });

    sendMail(
        reactivated.email,
        "¡Tu cuenta ha sido reactivada! - Sinergia Plataforma",
        `Hola ${reactivated.firstName},\n\nTe informamos que el administrador ha rehabilitado el acceso a tu cuenta.\n\nYa podés ingresar nuevamente a la plataforma con tus credenciales habituales.\n\nSaludos,\nEl equipo de Sinergia.`,
        buildHtmlTemplate({
            title: "¡Tu cuenta ha sido reactivada!",
            messageLines: [
                `Hola ${reactivated.firstName},`,
                "Te informamos que el administrador ha rehabilitado el acceso a tu cuenta. Se han restaurado todos tus permisos.",
                "Ya puedes ingresar nuevamente a la plataforma utilizando tus credenciales habituales."
            ],
            buttonText: "Iniciar Sesión",
            buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
        })
    ).catch(err => console.error("Error firing reactivated user email:", err));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = reactivated;
    return safe;
}
