import { Router } from "express";
import { upsertDateStatisticHandler, getDateStatisticsByTamboHandler, getDateStatisticByIdHandler, getAnnualDateStatisticsHandler, updateDateStatisticHandler, deleteDateStatisticHandler } from "../controller/date-stats.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
const router = Router();
/**
 * @openapi
 * components:
 *  schemas:
 *    DateStatInput:
 *      type: object
 *      required:
 *        - tamboId
 *        - startDate
 *        - endDate
 *        - vacasElegidas
 *        - vacasEnCelo
 *        - vacasPreniadas
 *      properties:
 *        tamboId:
 *          type: string
 *          format: uuid
 *        startDate:
 *          type: string
 *          format: date-time
 *          example: "2026-03-01T00:00:00.000Z"
 *        endDate:
 *          type: string
 *          format: date-time
 *          example: "2026-03-22T00:00:00.000Z"
 *        vacasElegidas:
 *          type: number
 *          example: 50
 *          description: Vacas elegidas para el análisis reproductivo
 *        vacasEnCelo:
 *          type: number
 *          example: 35
 *          description: Vacas vistas en celo
 *        vacasPreniadas:
 *          type: number
 *          example: 28
 *          description: Vacas preñadas
 */
/**
 * @openapi
 * /api/date-stats:
 *  post:
 *     tags:
 *     - DateStatistics
 *     summary: Create or update (upsert) a 21-day reproductive cycle stat
 *     description: |
 *       Los 3 cálculos (% celo, % preñez, tasa de preñez) se calculan automáticamente.
 *       Si ya existe un registro para el mismo tambo y rango de fechas, se actualiza.
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *           $ref: '#/components/schemas/DateStatInput'
 *     responses:
 *       200:
 *         description: Created or updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tambo not found
 *       500:
 *         description: Internal server error
 */
router.post("/", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), upsertDateStatisticHandler);
/**
 * @openapi
 * /api/date-stats/tambo/{tamboId}:
 *  get:
 *     tags:
 *     - DateStatistics
 *     summary: Get all 21-day cycle stats for a Tambo
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
router.get("/tambo/:tamboId", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getDateStatisticsByTamboHandler);
/**
 * @openapi
 * /api/date-stats/tambo/{tamboId}/annual/{year}:
 *  get:
 *     tags:
 *     - DateStatistics
 *     summary: Get annual aggregated stats for a Tambo
 *     description: |
 *       Suma las variables crudas de todos los ciclos del año y recalcula los indicadores sobre esos totales.
 *     parameters:
 *      - name: tamboId
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *      - name: year
 *        in: path
 *        required: true
 *        schema:
 *          type: integer
 *          example: 2026
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid year
 *       404:
 *         description: Tambo not found
 *       500:
 *         description: Internal server error
 */
router.get("/tambo/:tamboId/annual/:year", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getAnnualDateStatisticsHandler);
/**
 * @openapi
 * /api/date-stats/{id}:
 *  get:
 *     tags:
 *     - DateStatistics
 *     summary: Get a single cycle stat by ID
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getDateStatisticByIdHandler);
/**
 * @openapi
 * /api/date-stats/{id}:
 *  put:
 *     tags:
 *     - DateStatistics
 *     summary: Update variables of an existing cycle stat (recalculates metrics automatically)
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
 *             vacasElegidas:
 *               type: number
 *             vacasEnCelo:
 *               type: number
 *             vacasPreniadas:
 *               type: number
 *     responses:
 *       200:
 *         description: Successfully updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), updateDateStatisticHandler);
/**
 * @openapi
 * /api/date-stats/{id}:
 *  delete:
 *     tags:
 *     - DateStatistics
 *     summary: Delete a cycle stat
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Successfully deleted
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), deleteDateStatisticHandler);
export default router;
