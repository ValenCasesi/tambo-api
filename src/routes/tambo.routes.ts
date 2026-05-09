import { Router } from "express";
import { createTamboHandler, getAllTambosHandler, getTambosByUserHandler, updateTamboHandler, deleteTamboHandler } from "../controller/tambo.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @openapi
 * components:
 *  schemas:
 *    TamboInput:
 *      type: object
 *      required:
 *        - userId
 *        - name
 *        - location
 *        - province
 *        - cuenca
 *        - size
 *        - system
 *      properties:
 *        userId:
 *          type: string
 *          format: uuid
 *          description: ID del Productor (Usuario)
 *        name:
 *          type: string
 *          example: "Tambo La Querencia"
 *        location:
 *          type: string
 *          example: "Villa María"
 *        province:
 *          type: string
 *          example: "Córdoba"
 *        cuenca:
 *          type: string
 *          enum: [CENTRO_CBA_VILLA_MARIA, SANTA_FE_CENTRO, SANTA_FE_NORTE, CBA_SUR, ENTRE_RIOS_OESTE, ENTRE_RIOS_ESTE, CBA_NORTE, BSAS_OESTE, BSAS_ABASTO_NORTE, BSAS_ABASTO_SUR, BSAS_MAR_Y_SIERRAS, LA_PAMPA, NOA, NEA, PATAGONICA]
 *        size:
 *          type: string
 *          enum: [CHICO, MEDIANO, GRANDE, MEGA]
 *        system:
 *          type: string
 *          enum: [PASTORIL, PASTORIL_SUPLEMENTADO, DRY_LOT, FREE_STALL, COMPOST_BARN]
 */

/**
 * @openapi
 * /api/tambos:
 *  post:
 *     tags:
 *     - Tambos
 *     summary: Create a new Tambo for a Productor
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *           $ref: '#/components/schemas/TamboInput'
 *     responses:
 *       201:
 *         description: Created Tambo successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: User is not a Productor
 *       404:
 *         description: Productor not found
 *       500:
 *         description: Internal server error
 */
router.post("/", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), createTamboHandler);

/**
 * @openapi
 * /api/tambos:
 *  get:
 *     tags:
 *     - Tambos
 *     summary: Get all Tambos
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Internal server error
 */
router.get("/", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getAllTambosHandler);

/**
 * @openapi
 * /api/tambos/user/{userId}:
 *  get:
 *     tags:
 *     - Tambos
 *     summary: Get all Tambos by Producer ID
 *     parameters:
 *      - name: userId
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Internal server error
 */
router.get("/user/:userId", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getTambosByUserHandler);

/**
 * @openapi
 * /api/tambos/{id}:
 *  put:
 *     tags:
 *     - Tambos
 *     summary: Update an existing Tambo
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
 *             name:
 *               type: string
 *             location:
 *               type: string
 *             province:
 *               type: string
 *             cuenca:
 *               type: string
 *               enum: [CENTRO_CBA_VILLA_MARIA, SANTA_FE_CENTRO, SANTA_FE_NORTE, CBA_SUR, ENTRE_RIOS_OESTE, ENTRE_RIOS_ESTE, CBA_NORTE, BSAS_OESTE, BSAS_ABASTO_NORTE, BSAS_ABASTO_SUR, BSAS_MAR_Y_SIERRAS, LA_PAMPA, NOA, NEA, PATAGONICA]
 *             size:
 *               type: string
 *               enum: [CHICO, MEDIANO, GRANDE, MEGA]
 *             system:
 *               type: string
 *               enum: [PASTORIL, PASTORIL_SUPLEMENTADO, DRY_LOT, FREE_STALL, COMPOST_BARN]
 *     responses:
 *       200:
 *         description: Successfully updated Tambo
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tambo not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), updateTamboHandler);

/**
 * @openapi
 * /api/tambos/{id}:
 *  delete:
 *     tags:
 *     - Tambos
 *     summary: Soft delete an existing Tambo
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Successfully deleted Tambo
 *       404:
 *         description: Tambo not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), deleteTamboHandler);

export default router;
