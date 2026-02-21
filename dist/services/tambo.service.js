import prisma from "../prisma/client.js";
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
export async function getAllTambos() {
    return await prisma.tambo.findMany({
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
export async function updateTambo(tamboId, data) {
    // Verificar si el tambo existe
    const existingTambo = await prisma.tambo.findUnique({
        where: { id: tamboId }
    });
    if (!existingTambo) {
        throw { status: 404, message: "Tambo no encontrado" };
    }
    // Actualizar tambo
    const tambo = await prisma.tambo.update({
        where: { id: tamboId },
        data
    });
    return tambo;
}
export async function deleteTambo(tamboId) {
    // Verificar si el tambo existe
    const existingTambo = await prisma.tambo.findUnique({
        where: { id: tamboId }
    });
    if (!existingTambo) {
        throw { status: 404, message: "Tambo no encontrado" };
    }
    // Baja lógica
    const tambo = await prisma.tambo.update({
        where: { id: tamboId },
        data: { status: "DELETED" }
    });
    return tambo;
}
