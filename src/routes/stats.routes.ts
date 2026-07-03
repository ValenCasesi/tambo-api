import { Router } from "express";
import { upsertMonthlyStatisticHandler, getAnnualStatisticsHandler, getAllMonthlyStatisticsHandler, getMonthlyStatisticsByTamboHandler, updateMonthlyStatisticHandler, deleteMonthlyStatisticHandler, getMyMonthlyStatsActivitySummaryHandler } from "../controller/monthly-stats.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @openapi
 * components:
 *  schemas:
 *    MonthlyStatisticInput:
 *      type: object
 *      required:
 *        - tamboId
 *        - period
 *      properties:
 *        tamboId:
 *          type: string
 *          format: uuid
 *        period:
 *          type: string
 *          example: "202602"
 *          description: El periodo en formato YYYYMM
 *        partosVaquillonas:
 *          type: number
 *        partosVacas:
 *          type: number
 *        vacasOrdene:
 *          type: number
 *        vacasSecas:
 *          type: number
 *        litrosUsina:
 *          type: number
 *        litrosDescarte:
 *          type: number
 *        litrosGuachera:
 *          type: number
 *        ternerosMuertosPeriparto:
 *          type: number
 *        ternerosMachosNacidosVivos:
 *          type: number
 *        ternerasHembrasNacidasVivas:
 *          type: number
 *        cantNacimientosMellizos:
 *          type: number
 *        ternerosMuertosGuachera:
 *          type: number
 *        ternerosIngresadosGuachera:
 *          type: number
 *        cantTernerasHembrasIngRecria:
 *          type: number
 *        cantHembrasRecriaHastaServMuertas:
 *          type: number
 *        edadVaquillonasPrimerServicioMeses:
 *          type: number
 *        cantVacasMuertasMes:
 *          type: number
 *        cantVacasVendidasMes:
 *          type: number
 *        CantVaquillonasPrenadas:
 *          type: number
 *        CantVacasPrenadas:
 *          type: number
 *        CantVacasAbortadas:
 *          type: number
 *        cantVaquillonasAbortadas:
 *          type: number
 *        diasIPPS:
 *          type: number
 *        porcentajeIPPS:
 *          type: number
 *        cantVacasMetritis:
 *          type: number
 *        CantVacasRetencionPlacenta:
 *          type: number
 *        cantVacasCaidas:
 *          type: number
 *        diasDeLeche:
 *          type: number
 *        conteoCelulasSomaticas:
 *          type: number
 *        conteoBacteriasTotales:
 *          type: number
 *        casosClinicosMastitis:
 *          type: number
 *        conteoCultivoPlacasPositivo:
 *          type: number
 *        conteoCultivoPlacasContaminados:
 *          type: number
 *    MonthlyStatisticResponse:
 *      allOf:
 *        - $ref: '#/components/schemas/MonthlyStatisticInput'
 *        - type: object
 *          properties:
 *            id:
 *              type: string
 *            month:
 *              type: number
 *            year:
 *              type: number
 *            partosTotales:
 *              type: number
 *            vacasTotales:
 *              type: number
 *            promedioLitrosVaca:
 *              type: number
 *            porcentajePartoVaquillonas:
 *              type: number
 *            porcentajeNatimortos:
 *              type: number
 *            totalTernerosNacidosVivos:
 *              type: number
 *            porcentajeTernerosMuertosGuacheraMes:
 *              type: number
 *            porcentajeMortandadRecriaMes:
 *              type: number
 *            proyeccionAnualNatimortos:
 *              type: number
 *            proyeccionAnualTernerosMuertosGuachera:
 *              type: number
 *            proyeccionAnualMortandadRecria:
 *              type: number
 *            refugoTotalVacas:
 *              type: number
 *            porcentajeRefugoVacasMes:
 *              type: number
 *            porcentajeRefugoVacasMensual:
 *              type: number
 *            porcentajeVacasMuertasMes:
 *              type: number
 *            porcentajeVacasMuertasMensual:
 *              type: number
 *            porcentajeVacasVendidas:
 *              type: number
 *            proyeccionAnualRefugoTotalVacas:
 *              type: number
 *            proyeccionAnualVacasMuertas:
 *              type: number
 *            proyeccionAnualVacasVendidas:
 *              type: number
 *            porcentajeVacasPrenadas:
 *              type: number
 *            animalesPrenados:
 *              type: number
 *            porcentajeAbortoVacasMes:
 *              type: number
 *            acumAnualAbortosVacas:
 *              type: number
 *            porcentajeVaquillonasAbortadasMes:
 *              type: number
 *            acumAnualAbortosVaquillonas:
 *              type: number
 *            porcentajeMetritisVacas:
 *              type: number
 *            porcentajeRetencionPlacentaVacas:
 *              type: number
 *            porcentajeVacasCaida:
 *              type: number
 *            crecimientoAnual:
 *              type: number
 *            acumAnualCrecimientoActual:
 *              type: number
 *            crecimientoFuturo:
 *              type: number
 *            acumAnualCrecimientoFuturo:
 *              type: number
 *            porcentajeCasosClinicosMastitis:
 *              type: number
 *            conteoCultivoPlacasNegativas:
 *              type: number
 *            porcentajeConteoPlacasPositivo:
 *              type: number
 *            porcentajeConteoPlacasNegativo:
 *              type: number
 *            porcentajeConteoPlacasContaminado:
 *              type: number
 *    AnnualStatisticsResponse:
 *      type: object
 *      properties:
 *        year:
 *          type: number
 *        monthsReported:
 *          type: number
 *        totals:
 *          type: object
 *          properties:
 *            partosVaquillonas:
 *              type: number
 *            partosVacas:
 *              type: number
 *            partosTotales:
 *              type: number
 *            litrosUsina:
 *              type: number
 *            litrosDescarte:
 *              type: number
 *            litrosGuachera:
 *              type: number
 *            ternerosMuertosPeriparto:
 *              type: number
 *            totalTernerosNacidosVivos:
 *              type: number
 *            totalTernerosMuertos:
 *              type: number
 *            cantTernerasHembrasIngRecria:
 *              type: number
 *            cantHembrasRecriaHastaServMuertas:
 *              type: number
 *            refugoTotalVacas:
 *              type: number
 *            CantVacasAbortadas:
 *              type: number
 *            CantVacasPrenadas:
 *              type: number
 *            cantVaquillonasAbortadas:
 *              type: number
 *            CantVaquillonasPrenadas:
 *              type: number
 *            crecimientoAnual:
 *              type: number
 *            crecimientoFuturo:
 *              type: number
 *        averages:
 *          type: object
 *          properties:
 *            vacasOrdene:
 *              type: number
 *            vacasSecas:
 *              type: number
 *            vacasTotales:
 *              type: number
 *        computed:
 *          type: object
 *          properties:
 *            porcentajeNatimortos:
 *              type: number
 *            promedioLitrosVaca:
 *              type: number
 *            proyeccionAnualTernerosMuertosGuachera:
 *              type: number
 *            proyeccionAnualMortandadRecria:
 *              type: number
 *            proyeccionAnualRefugoTotalVacas:
 *              type: number
 *            proyeccionAnualVacasMuertas:
 *              type: number
 *            proyeccionAnualVacasVendidas:
 *              type: number
 *            acumAnualAbortosVacas:
 *              type: number
 *            acumAnualAbortosVaquillonas:
 *              type: number
 *            acumAnualCrecimientoActual:
 *              type: number
 *            acumAnualCrecimientoFuturo:
 *              type: number
 */

/**
 * @openapi
 * /api/stats:
 *  post:
 *     tags:
 *     - Statistics
 *     summary: Insert or Update a monthly statistic for a Tambo
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *           $ref: '#/components/schemas/MonthlyStatisticInput'
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MonthlyStatisticResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tambo not found
 */
router.post("/", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), upsertMonthlyStatisticHandler);

router.get("/me/activity-summary", requireAuth, requireRole(["PRODUCTOR"]), getMyMonthlyStatsActivitySummaryHandler);

/**
 * @openapi
 * /api/stats/{tamboId}/annual/{year}:
 *  get:
 *     tags:
 *     - Statistics
 *     summary: Get generated annual statistics dynamically
 *     parameters:
 *      - name: tamboId
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *      - name: year
 *        in: path
 *        required: true
 *        schema:
 *          type: number
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnnualStatisticsResponse'
 *       404:
 *         description: Tambo not found
 */
router.get("/:tamboId/annual/:year", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getAnnualStatisticsHandler);

/**
 * @openapi
 * /api/stats/monthly:
 *  get:
 *     tags:
 *     - Statistics
 *     summary: Get all Monthly Statistics across all Tambos
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlyStatisticResponse'
 *       500:
 *         description: Internal server error
 */
router.get("/monthly", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getAllMonthlyStatisticsHandler);

/**
 * @openapi
 * /api/stats/{tamboId}/monthly:
 *  get:
 *     tags:
 *     - Statistics
 *     summary: Get all Monthly Statistics for a specific Tambo
 *     parameters:
 *      - name: tamboId
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MonthlyStatisticResponse'
 *       404:
 *         description: Tambo not found
 *       500:
 *         description: Internal server error
 */
router.get("/:tamboId/monthly", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getMonthlyStatisticsByTamboHandler);

/**
 * @openapi
 * /api/stats/{id}:
 *  put:
 *     tags:
 *     - Statistics
 *     summary: Update an existing Monthly Statistic by ID
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *           type: object
 *           properties:
 *             partosVaquillonas:
 *               type: number
 *             partosVacas:
 *               type: number
 *             vacasOrdene:
 *               type: number
 *             vacasSecas:
 *               type: number
 *             litrosUsina:
 *               type: number
 *             litrosDescarte:
 *               type: number
 *             litrosGuachera:
 *               type: number
 *             ternerosMuertosPeriparto:
 *               type: number
 *             ternerosMachosNacidosVivos:
 *               type: number
 *             ternerasHembrasNacidasVivas:
 *               type: number
 *             cantNacimientosMellizos:
 *               type: number
 *             ternerosMuertosGuachera:
 *               type: number
 *             ternerosIngresadosGuachera:
 *               type: number
 *             cantTernerasHembrasIngRecria:
 *               type: number
 *             cantHembrasRecriaHastaServMuertas:
 *               type: number
 *             edadVaquillonasPrimerServicioMeses:
 *               type: number
 *             cantVacasMuertasMes:
 *               type: number
 *             cantVacasVendidasMes:
 *               type: number
 *             CantVaquillonasPrenadas:
 *               type: number
 *             CantVacasPrenadas:
 *               type: number
 *             CantVacasAbortadas:
 *               type: number
 *             cantVaquillonasAbortadas:
 *               type: number
 *             diasIPPS:
 *               type: number
 *             porcentajeIPPS:
 *               type: number
 *             cantVacasMetritis:
 *               type: number
 *             CantVacasRetencionPlacenta:
 *               type: number
 *             cantVacasCaidas:
 *               type: number
 *             diasDeLeche:
 *               type: number
 *             conteoCelulasSomaticas:
 *               type: number
 *             conteoBacteriasTotales:
 *               type: number
 *             casosClinicosMastitis:
 *               type: number
 *             conteoCultivoPlacasPositivo:
 *               type: number
 *             conteoCultivoPlacasContaminados:
 *               type: number
 *     responses:
 *       200:
 *         description: Successfully updated Monthly Statistic
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MonthlyStatisticResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Statistic not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), updateMonthlyStatisticHandler);

/**
 * @openapi
 * /api/stats/{id}:
 *  delete:
 *     tags:
 *     - Statistics
 *     summary: Delete an existing Monthly Statistic by ID
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Successfully deleted Monthly Statistic
 *       404:
 *         description: Statistic not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), deleteMonthlyStatisticHandler);

export default router;
