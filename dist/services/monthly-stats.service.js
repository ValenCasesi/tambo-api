import prisma from "../prisma/client.js";
export async function upsertMonthlyStatistic(input) {
    const { tamboId, period, partosVaquillonas, partosVacas, vacasOrdene, vacasSecas, litrosUsina, litrosDescarte, litrosGuachera, ternerosMuertos, } = input;
    // Check if Tambo exists
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo)
        throw { status: 404, message: "Tambo not found" };
    // Derived fields matching schema 
    const month = parseInt(period.substring(4, 6), 10);
    const year = parseInt(period.substring(0, 4), 10);
    const diasMes = new Date(year, month, 0).getDate(); // Get absolute days for that month
    // Calculations
    const partosTotales = partosVaquillonas + partosVacas;
    const vacasTotales = vacasOrdene + vacasSecas;
    // Prevent Division By Zero
    const promedioLitrosVaca = vacasOrdene > 0
        ? (litrosUsina + litrosDescarte + litrosGuachera) / diasMes / vacasOrdene
        : 0;
    const porcentajeNatimortos = partosTotales > 0
        ? (ternerosMuertos * 100) / partosTotales
        : 0;
    // We use upsert. If a period already exists for this Tambo, we UPDATE the stats to overwrite the old mistake.
    // If it doesn't exist, we CREATE a new entry.
    const result = await prisma.monthlyStatistic.upsert({
        where: {
            tamboId_period: {
                tamboId,
                period,
            }
        },
        update: {
            partosVaquillonas,
            partosVacas,
            vacasOrdene,
            vacasSecas,
            litrosUsina,
            litrosDescarte,
            litrosGuachera,
            ternerosMuertos,
            partosTotales,
            vacasTotales,
            promedioLitrosVaca,
            porcentajeNatimortos
        },
        create: {
            tamboId,
            period,
            month,
            year,
            partosVaquillonas,
            partosVacas,
            vacasOrdene,
            vacasSecas,
            litrosUsina,
            litrosDescarte,
            litrosGuachera,
            ternerosMuertos,
            partosTotales,
            vacasTotales,
            promedioLitrosVaca,
            porcentajeNatimortos
        }
    });
    return result;
}
export async function getAnnualStatistics(tamboId, year) {
    // 1. Validate if Tambo exists
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo)
        throw { status: 404, message: "Tambo not found" };
    // 2. We dynamically aggregate all 12 potential rows for that specific year directly on the Database engine
    const aggregates = await prisma.monthlyStatistic.aggregate({
        where: {
            tamboId,
            year
        },
        _sum: {
            partosVaquillonas: true,
            partosVacas: true,
            partosTotales: true,
            vacasOrdene: true, // Note: summing cows across months might not make sense for BI, usually it's avg, but we provide it just in case
            vacasSecas: true,
            vacasTotales: true,
            litrosUsina: true,
            litrosDescarte: true,
            litrosGuachera: true,
            ternerosMuertos: true
        }
    });
    const sum = aggregates._sum;
    // Fallbacks if no data exists for the year
    const sPartosTotales = Number(sum.partosTotales || 0);
    const sTernerosMuertos = Number(sum.ternerosMuertos || 0);
    const sVacasOrdene = Number(sum.vacasOrdene || 0);
    const sLitrosToques = Number(sum.litrosUsina || 0) + Number(sum.litrosDescarte || 0) + Number(sum.litrosGuachera || 0);
    // Get absolute days in the entire year (handle leap years)
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;
    // 3. Dynamic Complex Year-to-Date Calcs
    const annualPorcentajeNatimortos = sPartosTotales > 0
        ? (sTernerosMuertos * 100) / sPartosTotales
        : 0;
    // Averages across the year require special care
    // For milk per cow, we take the sum of all milk divided by all days divided by average milking cows.
    // Or simpler: Sum(Liters) / 365 / (Sum(Milking Cows) / months_reported)
    // Find how many months were actually reported to compute true averages (e.g. if the producer only loaded January and Feb)
    const monthsReported = await prisma.monthlyStatistic.count({
        where: { tamboId, year }
    });
    const averageVacasOrdeneAnual = monthsReported > 0 ? (sVacasOrdene / monthsReported) : 0;
    const annualPromedioLitrosVaca = averageVacasOrdeneAnual > 0
        ? sLitrosToques / daysInYear / averageVacasOrdeneAnual
        : 0;
    return {
        year,
        monthsReported,
        totals: {
            partosVaquillonas: Number(sum.partosVaquillonas || 0),
            partosVacas: Number(sum.partosVacas || 0),
            partosTotales: sPartosTotales,
            litrosUsina: Number(sum.litrosUsina || 0),
            litrosDescarte: Number(sum.litrosDescarte || 0),
            litrosGuachera: Number(sum.litrosGuachera || 0),
            ternerosMuertos: sTernerosMuertos
        },
        averages: {
            vacasOrdene: averageVacasOrdeneAnual,
            vacasSecas: monthsReported > 0 ? (Number(sum.vacasSecas || 0) / monthsReported) : 0,
            vacasTotales: monthsReported > 0 ? (Number(sum.vacasTotales || 0) / monthsReported) : 0
        },
        computed: {
            porcentajeNatimortos: Number(annualPorcentajeNatimortos.toFixed(2)),
            promedioLitrosVaca: Number(annualPromedioLitrosVaca.toFixed(2))
        }
    };
}
export async function getAllMonthlyStatistics() {
    return await prisma.monthlyStatistic.findMany({
        orderBy: [
            { year: 'desc' },
            { month: 'desc' },
        ],
        include: {
            tambo: {
                select: {
                    id: true,
                    name: true,
                    location: true
                }
            }
        }
    });
}
export async function getMonthlyStatisticsByTambo(tamboId) {
    // Verificar si el tambo existe (opcional, pero buena práctica)
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo)
        throw { status: 404, message: "Tambo not found" };
    return await prisma.monthlyStatistic.findMany({
        where: { tamboId },
        orderBy: [
            { year: 'desc' },
            { month: 'desc' },
        ]
    });
}
export async function updateMonthlyStatistic(id, data) {
    const existing = await prisma.monthlyStatistic.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Estadística mensual no encontrada" };
    const merged = { ...existing, ...data };
    // Casting Prisma Decimal back to Number for calculations
    const partosVaquillonas = Number(merged.partosVaquillonas);
    const partosVacas = Number(merged.partosVacas);
    const vacasOrdene = Number(merged.vacasOrdene);
    const vacasSecas = Number(merged.vacasSecas);
    const litrosUsina = Number(merged.litrosUsina);
    const litrosDescarte = Number(merged.litrosDescarte);
    const litrosGuachera = Number(merged.litrosGuachera);
    const ternerosMuertos = Number(merged.ternerosMuertos);
    const month = existing.month;
    const year = existing.year;
    const diasMes = new Date(year, month, 0).getDate();
    const partosTotales = partosVaquillonas + partosVacas;
    const vacasTotales = vacasOrdene + vacasSecas;
    const promedioLitrosVaca = vacasOrdene > 0
        ? (litrosUsina + litrosDescarte + litrosGuachera) / diasMes / vacasOrdene
        : 0;
    const porcentajeNatimortos = partosTotales > 0
        ? (ternerosMuertos * 100) / partosTotales
        : 0;
    const result = await prisma.monthlyStatistic.update({
        where: { id },
        data: {
            ...data,
            partosTotales,
            vacasTotales,
            promedioLitrosVaca,
            porcentajeNatimortos
        }
    });
    return result;
}
export async function deleteMonthlyStatistic(id) {
    const existing = await prisma.monthlyStatistic.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Estadística mensual no encontrada" };
    return await prisma.monthlyStatistic.delete({
        where: { id }
    });
}
