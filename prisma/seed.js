import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_YEAR = Number(process.env.SEED_YEAR || new Date().getFullYear());
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Comparacion123!";
const MONTHS_TO_SEED = 6;
const CYCLES_TO_SEED = 17;
const PEER_COUNT = 24;

const MAIN_EMAIL = "comparacion@tambo.test";
const PEDRO_EMAIL = "pedro@example.com";
const PEER_EMAIL_DOMAIN = "comparacion.tambo.test";

const round = (value, decimals = 2) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
};

const percentage = (numerator, denominator) =>
    denominator > 0 ? round((numerator * 100) / denominator) : null;

const getPeerProfile = (peerIndex) => {
    if (peerIndex < 20) {
        return {
            cuenca: "CENTRO_CBA_VILLA_MARIA",
            size: "MEDIANO",
            system: "PASTORIL_SUPLEMENTADO",
            location: "Villa María",
            province: "Córdoba",
            cows: 330 + peerIndex * 8
        };
    }

    return [
        {
            cuenca: "SANTA_FE_CENTRO",
            size: "CHICO",
            system: "PASTORIL",
            location: "Rafaela",
            province: "Santa Fe",
            cows: 170
        },
        {
            cuenca: "CBA_SUR",
            size: "GRANDE",
            system: "DRY_LOT",
            location: "Río Cuarto",
            province: "Córdoba",
            cows: 1250
        },
        {
            cuenca: "BSAS_OESTE",
            size: "MEGA",
            system: "FREE_STALL",
            location: "Trenque Lauquen",
            province: "Buenos Aires",
            cows: 4200
        },
        {
            cuenca: "LA_PAMPA",
            size: "CHICO",
            system: "COMPOST_BARN",
            location: "General Pico",
            province: "La Pampa",
            cows: 190
        }
    ][peerIndex - 20];
};

const createAccumulator = () => ({
    partosTotales: 0,
    ternerosMuertosPeriparto: 0,
    ternerosMuertosGuachera: 0,
    ternerosIngresadosGuachera: 0,
    ternerasIngresadasRecria: 0,
    ternerasMuertasRecria: 0,
    refugoTotalVacas: 0,
    vacasMuertas: 0,
    vacasVendidas: 0,
    vacasTotales: 0,
    vacasAbortadas: 0,
    vacasPrenadas: 0,
    vaquillonasAbortadas: 0,
    vaquillonasPrenadas: 0,
    crecimientoActual: 0,
    crecimientoFuturo: 0
});

const buildMonthlyStatistic = ({
    tamboId,
    farmIndex,
    month,
    cows,
    accumulator,
    isMain
}) => {
    const daysInMonth = new Date(SEED_YEAR, month, 0).getDate();
    const seasonal = Math.sin((month / 12) * Math.PI * 2);
    const variation = ((farmIndex + 3) % 7) - 3;

    const vacasOrdene = Math.max(1, Math.round(cows * (0.80 + seasonal * 0.02) + variation));
    const vacasSecas = Math.max(1, Math.round(cows - vacasOrdene));
    const vacasTotales = vacasOrdene + vacasSecas;
    const partosTotales = Math.max(4, Math.round(cows * (0.065 + month * 0.001) + variation / 2));
    const partosVaquillonas = Math.max(1, Math.round(partosTotales * (0.26 + (farmIndex % 4) * 0.01)));
    const partosVacas = partosTotales - partosVaquillonas;

    const litrosPorVaca = 26.5 + seasonal * 1.8 + (farmIndex % 6) * 0.35 + (isMain ? 1.1 : 0);
    const litrosTotales = round(litrosPorVaca * vacasOrdene * daysInMonth);
    const litrosUsina = round(litrosTotales * 0.965);
    const litrosDescarte = round(litrosTotales * 0.018);
    const litrosGuachera = round(litrosTotales - litrosUsina - litrosDescarte);

    const ternerosMuertosPeriparto = Math.max(0, Math.round(partosTotales * (0.045 + (farmIndex % 3) * 0.006)));
    const nacidosVivos = Math.max(0, partosTotales - ternerosMuertosPeriparto);
    const ternerosMachosNacidosVivos = Math.floor(nacidosVivos / 2);
    const ternerasHembrasNacidasVivas = nacidosVivos - ternerosMachosNacidosVivos;
    const ternerosIngresadosGuachera = ternerasHembrasNacidasVivas;
    const ternerosMuertosGuachera = Math.min(
        ternerosIngresadosGuachera,
        Math.max(0, Math.round(ternerosIngresadosGuachera * (0.035 + (farmIndex % 4) * 0.007)))
    );
    const cantTernerasHembrasIngRecria = Math.max(0, ternerosIngresadosGuachera - ternerosMuertosGuachera);
    const cantHembrasRecriaHastaServMuertas = Math.min(
        cantTernerasHembrasIngRecria,
        Math.max(0, Math.round(cantTernerasHembrasIngRecria * (0.018 + (farmIndex % 3) * 0.004)))
    );

    const cantVacasMuertasMes = Math.max(0, Math.round(cows * (0.002 + (farmIndex % 3) * 0.0003)));
    const cantVacasVendidasMes = Math.max(1, Math.round(cows * (0.008 + (month % 3) * 0.0008)));
    const refugoTotalVacas = cantVacasMuertasMes + cantVacasVendidasMes;

    const CantVaquillonasPrenadas = Math.max(2, Math.round(cows * (0.055 + (farmIndex % 4) * 0.002)));
    const CantVacasPrenadas = Math.max(3, Math.round(vacasOrdene * (0.16 + (month % 4) * 0.008)));
    const CantVacasAbortadas = Math.max(0, Math.round(CantVacasPrenadas * (0.025 + (farmIndex % 3) * 0.004)));
    const cantVaquillonasAbortadas = Math.max(0, Math.round(CantVaquillonasPrenadas * (0.018 + (farmIndex % 2) * 0.004)));

    const cantVacasMetritis = Math.max(0, Math.round(partosTotales * (0.055 + (farmIndex % 3) * 0.006)));
    const CantVacasRetencionPlacenta = Math.max(0, Math.round(partosTotales * (0.04 + (farmIndex % 2) * 0.006)));
    const cantVacasCaidas = Math.max(0, Math.round(partosTotales * 0.012));
    const casosClinicosMastitis = Math.max(3, Math.round(vacasOrdene * (0.018 + (farmIndex % 4) * 0.0015)));
    const conteoCultivoPlacasPositivo = Math.max(1, Math.round(casosClinicosMastitis * (0.38 + (farmIndex % 3) * 0.03)));
    const conteoCultivoPlacasContaminados = Math.max(0, Math.round(casosClinicosMastitis * (0.1 + (farmIndex % 2) * 0.02)));
    const conteoCultivoPlacasNegativas = Math.max(
        0,
        casosClinicosMastitis - conteoCultivoPlacasPositivo - conteoCultivoPlacasContaminados
    );

    const crecimientoAnual = partosVaquillonas - refugoTotalVacas;
    const crecimientoFuturo = CantVaquillonasPrenadas - cantVaquillonasAbortadas - refugoTotalVacas;

    accumulator.partosTotales += partosTotales;
    accumulator.ternerosMuertosPeriparto += ternerosMuertosPeriparto;
    accumulator.ternerosMuertosGuachera += ternerosMuertosGuachera;
    accumulator.ternerosIngresadosGuachera += ternerosIngresadosGuachera;
    accumulator.ternerasIngresadasRecria += cantTernerasHembrasIngRecria;
    accumulator.ternerasMuertasRecria += cantHembrasRecriaHastaServMuertas;
    accumulator.refugoTotalVacas += refugoTotalVacas;
    accumulator.vacasMuertas += cantVacasMuertasMes;
    accumulator.vacasVendidas += cantVacasVendidasMes;
    accumulator.vacasTotales += vacasTotales;
    accumulator.vacasAbortadas += CantVacasAbortadas;
    accumulator.vacasPrenadas += CantVacasPrenadas;
    accumulator.vaquillonasAbortadas += cantVaquillonasAbortadas;
    accumulator.vaquillonasPrenadas += CantVaquillonasPrenadas;
    accumulator.crecimientoActual += crecimientoAnual;
    accumulator.crecimientoFuturo += crecimientoFuturo;

    const omitDelForThresholdTest = !isMain && month === MONTHS_TO_SEED && farmIndex >= 17;
    const period = `${SEED_YEAR}${String(month).padStart(2, "0")}`;

    return {
        tamboId,
        period,
        month,
        year: SEED_YEAR,
        partosVaquillonas,
        partosVacas,
        vacasOrdene,
        vacasSecas,
        litrosUsina,
        litrosDescarte,
        litrosGuachera,
        ternerosMuertosPeriparto,
        ternerosMachosNacidosVivos,
        ternerasHembrasNacidasVivas,
        cantNacimientosMellizos: Math.max(0, Math.round(partosTotales * 0.025)),
        ternerosMuertosGuachera,
        ternerosIngresadosGuachera,
        cantTernerasHembrasIngRecria,
        cantHembrasRecriaHastaServMuertas,
        edadVaquillonasPrimerServicioMeses: round(14.2 + (farmIndex % 5) * 0.25),
        cantVacasMuertasMes,
        cantVacasVendidasMes,
        CantVaquillonasPrenadas,
        CantVacasPrenadas,
        CantVacasAbortadas,
        cantVaquillonasAbortadas,
        diasIPPS: round(57 + (farmIndex % 5) * 1.4),
        porcentajeIPPS: round(82 + (farmIndex % 4) * 1.5),
        cantVacasMetritis,
        CantVacasRetencionPlacenta,
        cantVacasCaidas,
        diasDeLeche: omitDelForThresholdTest ? null : round(155 + seasonal * 8 + (farmIndex % 7)),
        conteoCelulasSomaticas: round(185000 + farmIndex * 4200 + month * 1800),
        conteoBacteriasTotales: round(13500 + farmIndex * 280 + month * 120),
        casosClinicosMastitis,
        conteoCultivoPlacasPositivo,
        conteoCultivoPlacasContaminados,
        partosTotales,
        vacasTotales,
        promedioLitrosVaca: round(litrosTotales / daysInMonth / vacasOrdene),
        porcentajePartoVaquillonas: percentage(partosVaquillonas, vacasTotales),
        porcentajeNatimortos: percentage(ternerosMuertosPeriparto, partosTotales),
        totalTernerosNacidosVivos: nacidosVivos,
        porcentajeTernerosMuertosGuacheraMes: percentage(ternerosMuertosGuachera, ternerosIngresadosGuachera),
        porcentajeMortandadRecriaMes: percentage(cantHembrasRecriaHastaServMuertas, cantTernerasHembrasIngRecria),
        proyeccionAnualNatimortos: percentage(accumulator.ternerosMuertosPeriparto, accumulator.partosTotales),
        proyeccionAnualTernerosMuertosGuachera: percentage(accumulator.ternerosMuertosGuachera, accumulator.ternerosIngresadosGuachera),
        proyeccionAnualMortandadRecria: percentage(accumulator.ternerasMuertasRecria, accumulator.ternerasIngresadasRecria),
        refugoTotalVacas,
        porcentajeRefugoVacasMes: percentage(refugoTotalVacas, vacasTotales),
        porcentajeRefugoVacasMensual: percentage(refugoTotalVacas, vacasTotales / 12),
        porcentajeVacasMuertasMes: percentage(cantVacasMuertasMes, vacasTotales),
        porcentajeVacasMuertasMensual: percentage(cantVacasMuertasMes, vacasTotales / 12),
        porcentajeVacasVendidas: percentage(cantVacasVendidasMes, vacasTotales),
        proyeccionAnualRefugoTotalVacas: percentage(accumulator.refugoTotalVacas, accumulator.vacasTotales / 12),
        proyeccionAnualVacasMuertas: percentage(accumulator.vacasMuertas, accumulator.vacasTotales / 12),
        proyeccionAnualVacasVendidas: percentage(accumulator.vacasVendidas, accumulator.vacasTotales / 12),
        porcentajeVacasPrenadas: percentage(CantVacasPrenadas, vacasTotales),
        animalesPrenados: CantVaquillonasPrenadas + CantVacasPrenadas,
        porcentajeAbortoVacasMes: percentage(CantVacasAbortadas, CantVacasPrenadas),
        acumAnualAbortosVacas: percentage(accumulator.vacasAbortadas, accumulator.vacasPrenadas),
        porcentajeVaquillonasAbortadasMes: percentage(cantVaquillonasAbortadas, CantVaquillonasPrenadas),
        acumAnualAbortosVaquillonas: percentage(accumulator.vaquillonasAbortadas, accumulator.vaquillonasPrenadas),
        porcentajeMetritisVacas: percentage(cantVacasMetritis, partosTotales),
        porcentajeRetencionPlacentaVacas: percentage(CantVacasRetencionPlacenta, partosTotales),
        porcentajeVacasCaida: percentage(cantVacasCaidas, partosTotales),
        crecimientoAnual,
        acumAnualCrecimientoActual: percentage(accumulator.crecimientoActual, accumulator.vacasTotales / 12),
        crecimientoFuturo,
        acumAnualCrecimientoFuturo: percentage(accumulator.crecimientoFuturo, accumulator.vacasTotales / 12),
        porcentajeCasosClinicosMastitis: percentage(casosClinicosMastitis, vacasOrdene),
        conteoCultivoPlacasNegativas,
        porcentajeConteoPlacasPositivo: percentage(conteoCultivoPlacasPositivo, casosClinicosMastitis),
        porcentajeConteoPlacasNegativo: percentage(conteoCultivoPlacasNegativas, casosClinicosMastitis),
        porcentajeConteoPlacasContaminado: percentage(conteoCultivoPlacasContaminados, casosClinicosMastitis)
    };
};

const formatCalendarDate = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const buildCycleStatistic = ({ tamboId, farmIndex, cycleIndex, cows, isMain }) => {
    const calendarStart = new Date(Date.UTC(SEED_YEAR, 0, 1 + cycleIndex * 21));
    const calendarEnd = new Date(Date.UTC(SEED_YEAR, 0, 21 + cycleIndex * 21));
    const startDate = new Date(`${formatCalendarDate(calendarStart)}T00:00:00-03:00`);
    const endDate = new Date(`${formatCalendarDate(calendarEnd)}T00:00:00-03:00`);
    const omitForThresholdTest = !isMain && cycleIndex === 8 && farmIndex >= 17;

    if (omitForThresholdTest) {
        return {
            tamboId,
            startDate,
            endDate,
            year: SEED_YEAR,
            vacasElegidas: null,
            vacasEnCelo: null,
            vacasPreniadas: null,
            porcentajeCelo: null,
            porcentajePreniez: null,
            tasaPreniez: null
        };
    }

    const cycleVariation = Math.sin((cycleIndex / CYCLES_TO_SEED) * Math.PI * 2);
    const vacasElegidas = Math.max(10, Math.round(cows * (0.14 + cycleVariation * 0.01)));
    const detectionRate = Math.min(0.92, 0.66 + (farmIndex % 6) * 0.025 + (isMain ? 0.04 : 0));
    const conceptionRate = Math.min(0.72, 0.42 + (farmIndex % 5) * 0.025 + cycleVariation * 0.025);
    const vacasEnCelo = Math.max(1, Math.round(vacasElegidas * detectionRate));
    const vacasPreniadas = Math.max(1, Math.round(vacasEnCelo * conceptionRate));

    return {
        tamboId,
        startDate,
        endDate,
        year: SEED_YEAR,
        vacasElegidas,
        vacasEnCelo,
        vacasPreniadas,
        porcentajeCelo: percentage(vacasEnCelo, vacasElegidas),
        porcentajePreniez: percentage(vacasPreniadas, vacasEnCelo),
        tasaPreniez: percentage(vacasPreniadas, vacasElegidas)
    };
};

const seedStatisticsForTambo = async ({
    tamboId,
    cows,
    farmIndex,
    isMain
}) => {
    const accumulator = createAccumulator();
    const monthlyStatistics = Array.from({ length: MONTHS_TO_SEED }, (_, index) =>
        buildMonthlyStatistic({
            tamboId,
            farmIndex,
            month: index + 1,
            cows,
            accumulator,
            isMain
        })
    );

    const cycleStatistics = Array.from({ length: CYCLES_TO_SEED }, (_, cycleIndex) =>
        buildCycleStatistic({
            tamboId,
            farmIndex,
            cycleIndex,
            cows,
            isMain
        })
    );

    await prisma.$transaction([
        ...monthlyStatistics.map((statistic) =>
            prisma.monthlyStatistic.upsert({
                where: {
                    tamboId_period: {
                        tamboId,
                        period: statistic.period
                    }
                },
                update: statistic,
                create: statistic
            })
        ),
        ...cycleStatistics.map((statistic) =>
            prisma.dateStatistic.upsert({
                where: {
                    tamboId_startDate_endDate: {
                        tamboId,
                        startDate: statistic.startDate,
                        endDate: statistic.endDate
                    }
                },
                update: statistic,
                create: statistic
            })
        )
    ]);
};

const seedFarm = async ({
    user,
    tamboId,
    tamboName,
    profile,
    farmIndex,
    isMain
}) => {
    const tambo = await prisma.tambo.upsert({
        where: { id: tamboId },
        update: {
            userId: user.id,
            name: tamboName,
            location: profile.location,
            province: profile.province,
            cuenca: profile.cuenca,
            size: profile.size,
            system: profile.system,
            status: "ACTIVE"
        },
        create: {
            id: tamboId,
            userId: user.id,
            name: tamboName,
            location: profile.location,
            province: profile.province,
            cuenca: profile.cuenca,
            size: profile.size,
            system: profile.system,
            status: "ACTIVE"
        }
    });

    await seedStatisticsForTambo({
        tamboId: tambo.id,
        cows: profile.cows,
        farmIndex,
        isMain
    });

    return tambo;
};

const upsertProducer = async ({ email, firstName, lastName, password }) =>
    prisma.user.upsert({
        where: { email },
        update: {
            firstName,
            lastName,
            password,
            role: "PRODUCTOR",
            status: "ACTIVE",
            termsAccepted: true
        },
        create: {
            firstName,
            lastName,
            email,
            password,
            role: "PRODUCTOR",
            status: "ACTIVE",
            termsAccepted: true
        }
    });

const getReferenceCowsBySize = (size) => ({
    CHICO: 180,
    MEDIANO: 450,
    GRANDE: 1300,
    MEGA: 4200
})[size] || 450;

const seedPedro = async (passwordHash) => {
    let pedro = await prisma.user.findUnique({
        where: { email: PEDRO_EMAIL }
    });

    if (pedro && pedro.role !== "PRODUCTOR") {
        throw new Error(`${PEDRO_EMAIL} existe pero no tiene rol PRODUCTOR`);
    }

    if (!pedro) {
        pedro = await upsertProducer({
            email: PEDRO_EMAIL,
            firstName: "Pedro",
            lastName: "Prueba",
            password: passwordHash
        });
        console.log(`${PEDRO_EMAIL} no existía; se creó con la contraseña del seed.`);
    }

    let tambos = await prisma.tambo.findMany({
        where: {
            userId: pedro.id,
            status: "ACTIVE"
        },
        orderBy: { createdAt: "asc" }
    });

    if (tambos.length === 0) {
        const tambo = await seedFarm({
            user: pedro,
            tamboId: "30000000-0000-4000-8000-000000000001",
            tamboName: "Tambo de Pedro",
            profile: {
                cuenca: "CENTRO_CBA_VILLA_MARIA",
                size: "MEDIANO",
                system: "PASTORIL_SUPLEMENTADO",
                location: "Villa María",
                province: "Córdoba",
                cows: 460
            },
            farmIndex: -10,
            isMain: true
        });
        tambos = [tambo];
    } else {
        for (let index = 0; index < tambos.length; index += 1) {
            const tambo = tambos[index];
            await seedStatisticsForTambo({
                tamboId: tambo.id,
                cows: getReferenceCowsBySize(tambo.size),
                farmIndex: -10 - index,
                isMain: true
            });
        }
    }

    console.log(`Estadísticas cargadas para ${PEDRO_EMAIL} en ${tambos.length} tambo(s).`);
};

async function main() {
    if (!Number.isInteger(SEED_YEAR) || SEED_YEAR < 2000 || SEED_YEAR > 2100) {
        throw new Error("SEED_YEAR debe ser un año válido entre 2000 y 2100");
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    console.log(`Creando datos comparativos para ${SEED_YEAR}...`);

    const mainUser = await upsertProducer({
        email: MAIN_EMAIL,
        firstName: "Usuario",
        lastName: "Comparación",
        password: passwordHash
    });

    await seedFarm({
        user: mainUser,
        tamboId: "10000000-0000-4000-8000-000000000001",
        tamboName: "Tambo de prueba principal",
        profile: {
            cuenca: "CENTRO_CBA_VILLA_MARIA",
            size: "MEDIANO",
            system: "PASTORIL_SUPLEMENTADO",
            location: "Villa María",
            province: "Córdoba",
            cows: 410
        },
        farmIndex: -1,
        isMain: true
    });

    await seedPedro(passwordHash);

    for (let peerIndex = 0; peerIndex < PEER_COUNT; peerIndex += 1) {
        const suffix = String(peerIndex + 1).padStart(2, "0");
        const peerUser = await upsertProducer({
            email: `productor${suffix}@${PEER_EMAIL_DOMAIN}`,
            firstName: `Productor ${suffix}`,
            lastName: "Benchmark",
            password: passwordHash
        });

        await seedFarm({
            user: peerUser,
            tamboId: `20000000-0000-4000-8000-${String(peerIndex + 1).padStart(12, "0")}`,
            tamboName: `Tambo benchmark ${suffix}`,
            profile: getPeerProfile(peerIndex),
            farmIndex: peerIndex,
            isMain: false
        });

        process.stdout.write(`\rTambos pares creados: ${peerIndex + 1}/${PEER_COUNT}`);
    }

    console.log("\nSeed completado.");
    console.log(`Usuario de prueba: ${MAIN_EMAIL}`);
    console.log(`Contraseña: ${SEED_PASSWORD}`);
    console.log(`Usuario adicional con datos: ${PEDRO_EMAIL}`);
    console.log(`Año: ${SEED_YEAR}`);
    console.log("Filtro con muestra válida: Mediano + Centro Cba (Villa María) + Pastoril suplementado.");
    console.log("Los demás tamaños/cuencas/sistemas permiten verificar el estado de muestra insuficiente.");
}

main()
    .catch((error) => {
        console.error("No se pudo completar el seed de comparación:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
