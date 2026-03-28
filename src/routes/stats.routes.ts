import { Router } from "express";
import { upsertMonthlyStatisticHandler, getAnnualStatisticsHandler, getAllMonthlyStatisticsHandler, getMonthlyStatisticsByTamboHandler, updateMonthlyStatisticHandler, deleteMonthlyStatisticHandler } from "../controller/monthly-stats.controller.js";

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
 *        ternerosMachosMuertosGuachera:
 *          type: number
 *        ternerasHembrasMuertasGuachera:
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
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tambo not found
 */
router.post("/", upsertMonthlyStatisticHandler);

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
router.get("/:tamboId/annual/:year", getAnnualStatisticsHandler);

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
 *       500:
 *         description: Internal server error
 */
router.get("/monthly", getAllMonthlyStatisticsHandler);

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
 *       404:
 *         description: Tambo not found
 *       500:
 *         description: Internal server error
 */
router.get("/:tamboId/monthly", getMonthlyStatisticsByTamboHandler);

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
 *             ternerosMachosMuertosGuachera:
 *               type: number
 *             ternerasHembrasMuertasGuachera:
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
 *     responses:
 *       200:
 *         description: Successfully updated Monthly Statistic
 *       400:
 *         description: Validation error
 *       404:
 *         description: Statistic not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", updateMonthlyStatisticHandler);

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
router.delete("/:id", deleteMonthlyStatisticHandler);

export default router;
