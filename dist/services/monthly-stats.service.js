import prisma from "../prisma/client.js";
// ==========================================
// SYNC YEARLY PROJECTIONS HELPER
// ==========================================
async function syncYearlyProjections(tamboId, year) {
    // Traverse all months of this year for this tambo to calculate accumulatives
    const months = await prisma.monthlyStatistic.findMany({
        where: { tamboId, year },
        orderBy: { month: "asc" }
    });
    let sumPartosTotales = 0;
    let sumTernerosMuertosPeriparto = 0;
    let sumTotalTernerosNacidosVivos = 0;
    let sumTotalTernerosMuertos = 0;
    let sumCantTernerasHembrasIngRecria = 0;
    let sumCantHembrasRecriaHastaServMuertas = 0;
    for (const record of months) {
        // We accumulate only what is present
        sumPartosTotales += Number(record.partosTotales || 0);
        sumTernerosMuertosPeriparto += Number(record.ternerosMuertosPeriparto || 0);
        sumTotalTernerosNacidosVivos += Number(record.totalTernerosNacidosVivos || 0);
        sumTotalTernerosMuertos += Number(record.totalTernerosMuertos || 0);
        sumCantTernerasHembrasIngRecria += Number(record.cantTernerasHembrasIngRecria || 0);
        sumCantHembrasRecriaHastaServMuertas += Number(record.cantHembrasRecriaHastaServMuertas || 0);
        // Compute running YTD formulas
        let proyeccionAnualNatimortos = null;
        if (sumPartosTotales > 0 && record.ternerosMuertosPeriparto != null) {
            proyeccionAnualNatimortos = (sumTernerosMuertosPeriparto * 100) / sumPartosTotales;
        }
        let proyeccionAnualTernerosMuertosGuachera = null;
        if (sumTotalTernerosNacidosVivos > 0 && record.totalTernerosMuertos != null) {
            proyeccionAnualTernerosMuertosGuachera = (sumTotalTernerosMuertos * 100) / sumTotalTernerosNacidosVivos;
        }
        let proyeccionAnualMortandadRecria = null;
        if (sumCantTernerasHembrasIngRecria > 0 && record.cantHembrasRecriaHastaServMuertas != null) {
            proyeccionAnualMortandadRecria = (sumCantHembrasRecriaHastaServMuertas * 100) / sumCantTernerasHembrasIngRecria;
        }
        // Only update these fields
        await prisma.monthlyStatistic.update({
            where: { id: record.id },
            data: {
                proyeccionAnualNatimortos,
                proyeccionAnualTernerosMuertosGuachera,
                proyeccionAnualMortandadRecria
            }
        });
    }
}
export async function upsertMonthlyStatistic(input) {
    const { tamboId, period, partosVaquillonas, partosVacas, vacasOrdene, vacasSecas, litrosUsina, litrosDescarte, litrosGuachera, ternerosMuertosPeriparto, ternerosMachosNacidosVivos, ternerasHembrasNacidasVivas, cantNacimientosMellizos, ternerosMachosMuertosGuachera, ternerasHembrasMuertasGuachera, cantTernerasHembrasIngRecria, cantHembrasRecriaHastaServMuertas } = input;
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo)
        throw { status: 404, message: "Tambo not found" };
    const month = parseInt(period.substring(4, 6), 10);
    const year = parseInt(period.substring(0, 4), 10);
    const diasMes = new Date(year, month, 0).getDate();
    const existing = await prisma.monthlyStatistic.findUnique({
        where: { tamboId_period: { tamboId, period } }
    });
    const vPartosVaquillonas = input.partosVaquillonas !== undefined ? input.partosVaquillonas : (existing ? Number(existing.partosVaquillonas) : 0);
    const vPartosVacas = input.partosVacas !== undefined ? input.partosVacas : (existing ? Number(existing.partosVacas) : 0);
    const vVacasOrdene = input.vacasOrdene !== undefined ? input.vacasOrdene : (existing ? Number(existing.vacasOrdene) : 0);
    const vVacasSecas = input.vacasSecas !== undefined ? input.vacasSecas : (existing ? Number(existing.vacasSecas) : 0);
    const vLitrosUsina = input.litrosUsina !== undefined ? input.litrosUsina : (existing ? Number(existing.litrosUsina) : 0);
    const vLitrosDescarte = input.litrosDescarte !== undefined ? input.litrosDescarte : (existing ? Number(existing.litrosDescarte) : 0);
    const vLitrosGuachera = input.litrosGuachera !== undefined ? input.litrosGuachera : (existing ? Number(existing.litrosGuachera) : 0);
    const vTernerosMuertosPeriparto = input.ternerosMuertosPeriparto !== undefined ? input.ternerosMuertosPeriparto : (existing && existing.ternerosMuertosPeriparto != null ? Number(existing.ternerosMuertosPeriparto) : null);
    const vTernerosMachosNacidosVivos = input.ternerosMachosNacidosVivos !== undefined ? input.ternerosMachosNacidosVivos : (existing && existing.ternerosMachosNacidosVivos != null ? Number(existing.ternerosMachosNacidosVivos) : null);
    const vTernerasHembrasNacidasVivas = input.ternerasHembrasNacidasVivas !== undefined ? input.ternerasHembrasNacidasVivas : (existing && existing.ternerasHembrasNacidasVivas != null ? Number(existing.ternerasHembrasNacidasVivas) : null);
    const vCantNacimientosMellizos = input.cantNacimientosMellizos !== undefined ? input.cantNacimientosMellizos : (existing && existing.cantNacimientosMellizos != null ? Number(existing.cantNacimientosMellizos) : null);
    const vTernerosMachosMuertosGuachera = input.ternerosMachosMuertosGuachera !== undefined ? input.ternerosMachosMuertosGuachera : (existing && existing.ternerosMachosMuertosGuachera != null ? Number(existing.ternerosMachosMuertosGuachera) : null);
    const vTernerasHembrasMuertasGuachera = input.ternerasHembrasMuertasGuachera !== undefined ? input.ternerasHembrasMuertasGuachera : (existing && existing.ternerasHembrasMuertasGuachera != null ? Number(existing.ternerasHembrasMuertasGuachera) : null);
    const vCantTernerasHembrasIngRecria = input.cantTernerasHembrasIngRecria !== undefined ? input.cantTernerasHembrasIngRecria : (existing && existing.cantTernerasHembrasIngRecria != null ? Number(existing.cantTernerasHembrasIngRecria) : null);
    const vCantHembrasRecriaHastaServMuertas = input.cantHembrasRecriaHastaServMuertas !== undefined ? input.cantHembrasRecriaHastaServMuertas : (existing && existing.cantHembrasRecriaHastaServMuertas != null ? Number(existing.cantHembrasRecriaHastaServMuertas) : null);
    // Base Calculations
    const partosTotales = vPartosVaquillonas + vPartosVacas;
    const vacasTotales = vVacasOrdene + vVacasSecas;
    const promedioLitrosVaca = vVacasOrdene > 0
        ? (vLitrosUsina + vLitrosDescarte + vLitrosGuachera) / diasMes / vVacasOrdene
        : 0;
    // Optional Fields Calculations
    let totalTernerosNacidosVivos = null;
    if (vTernerosMachosNacidosVivos != null && vTernerasHembrasNacidasVivas != null) {
        totalTernerosNacidosVivos = vTernerosMachosNacidosVivos + vTernerasHembrasNacidasVivas;
    }
    let porcentajeNatimortos = null;
    if (vTernerosMuertosPeriparto != null && partosTotales > 0) {
        porcentajeNatimortos = (vTernerosMuertosPeriparto * 100) / partosTotales;
    }
    let totalTernerosMuertos = null;
    if (vTernerosMachosMuertosGuachera != null && vTernerasHembrasMuertasGuachera != null) {
        totalTernerosMuertos = vTernerosMachosMuertosGuachera + vTernerasHembrasMuertasGuachera;
    }
    let porcentajeTernerosMuertosGuacheraMes = null;
    if (totalTernerosNacidosVivos != null && totalTernerosNacidosVivos > 0 && totalTernerosMuertos != null) {
        porcentajeTernerosMuertosGuacheraMes = (totalTernerosMuertos * 100) / totalTernerosNacidosVivos;
    }
    let porcentajeMortandadRecriaMes = null;
    if (vCantTernerasHembrasIngRecria != null && vCantTernerasHembrasIngRecria > 0 && vCantHembrasRecriaHastaServMuertas != null) {
        porcentajeMortandadRecriaMes = (vCantHembrasRecriaHastaServMuertas * 100) / vCantTernerasHembrasIngRecria;
    }
    const dataPayload = {
        partosVaquillonas: vPartosVaquillonas, partosVacas: vPartosVacas, vacasOrdene: vVacasOrdene, vacasSecas: vVacasSecas,
        litrosUsina: vLitrosUsina, litrosDescarte: vLitrosDescarte, litrosGuachera: vLitrosGuachera,
        ternerosMuertosPeriparto: vTernerosMuertosPeriparto, ternerosMachosNacidosVivos: vTernerosMachosNacidosVivos, ternerasHembrasNacidasVivas: vTernerasHembrasNacidasVivas,
        cantNacimientosMellizos: vCantNacimientosMellizos, ternerosMachosMuertosGuachera: vTernerosMachosMuertosGuachera, ternerasHembrasMuertasGuachera: vTernerasHembrasMuertasGuachera,
        cantTernerasHembrasIngRecria: vCantTernerasHembrasIngRecria, cantHembrasRecriaHastaServMuertas: vCantHembrasRecriaHastaServMuertas,
        partosTotales, vacasTotales, promedioLitrosVaca,
        porcentajeNatimortos, totalTernerosNacidosVivos, totalTernerosMuertos,
        porcentajeTernerosMuertosGuacheraMes, porcentajeMortandadRecriaMes
    };
    let result;
    if (existing) {
        result = await prisma.monthlyStatistic.update({
            where: { id: existing.id },
            data: dataPayload
        });
    }
    else {
        result = await prisma.monthlyStatistic.create({
            data: {
                tamboId,
                period,
                month,
                year,
                ...dataPayload
            }
        });
    }
    await syncYearlyProjections(tamboId, year);
    return result;
}
export async function getAnnualStatistics(tamboId, year) {
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo)
        throw { status: 404, message: "Tambo not found" };
    const aggregates = await prisma.monthlyStatistic.aggregate({
        where: { tamboId, year },
        _sum: {
            partosVaquillonas: true,
            partosVacas: true,
            partosTotales: true,
            vacasOrdene: true,
            vacasSecas: true,
            vacasTotales: true,
            litrosUsina: true,
            litrosDescarte: true,
            litrosGuachera: true,
            ternerosMuertosPeriparto: true,
            totalTernerosNacidosVivos: true,
            totalTernerosMuertos: true,
            cantTernerasHembrasIngRecria: true,
            cantHembrasRecriaHastaServMuertas: true
        }
    });
    const sum = aggregates._sum;
    const sPartosTotales = Number(sum.partosTotales || 0);
    const sTernerosMuertosPeriparto = Number(sum.ternerosMuertosPeriparto || 0);
    const sVacasOrdene = Number(sum.vacasOrdene || 0);
    const sLitrosToques = Number(sum.litrosUsina || 0) + Number(sum.litrosDescarte || 0) + Number(sum.litrosGuachera || 0);
    const sTotalTernerosNacidosVivos = Number(sum.totalTernerosNacidosVivos || 0);
    const sTotalTernerosMuertos = Number(sum.totalTernerosMuertos || 0);
    const sCantTernerasHembrasIngRecria = Number(sum.cantTernerasHembrasIngRecria || 0);
    const sCantHembrasRecriaHastaServMuertas = Number(sum.cantHembrasRecriaHastaServMuertas || 0);
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;
    // Dynamic Complex Year-to-Date Calcs for the whole year combined
    let annualPorcentajeNatimortos = null;
    if (sPartosTotales > 0) {
        annualPorcentajeNatimortos = (sTernerosMuertosPeriparto * 100) / sPartosTotales;
    }
    let annualProyeccionTernerosMuertosGuachera = null;
    if (sTotalTernerosNacidosVivos > 0) {
        annualProyeccionTernerosMuertosGuachera = (sTotalTernerosMuertos * 100) / sTotalTernerosNacidosVivos;
    }
    let annualProyeccionMortandadRecria = null;
    if (sCantTernerasHembrasIngRecria > 0) {
        annualProyeccionMortandadRecria = (sCantHembrasRecriaHastaServMuertas * 100) / sCantTernerasHembrasIngRecria;
    }
    const monthsReported = await prisma.monthlyStatistic.count({
        where: { tamboId, year }
    });
    const averageVacasOrdeneAnual = monthsReported > 0 ? (sVacasOrdene / monthsReported) : 0;
    const annualPromedioLitrosVaca = averageVacasOrdeneAnual > 0 ? sLitrosToques / daysInYear / averageVacasOrdeneAnual : 0;
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
            ternerosMuertosPeriparto: sTernerosMuertosPeriparto,
            totalTernerosNacidosVivos: sTotalTernerosNacidosVivos,
            totalTernerosMuertos: sTotalTernerosMuertos,
            cantTernerasHembrasIngRecria: sCantTernerasHembrasIngRecria,
            cantHembrasRecriaHastaServMuertas: sCantHembrasRecriaHastaServMuertas
        },
        averages: {
            vacasOrdene: averageVacasOrdeneAnual,
            vacasSecas: monthsReported > 0 ? (Number(sum.vacasSecas || 0) / monthsReported) : 0,
            vacasTotales: monthsReported > 0 ? (Number(sum.vacasTotales || 0) / monthsReported) : 0
        },
        computed: {
            porcentajeNatimortos: annualPorcentajeNatimortos !== null ? Number(annualPorcentajeNatimortos.toFixed(2)) : null,
            promedioLitrosVaca: Number(annualPromedioLitrosVaca.toFixed(2)),
            proyeccionAnualTernerosMuertosGuachera: annualProyeccionTernerosMuertosGuachera !== null ? Number(annualProyeccionTernerosMuertosGuachera.toFixed(2)) : null,
            proyeccionAnualMortandadRecria: annualProyeccionMortandadRecria !== null ? Number(annualProyeccionMortandadRecria.toFixed(2)) : null
        }
    };
}
export async function getAllMonthlyStatistics() {
    return await prisma.monthlyStatistic.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { tambo: { select: { id: true, name: true, location: true } } }
    });
}
export async function getMonthlyStatisticsByTambo(tamboId) {
    const tambo = await prisma.tambo.findUnique({ where: { id: tamboId } });
    if (!tambo)
        throw { status: 404, message: "Tambo not found" };
    return await prisma.monthlyStatistic.findMany({
        where: { tamboId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
}
export async function updateMonthlyStatistic(id, data) {
    const existing = await prisma.monthlyStatistic.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Estadística mensual no encontrada" };
    const merged = { ...existing, ...data };
    const partosVaquillonas = Number(merged.partosVaquillonas);
    const partosVacas = Number(merged.partosVacas);
    const vacasOrdene = Number(merged.vacasOrdene);
    const vacasSecas = Number(merged.vacasSecas);
    const litrosUsina = Number(merged.litrosUsina);
    const litrosDescarte = Number(merged.litrosDescarte);
    const litrosGuachera = Number(merged.litrosGuachera);
    const ternerosMuertosPeriparto = merged.ternerosMuertosPeriparto != null ? Number(merged.ternerosMuertosPeriparto) : null;
    const ternerosMachosNacidosVivos = merged.ternerosMachosNacidosVivos != null ? Number(merged.ternerosMachosNacidosVivos) : null;
    const ternerasHembrasNacidasVivas = merged.ternerasHembrasNacidasVivas != null ? Number(merged.ternerasHembrasNacidasVivas) : null;
    const cantNacimientosMellizos = merged.cantNacimientosMellizos != null ? Number(merged.cantNacimientosMellizos) : null;
    const ternerosMachosMuertosGuachera = merged.ternerosMachosMuertosGuachera != null ? Number(merged.ternerosMachosMuertosGuachera) : null;
    const ternerasHembrasMuertasGuachera = merged.ternerasHembrasMuertasGuachera != null ? Number(merged.ternerasHembrasMuertasGuachera) : null;
    const cantTernerasHembrasIngRecria = merged.cantTernerasHembrasIngRecria != null ? Number(merged.cantTernerasHembrasIngRecria) : null;
    const cantHembrasRecriaHastaServMuertas = merged.cantHembrasRecriaHastaServMuertas != null ? Number(merged.cantHembrasRecriaHastaServMuertas) : null;
    const month = existing.month;
    const year = existing.year;
    const diasMes = new Date(year, month, 0).getDate();
    const partosTotales = partosVaquillonas + partosVacas;
    const vacasTotales = vacasOrdene + vacasSecas;
    const promedioLitrosVaca = vacasOrdene > 0
        ? (litrosUsina + litrosDescarte + litrosGuachera) / diasMes / vacasOrdene
        : 0;
    let totalTernerosNacidosVivos = null;
    if (ternerosMachosNacidosVivos != null && ternerasHembrasNacidasVivas != null) {
        totalTernerosNacidosVivos = ternerosMachosNacidosVivos + ternerasHembrasNacidasVivas;
    }
    let porcentajeNatimortos = null;
    if (ternerosMuertosPeriparto != null && partosTotales > 0) {
        porcentajeNatimortos = (ternerosMuertosPeriparto * 100) / partosTotales;
    }
    let totalTernerosMuertos = null;
    if (ternerosMachosMuertosGuachera != null && ternerasHembrasMuertasGuachera != null) {
        totalTernerosMuertos = ternerosMachosMuertosGuachera + ternerasHembrasMuertasGuachera;
    }
    let porcentajeTernerosMuertosGuacheraMes = null;
    if (totalTernerosNacidosVivos != null && totalTernerosNacidosVivos > 0 && totalTernerosMuertos != null) {
        porcentajeTernerosMuertosGuacheraMes = (totalTernerosMuertos * 100) / totalTernerosNacidosVivos;
    }
    let porcentajeMortandadRecriaMes = null;
    if (cantTernerasHembrasIngRecria != null && cantTernerasHembrasIngRecria > 0 && cantHembrasRecriaHastaServMuertas != null) {
        porcentajeMortandadRecriaMes = (cantHembrasRecriaHastaServMuertas * 100) / cantTernerasHembrasIngRecria;
    }
    const result = await prisma.monthlyStatistic.update({
        where: { id },
        data: {
            ...data,
            ternerosMuertosPeriparto: data.ternerosMuertosPeriparto !== undefined ? data.ternerosMuertosPeriparto : existing.ternerosMuertosPeriparto,
            ternerosMachosNacidosVivos: data.ternerosMachosNacidosVivos !== undefined ? data.ternerosMachosNacidosVivos : existing.ternerosMachosNacidosVivos,
            ternerasHembrasNacidasVivas: data.ternerasHembrasNacidasVivas !== undefined ? data.ternerasHembrasNacidasVivas : existing.ternerasHembrasNacidasVivas,
            cantNacimientosMellizos: data.cantNacimientosMellizos !== undefined ? data.cantNacimientosMellizos : existing.cantNacimientosMellizos,
            ternerosMachosMuertosGuachera: data.ternerosMachosMuertosGuachera !== undefined ? data.ternerosMachosMuertosGuachera : existing.ternerosMachosMuertosGuachera,
            ternerasHembrasMuertasGuachera: data.ternerasHembrasMuertasGuachera !== undefined ? data.ternerasHembrasMuertasGuachera : existing.ternerasHembrasMuertasGuachera,
            cantTernerasHembrasIngRecria: data.cantTernerasHembrasIngRecria !== undefined ? data.cantTernerasHembrasIngRecria : existing.cantTernerasHembrasIngRecria,
            cantHembrasRecriaHastaServMuertas: data.cantHembrasRecriaHastaServMuertas !== undefined ? data.cantHembrasRecriaHastaServMuertas : existing.cantHembrasRecriaHastaServMuertas,
            partosTotales,
            vacasTotales,
            promedioLitrosVaca,
            porcentajeNatimortos,
            totalTernerosNacidosVivos,
            totalTernerosMuertos,
            porcentajeTernerosMuertosGuacheraMes,
            porcentajeMortandadRecriaMes
        }
    });
    await syncYearlyProjections(existing.tamboId, year);
    return result;
}
export async function deleteMonthlyStatistic(id) {
    const existing = await prisma.monthlyStatistic.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Estadística mensual no encontrada" };
    const result = await prisma.monthlyStatistic.delete({
        where: { id }
    });
    await syncYearlyProjections(existing.tamboId, existing.year);
    return result;
}
