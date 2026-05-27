import prisma from "../prisma/client.js";

export type DateStatisticInput = {
    tamboId: string;
    startDate: Date;
    endDate: Date;
    vacasElegidas: number;
    vacasEnCelo: number;
    vacasPreniadas: number;
};

async function checkOwnership(tamboId: string, actor?: { id: string; role: string }) {
    if (actor && actor.role === "PRODUCTOR") {
        const tambo = await prisma.tambo.findUnique({ where: { id: tamboId }, select: { userId: true } });
        if (!tambo || tambo.userId !== actor.id) {
            throw { status: 403, message: "No puedes acceder a estadísticas de un tambo ajeno" };
        }
    }
}

function calcular(vacasElegidas: number, vacasEnCelo: number, vacasPreniadas: number) {
    // % de celo de vacas = vacasEnCelo * 100 / vacasElegidas
    const porcentajeCelo = vacasElegidas > 0
        ? (vacasEnCelo * 100) / vacasElegidas
        : 0;

    // % de preñez de vacas = vacasPreniadas * 100 / vacasEnCelo
    const porcentajePreniez = vacasEnCelo > 0
        ? (vacasPreniadas * 100) / vacasEnCelo
        : 0;

    // Tasa de preñez de vacas = vacasPreniadas * 100 / vacasElegidas
    const tasaPreniez = vacasElegidas > 0
        ? (vacasPreniadas * 100) / vacasElegidas
        : 0;

    return { porcentajeCelo, porcentajePreniez, tasaPreniez };
}

export async function upsertDateStatistic(input: DateStatisticInput, actor?: { id: string; role: string }) {
    const { tamboId, startDate, endDate, vacasElegidas, vacasEnCelo, vacasPreniadas } = input;

    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo) throw { status: 404, message: "Tambo no encontrado" };

    await checkOwnership(tamboId, actor);

    const year = new Date(startDate).getUTCFullYear();
    console.log(year)
    const { porcentajeCelo, porcentajePreniez, tasaPreniez } = calcular(vacasElegidas, vacasEnCelo, vacasPreniadas);

    return await prisma.dateStatistic.upsert({
        where: {
            tamboId_startDate_endDate: { tamboId, startDate, endDate }
        },
        update: {
            year,
            vacasElegidas,
            vacasEnCelo,
            vacasPreniadas,
            porcentajeCelo,
            porcentajePreniez,
            tasaPreniez
        },
        create: {
            tamboId,
            startDate,
            endDate,
            year,
            vacasElegidas,
            vacasEnCelo,
            vacasPreniadas,
            porcentajeCelo,
            porcentajePreniez,
            tasaPreniez
        }
    });
}

export async function getDateStatisticsByTambo(tamboId: string, actor?: { id: string; role: string }) {
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo) throw { status: 404, message: "Tambo no encontrado" };

    await checkOwnership(tamboId, actor);

    return await prisma.dateStatistic.findMany({
        where: { tamboId },
        orderBy: { startDate: "desc" }
    });
}

export async function getDateStatisticById(id: string, actor?: { id: string; role: string }) {
    const stat = await prisma.dateStatistic.findUnique({ where: { id } });
    if (!stat) throw { status: 404, message: "Estadística no encontrada" };

    await checkOwnership(stat.tamboId, actor);
    return stat;
}

export async function getAnnualDateStatistics(tamboId: string, year: number, actor?: { id: string; role: string }) {
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo) throw { status: 404, message: "Tambo no encontrado" };

    await checkOwnership(tamboId, actor);

    const aggregates = await prisma.dateStatistic.aggregate({
        where: { tamboId, year },
        _sum: {
            vacasElegidas: true,
            vacasEnCelo: true,
            vacasPreniadas: true
        },
        _count: { id: true }
    });

    const ciclosReportados = aggregates._count.id;
    const totalElegidas = Number(aggregates._sum.vacasElegidas ?? 0);
    const totalEnCelo = Number(aggregates._sum.vacasEnCelo ?? 0);
    const totalPreniadas = Number(aggregates._sum.vacasPreniadas ?? 0);

    // Recalcular sobre los totales anuales (correcto estadisticamente)
    const { porcentajeCelo, porcentajePreniez, tasaPreniez } = calcular(totalElegidas, totalEnCelo, totalPreniadas);

    return {
        year,
        ciclosReportados,
        totales: {
            vacasElegidas: totalElegidas,
            vacasEnCelo: totalEnCelo,
            vacasPreniadas: totalPreniadas
        },
        calculosAnuales: {
            porcentajeCelo: Number(porcentajeCelo.toFixed(2)),
            porcentajePreniez: Number(porcentajePreniez.toFixed(2)),
            tasaPreniez: Number(tasaPreniez.toFixed(2))
        }
    };
}

export type DateStatisticUpdateInput = Partial<Pick<DateStatisticInput, "vacasElegidas" | "vacasEnCelo" | "vacasPreniadas">>;

export async function updateDateStatistic(id: string, data: DateStatisticUpdateInput, actor?: { id: string; role: string }) {
    const existing = await prisma.dateStatistic.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Estadística no encontrada" };

    await checkOwnership(existing.tamboId, actor);

    // Merge existing values with incoming partial update
    const vacasElegidas = data.vacasElegidas !== undefined ? data.vacasElegidas : Number(existing.vacasElegidas);
    const vacasEnCelo = data.vacasEnCelo !== undefined ? data.vacasEnCelo : Number(existing.vacasEnCelo);
    const vacasPreniadas = data.vacasPreniadas !== undefined ? data.vacasPreniadas : Number(existing.vacasPreniadas);

    const { porcentajeCelo, porcentajePreniez, tasaPreniez } = calcular(vacasElegidas, vacasEnCelo, vacasPreniadas);

    return await prisma.dateStatistic.update({
        where: { id },
        data: {
            vacasElegidas,
            vacasEnCelo,
            vacasPreniadas,
            porcentajeCelo,
            porcentajePreniez,
            tasaPreniez
        }
    });
}

export async function deleteDateStatistic(id: string, actor?: { id: string; role: string }) {
    const existing = await prisma.dateStatistic.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Estadística no encontrada" };

    await checkOwnership(existing.tamboId, actor);

    return await prisma.dateStatistic.delete({ where: { id } });
}
