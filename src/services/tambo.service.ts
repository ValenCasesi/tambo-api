import prisma from "../prisma/client.js";
import { Cuenca, TamboSize, TamboSystem } from "@prisma/client";

export type TamboCreateInput = {
    userId: string;
    name: string;
    location: string;
    province: string;
    cuenca: Cuenca;
    size: TamboSize;
    system: TamboSystem;
};

export async function createTambo(data: TamboCreateInput) {
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

export async function getAllTambos(
    actor?: { id: string; role: string },
    filters?: { cuenca?: Cuenca, size?: TamboSize, system?: TamboSystem },
    pagination?: { page: number, limit: number }
) {
    let where: any = actor && actor.role === "PRODUCTOR" ? { userId: actor.id } : {};

    if (filters) {
        if (filters.cuenca) where.cuenca = filters.cuenca;
        if (filters.size) where.size = filters.size;
        if (filters.system) where.system = filters.system;
    }

    const limit = pagination?.limit ? Number(pagination.limit) : undefined;
    const page = pagination?.page ? Number(pagination.page) : 1;
    const skip = limit ? (page - 1) * limit : undefined;

    const total = await prisma.tambo.count({ where });

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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
    });

    return {
        data: tambos,
        meta: {
            total,
            page,
            limit: limit || total,
            totalPages: limit ? Math.ceil(total / limit) : 1
        }
    };
}

export async function getTambosByUser(userId: string) {
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
export type TamboUpdateInput = Partial<Omit<TamboCreateInput, "userId">>;

export async function updateTambo(tamboId: string, data: TamboUpdateInput, actor?: { id: string; role: string }) {
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

export async function deleteTambo(tamboId: string, actor?: { id: string; role: string }) {
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

export async function hardDeleteTambo(tamboId: string, actor?: { id: string; role: string }) {
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
