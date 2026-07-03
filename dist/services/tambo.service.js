import prisma from "../prisma/client.js";
const normalizeSearchText = (value) => (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const splitSearchTokens = (value) => normalizeSearchText(value).split(/\s+/).filter(Boolean);
const getFuzzyThreshold = (length) => {
    if (length <= 2)
        return 0;
    if (length <= 5)
        return 1;
    if (length <= 8)
        return 2;
    return Math.ceil(length * 0.25);
};
const getLevenshteinDistance = (a, b) => {
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array.from({ length: b.length + 1 }, () => 0);
    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + substitutionCost);
        }
        for (let j = 0; j <= b.length; j += 1) {
            previous[j] = current[j];
        }
    }
    return previous[b.length];
};
const scoreTokenMatch = (value, query) => {
    if (value === query)
        return 0;
    if (value.startsWith(query))
        return 1;
    if (value.includes(query))
        return 2;
    const distance = getLevenshteinDistance(value, query);
    return distance <= getFuzzyThreshold(query.length) ? 3 + distance : Number.POSITIVE_INFINITY;
};
const scoreSearchMatch = (value, query) => {
    if (!query)
        return 0;
    if (value === query)
        return 0;
    if (value.startsWith(query))
        return 1;
    if (value.includes(query))
        return 2;
    const valueTokens = splitSearchTokens(value);
    const queryTokens = splitSearchTokens(query);
    if (!valueTokens.length || !queryTokens.length) {
        return Number.POSITIVE_INFINITY;
    }
    let totalScore = 0;
    for (const queryToken of queryTokens) {
        const tokenScore = Math.min(...valueTokens.map((valueToken) => scoreTokenMatch(valueToken, queryToken)));
        if (!Number.isFinite(tokenScore))
            return Number.POSITIVE_INFINITY;
        totalScore += tokenScore;
    }
    return 3 + totalScore / queryTokens.length;
};
export async function createTambo(data) {
    // Verificar si el usuario existe
    const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, role: true }
    });
    if (!user) {
        throw { status: 404, message: "Productor no encontrado" };
    }
    // Asegurar que solo Productores y Admins pueden tener tambos (?)
    // Depende del negocio. Asumiremos PRODUCTOR o ADMIN.
    if (user.role !== "PRODUCTOR" && user.role !== "ADMIN") {
        throw { status: 403, message: "El usuario no tiene rol de Productor" };
    }
    const tambo = await prisma.tambo.create({
        data
    });
    return tambo;
}
export async function getAllTambos(actor, filters, pagination) {
    let where = actor && actor.role === "PRODUCTOR" ? { userId: actor.id } : {};
    if (filters) {
        if (filters.cuenca)
            where.cuenca = filters.cuenca;
        if (filters.size)
            where.size = filters.size;
        if (filters.system)
            where.system = filters.system;
    }
    const limit = pagination?.limit ? Number(pagination.limit) : undefined;
    const page = pagination?.page ? Number(pagination.page) : 1;
    const skip = limit ? (page - 1) * limit : undefined;
    const tambos = await prisma.tambo.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
    const ownerSearch = normalizeSearchText(filters?.ownerSearch);
    const filteredTambos = ownerSearch
        ? tambos
            .map((tambo) => {
            const ownerText = normalizeSearchText([
                tambo.user?.firstName,
                tambo.user?.lastName,
                tambo.user?.email
            ].filter(Boolean).join(" "));
            return {
                tambo,
                ownerText,
                score: scoreSearchMatch(ownerText, ownerSearch)
            };
        })
            .filter(({ score }) => Number.isFinite(score))
            .sort((a, b) => a.score - b.score || b.tambo.createdAt.getTime() - a.tambo.createdAt.getTime())
            .map(({ tambo }) => tambo)
        : tambos;
    const total = filteredTambos.length;
    const paginatedTambos = limit ? filteredTambos.slice(skip, skip + limit) : filteredTambos;
    return {
        data: paginatedTambos,
        meta: {
            total,
            page,
            limit: limit || total,
            totalPages: limit ? Math.ceil(total / limit) : 1
        }
    };
}
export async function getTambosByUser(userId) {
    return await prisma.tambo.findMany({
        where: { userId },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
}
export async function updateTambo(tamboId, data, actor) {
    // Verificar si el tambo existe
    const existingTambo = await prisma.tambo.findUnique({
        where: { id: tamboId }
    });
    if (!existingTambo) {
        throw { status: 404, message: "Tambo no encontrado" };
    }
    if (actor && actor.role === "PRODUCTOR" && existingTambo.userId !== actor.id) {
        throw { status: 403, message: "No puedes modificar tambos que no te pertenecen" };
    }
    // Actualizar tambo
    const tambo = await prisma.tambo.update({
        where: { id: tamboId },
        data
    });
    return tambo;
}
export async function deleteTambo(tamboId, actor) {
    // Verificar si el tambo existe
    const existingTambo = await prisma.tambo.findUnique({
        where: { id: tamboId }
    });
    if (!existingTambo) {
        throw { status: 404, message: "Tambo no encontrado" };
    }
    if (actor && actor.role === "PRODUCTOR" && existingTambo.userId !== actor.id) {
        throw { status: 403, message: "No puedes eliminar tambos que no te pertenecen" };
    }
    // Baja lógica
    const tambo = await prisma.tambo.update({
        where: { id: tamboId },
        data: { status: "DELETED" }
    });
    return tambo;
}
export async function hardDeleteTambo(tamboId, actor) {
    // Verificar si el tambo existe
    const existingTambo = await prisma.tambo.findUnique({
        where: { id: tamboId }
    });
    if (!existingTambo) {
        throw { status: 404, message: "Tambo no encontrado" };
    }
    if (actor && actor.role === "PRODUCTOR" && existingTambo.userId !== actor.id) {
        throw { status: 403, message: "No puedes eliminar tambos que no te pertenecen" };
    }
    // Borrar estadísticas asociadas (no hay cascade delete en schema)
    await prisma.monthlyStatistic.deleteMany({
        where: { tamboId }
    });
    await prisma.dateStatistic.deleteMany({
        where: { tamboId }
    });
    // Borrado físico
    const tambo = await prisma.tambo.delete({
        where: { id: tamboId }
    });
    return tambo;
}
