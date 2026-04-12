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
    let sumTernerosMuertosGuachera = 0;
    let sumTernerosIngresadosGuachera = 0;
    let sumCantTernerasHembrasIngRecria = 0;
    let sumCantHembrasRecriaHastaServMuertas = 0;
    // Phase 2 additions
    let sumRefugoTotalVacas = 0;
    let sumCantVacasMuertasMes = 0;
    let sumCantVacasVendidasMes = 0;
    let sumVacasTotales = 0;
    let sumCantVacasAbortadas = 0;
    let sumCantVacasPrenadas = 0;
    let sumCantVaquillonasAbortadas = 0;
    let sumCantVaquillonasPrenadas = 0;
    let sumCrecimientoAnual = 0;
    let sumCrecimientoFuturo = 0;
    for (const record of months) {
        // We accumulate only what is present
        sumPartosTotales += Number(record.partosTotales || 0);
        sumTernerosMuertosPeriparto += Number(record.ternerosMuertosPeriparto || 0);
        sumTotalTernerosNacidosVivos += Number(record.totalTernerosNacidosVivos || 0);
        sumTernerosMuertosGuachera += Number(record.ternerosMuertosGuachera || 0);
        sumTernerosIngresadosGuachera += Number(record.ternerosIngresadosGuachera || 0);
        sumCantTernerasHembrasIngRecria += Number(record.cantTernerasHembrasIngRecria || 0);
        sumCantHembrasRecriaHastaServMuertas += Number(record.cantHembrasRecriaHastaServMuertas || 0);
        sumRefugoTotalVacas += Number(record.refugoTotalVacas || 0);
        sumCantVacasMuertasMes += Number(record.cantVacasMuertasMes || 0);
        sumCantVacasVendidasMes += Number(record.cantVacasVendidasMes || 0);
        sumVacasTotales += Number(record.vacasTotales || 0);
        sumCantVacasAbortadas += Number(record.CantVacasAbortadas || 0);
        sumCantVacasPrenadas += Number(record.CantVacasPrenadas || 0);
        sumCantVaquillonasAbortadas += Number(record.cantVaquillonasAbortadas || 0);
        sumCantVaquillonasPrenadas += Number(record.CantVaquillonasPrenadas || 0);
        sumCrecimientoAnual += Number(record.crecimientoAnual || 0);
        sumCrecimientoFuturo += Number(record.crecimientoFuturo || 0);
        // Compute running YTD formulas
        let proyeccionAnualNatimortos = null;
        if (sumPartosTotales > 0 && record.ternerosMuertosPeriparto != null) {
            proyeccionAnualNatimortos = (sumTernerosMuertosPeriparto * 100) / sumPartosTotales;
        }
        let proyeccionAnualTernerosMuertosGuachera = null;
        if (sumTernerosIngresadosGuachera > 0 && record.ternerosMuertosGuachera != null) {
            proyeccionAnualTernerosMuertosGuachera = (sumTernerosMuertosGuachera * 100) / sumTernerosIngresadosGuachera;
        }
        let proyeccionAnualMortandadRecria = null;
        if (sumCantTernerasHembrasIngRecria > 0 && record.cantHembrasRecriaHastaServMuertas != null) {
            proyeccionAnualMortandadRecria = (sumCantHembrasRecriaHastaServMuertas * 100) / sumCantTernerasHembrasIngRecria;
        }
        let proyeccionAnualRefugoTotalVacas = null;
        if (sumVacasTotales > 0 && record.refugoTotalVacas != null) {
            proyeccionAnualRefugoTotalVacas = (sumRefugoTotalVacas * 100) / (sumVacasTotales / 12);
        }
        let proyeccionAnualVacasMuertas = null;
        if (sumVacasTotales > 0 && record.cantVacasMuertasMes != null) {
            proyeccionAnualVacasMuertas = (sumCantVacasMuertasMes * 100) / (sumVacasTotales / 12);
        }
        let proyeccionAnualVacasVendidas = null;
        if (sumVacasTotales > 0 && record.cantVacasVendidasMes != null) {
            proyeccionAnualVacasVendidas = (sumCantVacasVendidasMes * 100) / (sumVacasTotales / 12);
        }
        let acumAnualAbortosVacas = null;
        if (sumCantVacasPrenadas > 0) {
            acumAnualAbortosVacas = (sumCantVacasAbortadas * 100) / sumCantVacasPrenadas;
        }
        let acumAnualAbortosVaquillonas = null;
        if (sumCantVaquillonasPrenadas > 0) {
            acumAnualAbortosVaquillonas = (sumCantVaquillonasAbortadas * 100) / sumCantVaquillonasPrenadas;
        }
        let acumAnualCrecimientoActual = null;
        if (sumVacasTotales > 0) {
            acumAnualCrecimientoActual = (sumCrecimientoAnual * 100) / (sumVacasTotales / 12);
        }
        let acumAnualCrecimientoFuturo = null;
        if (sumVacasTotales > 0) {
            acumAnualCrecimientoFuturo = (sumCrecimientoFuturo * 100) / (sumVacasTotales / 12);
        }
        // Only update these fields
        await prisma.monthlyStatistic.update({
            where: { id: record.id },
            data: {
                proyeccionAnualNatimortos,
                proyeccionAnualTernerosMuertosGuachera,
                proyeccionAnualMortandadRecria,
                proyeccionAnualRefugoTotalVacas,
                proyeccionAnualVacasMuertas,
                proyeccionAnualVacasVendidas,
                acumAnualAbortosVacas,
                acumAnualAbortosVaquillonas,
                acumAnualCrecimientoActual,
                acumAnualCrecimientoFuturo
            }
        });
    }
}
export async function upsertMonthlyStatistic(input) {
    const { tamboId, period,
    // ... inputs will be safely grabbed and coalesced
     } = input;
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
    const vTernerosMuertosGuachera = input.ternerosMuertosGuachera !== undefined ? input.ternerosMuertosGuachera : (existing && existing.ternerosMuertosGuachera != null ? Number(existing.ternerosMuertosGuachera) : null);
    const vTernerosIngresadosGuachera = input.ternerosIngresadosGuachera !== undefined ? input.ternerosIngresadosGuachera : (existing && existing.ternerosIngresadosGuachera != null ? Number(existing.ternerosIngresadosGuachera) : null);
    const vCantTernerasHembrasIngRecria = input.cantTernerasHembrasIngRecria !== undefined ? input.cantTernerasHembrasIngRecria : (existing && existing.cantTernerasHembrasIngRecria != null ? Number(existing.cantTernerasHembrasIngRecria) : null);
    const vCantHembrasRecriaHastaServMuertas = input.cantHembrasRecriaHastaServMuertas !== undefined ? input.cantHembrasRecriaHastaServMuertas : (existing && existing.cantHembrasRecriaHastaServMuertas != null ? Number(existing.cantHembrasRecriaHastaServMuertas) : null);
    const vEdadVaquillonasPrimerServicioMeses = input.edadVaquillonasPrimerServicioMeses !== undefined ? input.edadVaquillonasPrimerServicioMeses : (existing && existing.edadVaquillonasPrimerServicioMeses != null ? Number(existing.edadVaquillonasPrimerServicioMeses) : null);
    const vCantVacasMuertasMes = input.cantVacasMuertasMes !== undefined ? input.cantVacasMuertasMes : (existing && existing.cantVacasMuertasMes != null ? Number(existing.cantVacasMuertasMes) : null);
    const vCantVacasVendidasMes = input.cantVacasVendidasMes !== undefined ? input.cantVacasVendidasMes : (existing && existing.cantVacasVendidasMes != null ? Number(existing.cantVacasVendidasMes) : null);
    const vCantVaquillonasPrenadas = input.CantVaquillonasPrenadas !== undefined ? input.CantVaquillonasPrenadas : (existing && existing.CantVaquillonasPrenadas != null ? Number(existing.CantVaquillonasPrenadas) : null);
    const vCantVacasPrenadas = input.CantVacasPrenadas !== undefined ? input.CantVacasPrenadas : (existing && existing.CantVacasPrenadas != null ? Number(existing.CantVacasPrenadas) : null);
    const vCantVacasAbortadas = input.CantVacasAbortadas !== undefined ? input.CantVacasAbortadas : (existing && existing.CantVacasAbortadas != null ? Number(existing.CantVacasAbortadas) : null);
    const vCantVaquillonasAbortadas = input.cantVaquillonasAbortadas !== undefined ? input.cantVaquillonasAbortadas : (existing && existing.cantVaquillonasAbortadas != null ? Number(existing.cantVaquillonasAbortadas) : null);
    const vDiasIPPS = input.diasIPPS !== undefined ? input.diasIPPS : (existing && existing.diasIPPS != null ? Number(existing.diasIPPS) : null);
    const vPorcentajeIPPS = input.porcentajeIPPS !== undefined ? input.porcentajeIPPS : (existing && existing.porcentajeIPPS != null ? Number(existing.porcentajeIPPS) : null);
    const vCantVacasMetritis = input.cantVacasMetritis !== undefined ? input.cantVacasMetritis : (existing && existing.cantVacasMetritis != null ? Number(existing.cantVacasMetritis) : null);
    const vCantVacasRetencionPlacenta = input.CantVacasRetencionPlacenta !== undefined ? input.CantVacasRetencionPlacenta : (existing && existing.CantVacasRetencionPlacenta != null ? Number(existing.CantVacasRetencionPlacenta) : null);
    const vCantVacasCaidas = input.cantVacasCaidas !== undefined ? input.cantVacasCaidas : (existing && existing.cantVacasCaidas != null ? Number(existing.cantVacasCaidas) : null);
    const vDiasDeLeche = input.diasDeLeche !== undefined ? input.diasDeLeche : (existing && existing.diasDeLeche != null ? Number(existing.diasDeLeche) : null);
    const vConteoCelulasSomaticas = input.conteoCelulasSomaticas !== undefined ? input.conteoCelulasSomaticas : (existing && existing.conteoCelulasSomaticas != null ? Number(existing.conteoCelulasSomaticas) : null);
    const vConteoBacteriasTotales = input.conteoBacteriasTotales !== undefined ? input.conteoBacteriasTotales : (existing && existing.conteoBacteriasTotales != null ? Number(existing.conteoBacteriasTotales) : null);
    const vCasosClinicosMastitis = input.casosClinicosMastitis !== undefined ? input.casosClinicosMastitis : (existing && existing.casosClinicosMastitis != null ? Number(existing.casosClinicosMastitis) : null);
    const vConteoCultivoPlacasPositivo = input.conteoCultivoPlacasPositivo !== undefined ? input.conteoCultivoPlacasPositivo : (existing && existing.conteoCultivoPlacasPositivo != null ? Number(existing.conteoCultivoPlacasPositivo) : null);
    const vConteoCultivoPlacasContaminados = input.conteoCultivoPlacasContaminados !== undefined ? input.conteoCultivoPlacasContaminados : (existing && existing.conteoCultivoPlacasContaminados != null ? Number(existing.conteoCultivoPlacasContaminados) : null);
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
    let porcentajeTernerosMuertosGuacheraMes = null;
    if (vTernerosIngresadosGuachera != null && vTernerosIngresadosGuachera > 0 && vTernerosMuertosGuachera != null) {
        porcentajeTernerosMuertosGuacheraMes = (vTernerosMuertosGuachera * 100) / vTernerosIngresadosGuachera;
    }
    let porcentajeMortandadRecriaMes = null;
    if (vCantTernerasHembrasIngRecria != null && vCantTernerasHembrasIngRecria > 0 && vCantHembrasRecriaHastaServMuertas != null) {
        porcentajeMortandadRecriaMes = (vCantHembrasRecriaHastaServMuertas * 100) / vCantTernerasHembrasIngRecria;
    }
    let refugoTotalVacas = null;
    if (vCantVacasMuertasMes != null && vCantVacasVendidasMes != null) {
        refugoTotalVacas = vCantVacasMuertasMes + vCantVacasVendidasMes;
    }
    let porcentajeRefugoVacasMes = null;
    if (refugoTotalVacas != null && vacasTotales > 0) {
        porcentajeRefugoVacasMes = (refugoTotalVacas * 100) / vacasTotales;
    }
    let porcentajeRefugoVacasMensual = null;
    if (refugoTotalVacas != null && vacasTotales > 0) {
        porcentajeRefugoVacasMensual = (refugoTotalVacas * 100) / (vacasTotales / 12);
    }
    let porcentajeVacasMuertasMes = null;
    if (vCantVacasMuertasMes != null && vacasTotales > 0) {
        porcentajeVacasMuertasMes = (vCantVacasMuertasMes * 100) / vacasTotales;
    }
    let porcentajeVacasMuertasMensual = null;
    if (vCantVacasMuertasMes != null && vacasTotales > 0) {
        porcentajeVacasMuertasMensual = (vCantVacasMuertasMes * 100) / (vacasTotales / 12);
    }
    let porcentajeVacasVendidas = null;
    if (vCantVacasVendidasMes != null && vacasTotales > 0) {
        porcentajeVacasVendidas = (vCantVacasVendidasMes * 100) / (vacasTotales / 12);
    }
    let porcentajeVacasPrenadas = null;
    let animalesPrenados = null;
    if (vCantVaquillonasPrenadas != null && vCantVacasPrenadas != null) {
        animalesPrenados = vCantVaquillonasPrenadas + vCantVacasPrenadas;
    }
    if (vCantVacasPrenadas != null && vacasTotales > 0) {
        porcentajeVacasPrenadas = (vCantVacasPrenadas * 100) / vacasTotales;
    }
    let porcentajeAbortoVacasMes = null;
    if (vCantVacasAbortadas != null && vCantVacasPrenadas != null && vCantVacasPrenadas > 0) {
        porcentajeAbortoVacasMes = (vCantVacasAbortadas * 100) / vCantVacasPrenadas;
    }
    let porcentajeVaquillonasAbortadasMes = null;
    if (vCantVaquillonasAbortadas != null && vCantVaquillonasPrenadas != null && vCantVaquillonasPrenadas > 0) {
        porcentajeVaquillonasAbortadasMes = (vCantVaquillonasAbortadas * 100) / vCantVaquillonasPrenadas;
    }
    let porcentajeMetritisVacas = null;
    if (vCantVacasMetritis != null && partosTotales > 0) {
        porcentajeMetritisVacas = (vCantVacasMetritis * 100) / partosTotales;
    }
    let porcentajeRetencionPlacentaVacas = null;
    if (vCantVacasRetencionPlacenta != null && partosTotales > 0) {
        porcentajeRetencionPlacentaVacas = (vCantVacasRetencionPlacenta * 100) / partosTotales;
    }
    let porcentajeVacasCaida = null;
    if (vCantVacasCaidas != null && partosTotales > 0) {
        porcentajeVacasCaida = (vCantVacasCaidas * 100) / partosTotales;
    }
    let crecimientoAnual = null;
    if (refugoTotalVacas != null) {
        crecimientoAnual = vPartosVaquillonas - refugoTotalVacas;
    }
    let crecimientoFuturo = null;
    if (vCantVaquillonasPrenadas != null && vCantVaquillonasAbortadas != null && refugoTotalVacas != null) {
        crecimientoFuturo = (vCantVaquillonasPrenadas - vCantVaquillonasAbortadas) - refugoTotalVacas;
    }
    let porcentajeCasosClinicosMastitis = null;
    if (vCasosClinicosMastitis != null && vVacasOrdene > 0) {
        porcentajeCasosClinicosMastitis = (vCasosClinicosMastitis * 100) / vVacasOrdene;
    }
    let conteoCultivoPlacasNegativas = null;
    let porcentajeConteoPlacasPositivo = null;
    let porcentajeConteoPlacasNegativo = null;
    let porcentajeConteoPlacasContaminado = null;
    if (vCasosClinicosMastitis != null && vConteoCultivoPlacasPositivo != null && vConteoCultivoPlacasContaminados != null) {
        conteoCultivoPlacasNegativas = vCasosClinicosMastitis - vConteoCultivoPlacasPositivo - vConteoCultivoPlacasContaminados;
    }
    if (vCasosClinicosMastitis != null && vCasosClinicosMastitis > 0) {
        if (vConteoCultivoPlacasPositivo != null)
            porcentajeConteoPlacasPositivo = (vConteoCultivoPlacasPositivo * 100) / vCasosClinicosMastitis;
        if (conteoCultivoPlacasNegativas != null)
            porcentajeConteoPlacasNegativo = (conteoCultivoPlacasNegativas * 100) / vCasosClinicosMastitis;
        if (vConteoCultivoPlacasContaminados != null)
            porcentajeConteoPlacasContaminado = (vConteoCultivoPlacasContaminados * 100) / vCasosClinicosMastitis;
    }
    const dataPayload = {
        partosVaquillonas: vPartosVaquillonas, partosVacas: vPartosVacas, vacasOrdene: vVacasOrdene, vacasSecas: vVacasSecas,
        litrosUsina: vLitrosUsina, litrosDescarte: vLitrosDescarte, litrosGuachera: vLitrosGuachera,
        ternerosMuertosPeriparto: vTernerosMuertosPeriparto, ternerosMachosNacidosVivos: vTernerosMachosNacidosVivos, ternerasHembrasNacidasVivas: vTernerasHembrasNacidasVivas,
        cantNacimientosMellizos: vCantNacimientosMellizos, ternerosMuertosGuachera: vTernerosMuertosGuachera, ternerosIngresadosGuachera: vTernerosIngresadosGuachera,
        cantTernerasHembrasIngRecria: vCantTernerasHembrasIngRecria, cantHembrasRecriaHastaServMuertas: vCantHembrasRecriaHastaServMuertas,
        edadVaquillonasPrimerServicioMeses: vEdadVaquillonasPrimerServicioMeses, cantVacasMuertasMes: vCantVacasMuertasMes, cantVacasVendidasMes: vCantVacasVendidasMes,
        partosTotales, vacasTotales, promedioLitrosVaca,
        porcentajeNatimortos, totalTernerosNacidosVivos,
        porcentajeTernerosMuertosGuacheraMes, porcentajeMortandadRecriaMes,
        refugoTotalVacas, porcentajeRefugoVacasMes, porcentajeRefugoVacasMensual,
        porcentajeVacasMuertasMes, porcentajeVacasMuertasMensual, porcentajeVacasVendidas,
        CantVaquillonasPrenadas: vCantVaquillonasPrenadas, CantVacasPrenadas: vCantVacasPrenadas,
        CantVacasAbortadas: vCantVacasAbortadas, cantVaquillonasAbortadas: vCantVaquillonasAbortadas,
        diasIPPS: vDiasIPPS, porcentajeIPPS: vPorcentajeIPPS, cantVacasMetritis: vCantVacasMetritis,
        CantVacasRetencionPlacenta: vCantVacasRetencionPlacenta, cantVacasCaidas: vCantVacasCaidas,
        diasDeLeche: vDiasDeLeche, conteoCelulasSomaticas: vConteoCelulasSomaticas,
        conteoBacteriasTotales: vConteoBacteriasTotales, casosClinicosMastitis: vCasosClinicosMastitis,
        conteoCultivoPlacasPositivo: vConteoCultivoPlacasPositivo, conteoCultivoPlacasContaminados: vConteoCultivoPlacasContaminados,
        porcentajeVacasPrenadas, animalesPrenados, porcentajeAbortoVacasMes, porcentajeVaquillonasAbortadasMes,
        porcentajeMetritisVacas, porcentajeRetencionPlacentaVacas, porcentajeVacasCaida, crecimientoAnual, crecimientoFuturo,
        porcentajeCasosClinicosMastitis, conteoCultivoPlacasNegativas, porcentajeConteoPlacasPositivo,
        porcentajeConteoPlacasNegativo, porcentajeConteoPlacasContaminado
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
            ternerosMuertosGuachera: true,
            ternerosIngresadosGuachera: true,
            cantTernerasHembrasIngRecria: true,
            cantHembrasRecriaHastaServMuertas: true,
            refugoTotalVacas: true,
            cantVacasMuertasMes: true,
            cantVacasVendidasMes: true,
            CantVacasAbortadas: true,
            CantVacasPrenadas: true,
            cantVaquillonasAbortadas: true,
            CantVaquillonasPrenadas: true,
            crecimientoAnual: true,
            crecimientoFuturo: true
        }
    });
    const sum = aggregates._sum;
    const sPartosTotales = Number(sum.partosTotales || 0);
    const sTernerosMuertosPeriparto = Number(sum.ternerosMuertosPeriparto || 0);
    const sVacasOrdene = Number(sum.vacasOrdene || 0);
    const sLitrosToques = Number(sum.litrosUsina || 0) + Number(sum.litrosDescarte || 0) + Number(sum.litrosGuachera || 0);
    const sTotalTernerosNacidosVivos = Number(sum.totalTernerosNacidosVivos || 0);
    const sTernerosMuertosGuachera = Number(sum.ternerosMuertosGuachera || 0);
    const sTernerosIngresadosGuachera = Number(sum.ternerosIngresadosGuachera || 0);
    const sCantTernerasHembrasIngRecria = Number(sum.cantTernerasHembrasIngRecria || 0);
    const sCantHembrasRecriaHastaServMuertas = Number(sum.cantHembrasRecriaHastaServMuertas || 0);
    const sRefugoTotalVacas = Number(sum.refugoTotalVacas || 0);
    const sCantVacasMuertasMes = Number(sum.cantVacasMuertasMes || 0);
    const sCantVacasVendidasMes = Number(sum.cantVacasVendidasMes || 0);
    const sVacasTotales = Number(sum.vacasTotales || 0);
    const sCantVacasAbortadas = Number(sum.CantVacasAbortadas || 0);
    const sCantVacasPrenadas = Number(sum.CantVacasPrenadas || 0);
    const sCantVaquillonasAbortadas = Number(sum.cantVaquillonasAbortadas || 0);
    const sCantVaquillonasPrenadas = Number(sum.CantVaquillonasPrenadas || 0);
    const sCrecimientoAnual = Number(sum.crecimientoAnual || 0);
    const sCrecimientoFuturo = Number(sum.crecimientoFuturo || 0);
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInYear = isLeap ? 366 : 365;
    // Dynamic Complex Year-to-Date Calcs for the whole year combined
    let annualPorcentajeNatimortos = null;
    if (sPartosTotales > 0) {
        annualPorcentajeNatimortos = (sTernerosMuertosPeriparto * 100) / sPartosTotales;
    }
    let annualProyeccionTernerosMuertosGuachera = null;
    if (sTernerosIngresadosGuachera > 0) {
        annualProyeccionTernerosMuertosGuachera = (sTernerosMuertosGuachera * 100) / sTernerosIngresadosGuachera;
    }
    let annualProyeccionMortandadRecria = null;
    if (sCantTernerasHembrasIngRecria > 0) {
        annualProyeccionMortandadRecria = (sCantHembrasRecriaHastaServMuertas * 100) / sCantTernerasHembrasIngRecria;
    }
    let proyeccionAnualRefugoTotalVacas = null;
    if (sVacasTotales > 0) {
        proyeccionAnualRefugoTotalVacas = (sRefugoTotalVacas * 100) / (sVacasTotales / 12);
    }
    let proyeccionAnualVacasMuertas = null;
    if (sVacasTotales > 0) {
        proyeccionAnualVacasMuertas = (sCantVacasMuertasMes * 100) / (sVacasTotales / 12);
    }
    let proyeccionAnualVacasVendidas = null;
    if (sVacasTotales > 0) {
        proyeccionAnualVacasVendidas = (sCantVacasVendidasMes * 100) / (sVacasTotales / 12);
    }
    let acumAnualAbortosVacas = null;
    if (sCantVacasPrenadas > 0) {
        acumAnualAbortosVacas = (sCantVacasAbortadas * 100) / sCantVacasPrenadas;
    }
    let acumAnualAbortosVaquillonas = null;
    if (sCantVaquillonasPrenadas > 0) {
        acumAnualAbortosVaquillonas = (sCantVaquillonasAbortadas * 100) / sCantVaquillonasPrenadas;
    }
    let acumAnualCrecimientoActual = null;
    if (sVacasTotales > 0) {
        acumAnualCrecimientoActual = (sCrecimientoAnual * 100) / (sVacasTotales / 12);
    }
    let acumAnualCrecimientoFuturo = null;
    if (sVacasTotales > 0) {
        acumAnualCrecimientoFuturo = (sCrecimientoFuturo * 100) / (sVacasTotales / 12);
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
            ternerosMuertosGuachera: sTernerosMuertosGuachera,
            ternerosIngresadosGuachera: sTernerosIngresadosGuachera,
            cantTernerasHembrasIngRecria: sCantTernerasHembrasIngRecria,
            cantHembrasRecriaHastaServMuertas: sCantHembrasRecriaHastaServMuertas,
            refugoTotalVacas: sRefugoTotalVacas,
            cantVacasMuertasMes: sCantVacasMuertasMes,
            cantVacasVendidasMes: sCantVacasVendidasMes
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
            proyeccionAnualMortandadRecria: annualProyeccionMortandadRecria !== null ? Number(annualProyeccionMortandadRecria.toFixed(2)) : null,
            proyeccionAnualRefugoTotalVacas: proyeccionAnualRefugoTotalVacas !== null ? Number(proyeccionAnualRefugoTotalVacas.toFixed(2)) : null,
            proyeccionAnualVacasMuertas: proyeccionAnualVacasMuertas !== null ? Number(proyeccionAnualVacasMuertas.toFixed(2)) : null,
            proyeccionAnualVacasVendidas: proyeccionAnualVacasVendidas !== null ? Number(proyeccionAnualVacasVendidas.toFixed(2)) : null,
            acumAnualAbortosVacas: acumAnualAbortosVacas !== null ? Number(acumAnualAbortosVacas.toFixed(2)) : null,
            acumAnualAbortosVaquillonas: acumAnualAbortosVaquillonas !== null ? Number(acumAnualAbortosVaquillonas.toFixed(2)) : null,
            acumAnualCrecimientoActual: acumAnualCrecimientoActual !== null ? Number(acumAnualCrecimientoActual.toFixed(2)) : null,
            acumAnualCrecimientoFuturo: acumAnualCrecimientoFuturo !== null ? Number(acumAnualCrecimientoFuturo.toFixed(2)) : null
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
    const ternerosMuertosGuachera = merged.ternerosMuertosGuachera != null ? Number(merged.ternerosMuertosGuachera) : null;
    const ternerosIngresadosGuachera = merged.ternerosIngresadosGuachera != null ? Number(merged.ternerosIngresadosGuachera) : null;
    const cantTernerasHembrasIngRecria = merged.cantTernerasHembrasIngRecria != null ? Number(merged.cantTernerasHembrasIngRecria) : null;
    const cantHembrasRecriaHastaServMuertas = merged.cantHembrasRecriaHastaServMuertas != null ? Number(merged.cantHembrasRecriaHastaServMuertas) : null;
    const edadVaquillonasPrimerServicioMeses = merged.edadVaquillonasPrimerServicioMeses != null ? Number(merged.edadVaquillonasPrimerServicioMeses) : null;
    const cantVacasMuertasMes = merged.cantVacasMuertasMes != null ? Number(merged.cantVacasMuertasMes) : null;
    const cantVacasVendidasMes = merged.cantVacasVendidasMes != null ? Number(merged.cantVacasVendidasMes) : null;
    const CantVaquillonasPrenadas = merged.CantVaquillonasPrenadas != null ? Number(merged.CantVaquillonasPrenadas) : null;
    const CantVacasPrenadas = merged.CantVacasPrenadas != null ? Number(merged.CantVacasPrenadas) : null;
    const CantVacasAbortadas = merged.CantVacasAbortadas != null ? Number(merged.CantVacasAbortadas) : null;
    const cantVaquillonasAbortadas = merged.cantVaquillonasAbortadas != null ? Number(merged.cantVaquillonasAbortadas) : null;
    const diasIPPS = merged.diasIPPS != null ? Number(merged.diasIPPS) : null;
    const porcentajeIPPS = merged.porcentajeIPPS != null ? Number(merged.porcentajeIPPS) : null;
    const cantVacasMetritis = merged.cantVacasMetritis != null ? Number(merged.cantVacasMetritis) : null;
    const CantVacasRetencionPlacenta = merged.CantVacasRetencionPlacenta != null ? Number(merged.CantVacasRetencionPlacenta) : null;
    const cantVacasCaidas = merged.cantVacasCaidas != null ? Number(merged.cantVacasCaidas) : null;
    const diasDeLeche = merged.diasDeLeche != null ? Number(merged.diasDeLeche) : null;
    const conteoCelulasSomaticas = merged.conteoCelulasSomaticas != null ? Number(merged.conteoCelulasSomaticas) : null;
    const conteoBacteriasTotales = merged.conteoBacteriasTotales != null ? Number(merged.conteoBacteriasTotales) : null;
    const casosClinicosMastitis = merged.casosClinicosMastitis != null ? Number(merged.casosClinicosMastitis) : null;
    const conteoCultivoPlacasPositivo = merged.conteoCultivoPlacasPositivo != null ? Number(merged.conteoCultivoPlacasPositivo) : null;
    const conteoCultivoPlacasContaminados = merged.conteoCultivoPlacasContaminados != null ? Number(merged.conteoCultivoPlacasContaminados) : null;
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
    let porcentajeTernerosMuertosGuacheraMes = null;
    if (ternerosIngresadosGuachera != null && ternerosIngresadosGuachera > 0 && ternerosMuertosGuachera != null) {
        porcentajeTernerosMuertosGuacheraMes = (ternerosMuertosGuachera * 100) / ternerosIngresadosGuachera;
    }
    let porcentajeMortandadRecriaMes = null;
    if (cantTernerasHembrasIngRecria != null && cantTernerasHembrasIngRecria > 0 && cantHembrasRecriaHastaServMuertas != null) {
        porcentajeMortandadRecriaMes = (cantHembrasRecriaHastaServMuertas * 100) / cantTernerasHembrasIngRecria;
    }
    let refugoTotalVacas = null;
    if (cantVacasMuertasMes != null && cantVacasVendidasMes != null) {
        refugoTotalVacas = cantVacasMuertasMes + cantVacasVendidasMes;
    }
    let porcentajeRefugoVacasMes = null;
    if (refugoTotalVacas != null && vacasTotales > 0) {
        porcentajeRefugoVacasMes = (refugoTotalVacas * 100) / vacasTotales;
    }
    let porcentajeRefugoVacasMensual = null;
    if (refugoTotalVacas != null && vacasTotales > 0) {
        porcentajeRefugoVacasMensual = (refugoTotalVacas * 100) / (vacasTotales / 12);
    }
    let porcentajeVacasMuertasMes = null;
    if (cantVacasMuertasMes != null && vacasTotales > 0) {
        porcentajeVacasMuertasMes = (cantVacasMuertasMes * 100) / vacasTotales;
    }
    let porcentajeVacasMuertasMensual = null;
    if (cantVacasMuertasMes != null && vacasTotales > 0) {
        porcentajeVacasMuertasMensual = (cantVacasMuertasMes * 100) / (vacasTotales / 12);
    }
    let porcentajeVacasVendidas = null;
    if (cantVacasVendidasMes != null && vacasTotales > 0) {
        porcentajeVacasVendidas = (cantVacasVendidasMes * 100) / (vacasTotales / 12);
    }
    let porcentajeVacasPrenadas = null;
    let animalesPrenados = null;
    if (CantVaquillonasPrenadas != null && CantVacasPrenadas != null) {
        animalesPrenados = CantVaquillonasPrenadas + CantVacasPrenadas;
    }
    if (CantVacasPrenadas != null && vacasTotales > 0) {
        porcentajeVacasPrenadas = (CantVacasPrenadas * 100) / vacasTotales;
    }
    let porcentajeAbortoVacasMes = null;
    if (CantVacasAbortadas != null && CantVacasPrenadas != null && CantVacasPrenadas > 0) {
        porcentajeAbortoVacasMes = (CantVacasAbortadas * 100) / CantVacasPrenadas;
    }
    let porcentajeVaquillonasAbortadasMes = null;
    if (cantVaquillonasAbortadas != null && CantVaquillonasPrenadas != null && CantVaquillonasPrenadas > 0) {
        porcentajeVaquillonasAbortadasMes = (cantVaquillonasAbortadas * 100) / CantVaquillonasPrenadas;
    }
    let porcentajeMetritisVacas = null;
    if (cantVacasMetritis != null && partosTotales > 0) {
        porcentajeMetritisVacas = (cantVacasMetritis * 100) / partosTotales;
    }
    let porcentajeRetencionPlacentaVacas = null;
    if (CantVacasRetencionPlacenta != null && partosTotales > 0) {
        porcentajeRetencionPlacentaVacas = (CantVacasRetencionPlacenta * 100) / partosTotales;
    }
    let porcentajeVacasCaida = null;
    if (cantVacasCaidas != null && partosTotales > 0) {
        porcentajeVacasCaida = (cantVacasCaidas * 100) / partosTotales;
    }
    let crecimientoAnual = null;
    if (refugoTotalVacas != null) {
        crecimientoAnual = partosVaquillonas - refugoTotalVacas;
    }
    let crecimientoFuturo = null;
    if (CantVaquillonasPrenadas != null && cantVaquillonasAbortadas != null && refugoTotalVacas != null) {
        crecimientoFuturo = (CantVaquillonasPrenadas - cantVaquillonasAbortadas) - refugoTotalVacas;
    }
    let porcentajeCasosClinicosMastitis = null;
    if (casosClinicosMastitis != null && vacasOrdene > 0) {
        porcentajeCasosClinicosMastitis = (casosClinicosMastitis * 100) / vacasOrdene;
    }
    let conteoCultivoPlacasNegativas = null;
    let porcentajeConteoPlacasPositivo = null;
    let porcentajeConteoPlacasNegativo = null;
    let porcentajeConteoPlacasContaminado = null;
    if (casosClinicosMastitis != null && conteoCultivoPlacasPositivo != null && conteoCultivoPlacasContaminados != null) {
        conteoCultivoPlacasNegativas = casosClinicosMastitis - conteoCultivoPlacasPositivo - conteoCultivoPlacasContaminados;
    }
    if (casosClinicosMastitis != null && casosClinicosMastitis > 0) {
        if (conteoCultivoPlacasPositivo != null)
            porcentajeConteoPlacasPositivo = (conteoCultivoPlacasPositivo * 100) / casosClinicosMastitis;
        if (conteoCultivoPlacasNegativas != null)
            porcentajeConteoPlacasNegativo = (conteoCultivoPlacasNegativas * 100) / casosClinicosMastitis;
        if (conteoCultivoPlacasContaminados != null)
            porcentajeConteoPlacasContaminado = (conteoCultivoPlacasContaminados * 100) / casosClinicosMastitis;
    }
    const result = await prisma.monthlyStatistic.update({
        where: { id },
        data: {
            ...data,
            ternerosMuertosPeriparto: data.ternerosMuertosPeriparto !== undefined ? data.ternerosMuertosPeriparto : existing.ternerosMuertosPeriparto,
            ternerosMachosNacidosVivos: data.ternerosMachosNacidosVivos !== undefined ? data.ternerosMachosNacidosVivos : existing.ternerosMachosNacidosVivos,
            ternerasHembrasNacidasVivas: data.ternerasHembrasNacidasVivas !== undefined ? data.ternerasHembrasNacidasVivas : existing.ternerasHembrasNacidasVivas,
            cantNacimientosMellizos: data.cantNacimientosMellizos !== undefined ? data.cantNacimientosMellizos : existing.cantNacimientosMellizos,
            ternerosMuertosGuachera: data.ternerosMuertosGuachera !== undefined ? data.ternerosMuertosGuachera : existing.ternerosMuertosGuachera,
            ternerosIngresadosGuachera: data.ternerosIngresadosGuachera !== undefined ? data.ternerosIngresadosGuachera : existing.ternerosIngresadosGuachera,
            cantTernerasHembrasIngRecria: data.cantTernerasHembrasIngRecria !== undefined ? data.cantTernerasHembrasIngRecria : existing.cantTernerasHembrasIngRecria,
            cantHembrasRecriaHastaServMuertas: data.cantHembrasRecriaHastaServMuertas !== undefined ? data.cantHembrasRecriaHastaServMuertas : existing.cantHembrasRecriaHastaServMuertas,
            edadVaquillonasPrimerServicioMeses: data.edadVaquillonasPrimerServicioMeses !== undefined ? data.edadVaquillonasPrimerServicioMeses : existing.edadVaquillonasPrimerServicioMeses,
            cantVacasMuertasMes: data.cantVacasMuertasMes !== undefined ? data.cantVacasMuertasMes : existing.cantVacasMuertasMes,
            cantVacasVendidasMes: data.cantVacasVendidasMes !== undefined ? data.cantVacasVendidasMes : existing.cantVacasVendidasMes,
            partosTotales,
            vacasTotales,
            promedioLitrosVaca,
            porcentajeNatimortos,
            totalTernerosNacidosVivos,
            porcentajeTernerosMuertosGuacheraMes,
            porcentajeMortandadRecriaMes,
            refugoTotalVacas,
            porcentajeRefugoVacasMes,
            porcentajeRefugoVacasMensual,
            porcentajeVacasMuertasMes,
            porcentajeVacasMuertasMensual,
            porcentajeVacasVendidas,
            CantVaquillonasPrenadas: data.CantVaquillonasPrenadas !== undefined ? data.CantVaquillonasPrenadas : existing.CantVaquillonasPrenadas,
            CantVacasPrenadas: data.CantVacasPrenadas !== undefined ? data.CantVacasPrenadas : existing.CantVacasPrenadas,
            CantVacasAbortadas: data.CantVacasAbortadas !== undefined ? data.CantVacasAbortadas : existing.CantVacasAbortadas,
            cantVaquillonasAbortadas: data.cantVaquillonasAbortadas !== undefined ? data.cantVaquillonasAbortadas : existing.cantVaquillonasAbortadas,
            diasIPPS: data.diasIPPS !== undefined ? data.diasIPPS : existing.diasIPPS,
            porcentajeIPPS: data.porcentajeIPPS !== undefined ? data.porcentajeIPPS : existing.porcentajeIPPS,
            cantVacasMetritis: data.cantVacasMetritis !== undefined ? data.cantVacasMetritis : existing.cantVacasMetritis,
            CantVacasRetencionPlacenta: data.CantVacasRetencionPlacenta !== undefined ? data.CantVacasRetencionPlacenta : existing.CantVacasRetencionPlacenta,
            cantVacasCaidas: data.cantVacasCaidas !== undefined ? data.cantVacasCaidas : existing.cantVacasCaidas,
            diasDeLeche: data.diasDeLeche !== undefined ? data.diasDeLeche : existing.diasDeLeche,
            conteoCelulasSomaticas: data.conteoCelulasSomaticas !== undefined ? data.conteoCelulasSomaticas : existing.conteoCelulasSomaticas,
            conteoBacteriasTotales: data.conteoBacteriasTotales !== undefined ? data.conteoBacteriasTotales : existing.conteoBacteriasTotales,
            casosClinicosMastitis: data.casosClinicosMastitis !== undefined ? data.casosClinicosMastitis : existing.casosClinicosMastitis,
            conteoCultivoPlacasPositivo: data.conteoCultivoPlacasPositivo !== undefined ? data.conteoCultivoPlacasPositivo : existing.conteoCultivoPlacasPositivo,
            conteoCultivoPlacasContaminados: data.conteoCultivoPlacasContaminados !== undefined ? data.conteoCultivoPlacasContaminados : existing.conteoCultivoPlacasContaminados,
            porcentajeVacasPrenadas, animalesPrenados, porcentajeAbortoVacasMes, porcentajeVaquillonasAbortadasMes,
            porcentajeMetritisVacas, porcentajeRetencionPlacentaVacas, porcentajeVacasCaida, crecimientoAnual, crecimientoFuturo,
            porcentajeCasosClinicosMastitis, conteoCultivoPlacasNegativas, porcentajeConteoPlacasPositivo,
            porcentajeConteoPlacasNegativo, porcentajeConteoPlacasContaminado
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
