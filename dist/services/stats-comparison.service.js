import prisma from "../prisma/client.js";
import { EntityStatus } from "@prisma/client";
export const COMPARISON_MINIMUM_SAMPLE = 18;
export const MARKET_ACCESS_MINIMUM_COMPLETION = 70;
export const MARKET_ACCESS_INPUT_KEYS = [
    "vacasOrdene",
    "vacasSecas",
    "litrosUsina",
    "litrosDescarte",
    "litrosGuachera",
    "diasDeLeche",
    "CantVaquillonasPrenadas",
    "CantVacasPrenadas",
    "CantVacasAbortadas",
    "cantVaquillonasAbortadas",
    "diasIPPS",
    "porcentajeIPPS",
    "partosVaquillonas",
    "partosVacas",
    "ternerosMachosNacidosVivos",
    "ternerasHembrasNacidasVivas",
    "ternerosMuertosPeriparto",
    "cantNacimientosMellizos",
    "ternerosIngresadosGuachera",
    "ternerosMuertosGuachera",
    "cantTernerasHembrasIngRecria",
    "cantHembrasRecriaHastaServMuertas",
    "edadVaquillonasPrimerServicioMeses",
    "cantVacasMetritis",
    "CantVacasRetencionPlacenta",
    "cantVacasCaidas",
    "conteoCelulasSomaticas",
    "conteoBacteriasTotales",
    "casosClinicosMastitis",
    "conteoCultivoPlacasPositivo",
    "conteoCultivoPlacasContaminados",
    "cantVacasMuertasMes",
    "cantVacasVendidasMes"
];
const MONTHLY_METRIC_KEYS = [
    "vacasOrdene",
    "vacasSecas",
    "vacasTotales",
    "partosVaquillonas",
    "partosVacas",
    "partosTotales",
    "porcentajePartoVaquillonas",
    "promedioLitrosVaca",
    "porcentajeNatimortos",
    "porcentajeTernerosMuertosGuacheraMes",
    "porcentajeMortandadRecriaMes",
    "porcentajeRefugoVacasMes",
    "porcentajeVacasMuertasMensual",
    "porcentajeVacasVendidas",
    "proyeccionAnualVacasVendidas",
    "proyeccionAnualRefugoTotalVacas",
    "proyeccionAnualVacasMuertas",
    "crecimientoAnual",
    "acumAnualCrecimientoActual",
    "acumAnualCrecimientoFuturo",
    "porcentajeMetritisVacas",
    "porcentajeRetencionPlacentaVacas",
    "porcentajeVacasCaida",
    "diasDeLeche",
    "porcentajeCasosClinicosMastitis",
    "porcentajeConteoPlacasPositivo",
    "porcentajeConteoPlacasNegativo",
    "porcentajeConteoPlacasContaminado"
];
const CYCLE_METRIC_KEYS = [
    "porcentajeCelo",
    "porcentajePreniez",
    "tasaPreniez"
];
const MONTHLY_DERIVED_METRIC_KEYS = [
    "porcentajeVacasOrdene",
    "porcentajeCrecimientoActual",
    "perdidaTernerosTotal",
    "perdidaTotalTerneras"
];
const MONTHLY_COMPARISON_METRIC_KEYS = [
    ...MONTHLY_METRIC_KEYS,
    ...MONTHLY_DERIVED_METRIC_KEYS
];
const toFiniteNumber = (value) => {
    if (value === null || value === undefined)
        return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};
export const getLastClosedPeriods = (now = new Date()) => {
    const dateParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Argentina/Cordoba",
        year: "numeric",
        month: "numeric"
    }).formatToParts(now);
    let year = Number(dateParts.find((part) => part.type === "year")?.value);
    let month = Number(dateParts.find((part) => part.type === "month")?.value);
    return Array.from({ length: 2 }, () => {
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
        return {
            period: `${year}${String(month).padStart(2, "0")}`,
            year,
            month
        };
    });
};
export const evaluateMarketAccess = (rows, periods = getLastClosedPeriods()) => {
    const rowsByPeriod = new Map(rows.map((row) => [String(row.period), row]));
    const periodCompletion = periods.map((period) => {
        const row = rowsByPeriod.get(period.period);
        const completed = row
            ? MARKET_ACCESS_INPUT_KEYS.filter((key) => {
                const value = toFiniteNumber(row[key]);
                return value !== null && value !== 0;
            }).length
            : 0;
        const total = MARKET_ACCESS_INPUT_KEYS.length;
        const completionPercentage = Number(((completed / total) * 100).toFixed(1));
        return { ...period, completed, total, completionPercentage };
    });
    return {
        eligible: periodCompletion.every(({ completed, total }) => (completed / total) * 100 >= MARKET_ACCESS_MINIMUM_COMPLETION),
        requiredPercentage: MARKET_ACCESS_MINIMUM_COMPLETION,
        periods: periodCompletion
    };
};
export function averageMetricRows(rows, metricKeys, minimumSample = COMPARISON_MINIMUM_SAMPLE) {
    return Object.fromEntries(metricKeys.map((key) => {
        const values = rows
            .map((row) => toFiniteNumber(row[key]))
            .filter((value) => value !== null);
        if (values.length < minimumSample)
            return [key, null];
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        return [key, Number(average.toFixed(2))];
    }));
}
export const addDerivedMonthlyMetrics = (row) => {
    const vacasOrdene = toFiniteNumber(row.vacasOrdene);
    const vacasTotales = toFiniteNumber(row.vacasTotales);
    const crecimientoAnual = toFiniteNumber(row.crecimientoAnual);
    const natimortos = toFiniteNumber(row.porcentajeNatimortos);
    const guachera = toFiniteNumber(row.porcentajeTernerosMuertosGuacheraMes);
    const recria = toFiniteNumber(row.porcentajeMortandadRecriaMes);
    return {
        ...row,
        porcentajeVacasOrdene: vacasOrdene !== null && vacasTotales !== null && vacasTotales > 0
            ? (vacasOrdene * 100) / vacasTotales
            : null,
        porcentajeCrecimientoActual: crecimientoAnual !== null && vacasTotales !== null && vacasTotales > 0
            ? (crecimientoAnual * 100) / (vacasTotales / 12)
            : null,
        perdidaTernerosTotal: natimortos !== null && guachera !== null
            ? natimortos + guachera
            : null,
        perdidaTotalTerneras: natimortos !== null && guachera !== null && recria !== null
            ? natimortos + guachera + recria
            : null
    };
};
const getCycleIndex = (startDate, year) => {
    const calendarDate = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const startOfYear = Date.UTC(year, 0, 1);
    const dayOffset = Math.floor((calendarDate - startOfYear) / 86_400_000);
    const cycleIndex = Math.floor(dayOffset / 21);
    return cycleIndex >= 0 && cycleIndex < 17 ? cycleIndex : null;
};
export async function getStatsComparison(tamboId, year, filters, actor) {
    if (!actor || actor.role !== "PRODUCTOR") {
        throw { status: 403, message: "La comparación está disponible únicamente para productores" };
    }
    const selectedTambo = await prisma.tambo.findUnique({
        where: { id: tamboId },
        select: { id: true, userId: true }
    });
    if (!selectedTambo) {
        throw { status: 404, message: "Tambo no encontrado" };
    }
    if (selectedTambo.userId !== actor.id) {
        throw { status: 403, message: "No puedes comparar estadísticas de un tambo ajeno" };
    }
    const closedPeriods = getLastClosedPeriods();
    const accessRows = await prisma.monthlyStatistic.findMany({
        where: {
            tamboId,
            period: { in: closedPeriods.map(({ period }) => period) }
        },
        select: {
            period: true,
            ...Object.fromEntries(MARKET_ACCESS_INPUT_KEYS.map((key) => [key, true]))
        }
    });
    const eligibility = evaluateMarketAccess(accessRows, closedPeriods);
    if (!eligibility.eligible) {
        return {
            minimumSample: COMPARISON_MINIMUM_SAMPLE,
            eligibility,
            availability: { monthly: false, cycles: false },
            filters: {
                size: filters.size ?? null,
                cuenca: filters.cuenca ?? null,
                system: filters.system ?? null
            },
            monthly: [],
            cycles: []
        };
    }
    const peerTamboWhere = {
        userId: { not: actor.id },
        status: EntityStatus.ACTIVE,
        user: { status: EntityStatus.ACTIVE },
        ...(filters.size ? { size: filters.size } : {}),
        ...(filters.cuenca ? { cuenca: filters.cuenca } : {}),
        ...(filters.system ? { system: filters.system } : {})
    };
    const [monthlyRows, cycleRows] = await Promise.all([
        prisma.monthlyStatistic.findMany({
            where: {
                year,
                tambo: peerTamboWhere
            },
            select: {
                tamboId: true,
                month: true,
                ...Object.fromEntries(MONTHLY_METRIC_KEYS.map((key) => [key, true]))
            }
        }),
        prisma.dateStatistic.findMany({
            where: {
                year,
                tambo: peerTamboWhere,
                OR: [
                    { porcentajeCelo: { not: null } },
                    { porcentajePreniez: { not: null } },
                    { tasaPreniez: { not: null } }
                ]
            },
            select: {
                tamboId: true,
                startDate: true,
                porcentajeCelo: true,
                porcentajePreniez: true,
                tasaPreniez: true
            }
        })
    ]);
    const monthlyAvailable = new Set(monthlyRows.map((row) => row.tamboId)).size >= COMPARISON_MINIMUM_SAMPLE;
    const cyclesAvailable = new Set(cycleRows.map((row) => row.tamboId)).size >= COMPARISON_MINIMUM_SAMPLE;
    const monthly = monthlyAvailable
        ? Array.from({ length: 12 }, (_, monthIndex) => {
            const rows = monthlyRows
                .filter((row) => row.month === monthIndex + 1)
                .map((row) => addDerivedMonthlyMetrics(row));
            return {
                month: monthIndex + 1,
                metrics: averageMetricRows(rows, MONTHLY_COMPARISON_METRIC_KEYS)
            };
        })
        : [];
    const cycles = cyclesAvailable
        ? Array.from({ length: 17 }, (_, cycleIndex) => {
            const rows = cycleRows
                .filter((row) => getCycleIndex(row.startDate, year) === cycleIndex);
            return {
                cycle: cycleIndex + 1,
                metrics: averageMetricRows(rows, CYCLE_METRIC_KEYS)
            };
        })
        : [];
    return {
        minimumSample: COMPARISON_MINIMUM_SAMPLE,
        eligibility,
        availability: {
            monthly: monthlyAvailable,
            cycles: cyclesAvailable
        },
        filters: {
            size: filters.size ?? null,
            cuenca: filters.cuenca ?? null,
            system: filters.system ?? null
        },
        monthly,
        cycles
    };
}
