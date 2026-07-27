import prisma from "../prisma/client.js";
import { EntityStatus } from "@prisma/client";
export const COMPARISON_MINIMUM_SAMPLE = 18;
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
const addDerivedMonthlyMetrics = (row) => {
    const natimortos = toFiniteNumber(row.porcentajeNatimortos);
    const guachera = toFiniteNumber(row.porcentajeTernerosMuertosGuacheraMes);
    const recria = toFiniteNumber(row.porcentajeMortandadRecriaMes);
    return {
        ...row,
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
