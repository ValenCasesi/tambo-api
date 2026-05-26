import { Router } from "express";
import { createTenderHandler, getTendersHandler, getTenderByIdHandler, updateTenderHandler, publishTenderHandler, awardTenderHandler, deleteTenderHandler, createRequestHandler, getRequestsByTenderHandler, updateRequestHandler, deleteRequestHandler, createProposalHandler, getProposalsHandler, getMyProposalHandler, getAwardedInfoHandler, updateProposalHandler } from "../controller/tender.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
const router = Router();
/**
 * @openapi
 * components:
 *  schemas:
 *    TenderInput:
 *      type: object
 *      required: [title, product, specifications, deliveryConditions, paymentOptions, requestStartDate, requestDeadline, proposalStartDate, proposalDeadline]
 *      properties:
 *        title:
 *          type: string
 *          example: "Licitación Núcleo Mineral Q1 2026"
 *        product:
 *          type: string
 *          example: "Núcleo Mineral"
 *        specifications:
 *          type: string
 *          example: "Proteína mínima 30%, humedad máxima 12%"
 *        deliveryConditions:
 *          type: string
 *          example: "Entrega en tambo, sin costo de flete"
 *        paymentOptions:
 *          type: array
 *          items:
 *            type: string
 *          example: ["contado", "30 días", "60 días"]
 *        requestStartDate:
 *          type: string
 *          format: date-time
 *          example: "2026-04-01T00:00:00.000Z"
 *        requestDeadline:
 *          type: string
 *          format: date-time
 *          example: "2026-04-10T23:59:59.000Z"
 *        proposalStartDate:
 *          type: string
 *          format: date-time
 *          example: "2026-04-11T00:00:00.000Z"
 *        proposalDeadline:
 *          type: string
 *          format: date-time
 *          example: "2026-04-20T12:00:00.000Z"
 *    RequestInput:
 *      type: object
 *      required: [producerId, quantity]
 *      properties:
 *        producerId:
 *          type: string
 *          format: uuid
 *        quantity:
 *          type: number
 *          example: 10
 *        notes:
 *          type: string
 *          example: "Entrega en dos partes"
 *    ProposalInput:
 *      type: object
 *      required: [companyId, pricePerUnit, paymentMethod, logisticsConditions, offerValidity]
 *      properties:
 *        companyId:
 *          type: string
 *          format: uuid
 *        pricePerUnit:
 *          type: number
 *          example: 420.50
 *        paymentMethod:
 *          type: string
 *          example: "30 días"
 *        logisticsConditions:
 *          type: string
 *          example: "Flete incluido hasta 200km"
 *        offerValidity:
 *          type: string
 *          example: "30 días desde la fecha de envío"
 */
// ==========================================
// TENDER ROUTES
// ==========================================
/**
 * @openapi
 * /api/tenders:
 *  post:
 *     tags: [Tenders]
 *     summary: Admin crea una nueva licitación (estado DRAFT)
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/TenderInput'
 *     responses:
 *       201:
 *         description: Licitación creada exitosamente
 *       400:
 *         description: Error de validación
 */
router.post("/", requireAuth, requireRole(["ADMIN"]), createTenderHandler);
/**
 * @openapi
 * /api/tenders:
 *  get:
 *     tags: [Tenders]
 *     summary: Listar todas las licitaciones
 *     parameters:
 *      - in: query
 *        name: status
 *        schema:
 *          type: string
 *          enum: [DRAFT, ACCEPTING_REQUESTS, ACCEPTING_PROPOSALS, CLOSED, AWARDED]
 *        description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/", requireAuth, getTendersHandler);
/**
 * @openapi
 * /api/tenders/{id}:
 *  get:
 *     tags: [Tenders]
 *     summary: Ver detalle de una licitación (actualiza estado automáticamente)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 */
router.get("/:id", requireAuth, getTenderByIdHandler);
/**
 * @openapi
 * /api/tenders/{id}:
 *  put:
 *     tags: [Tenders]
 *     summary: Admin edita una licitación (solo en estado DRAFT)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/TenderInput'
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: No se puede editar fuera de DRAFT
 */
router.put("/:id", requireAuth, requireRole(["ADMIN"]), updateTenderHandler);
/**
 * @openapi
 * /api/tenders/{id}/publish:
 *  post:
 *     tags: [Tenders]
 *     summary: Admin publica la licitación (DRAFT → ACCEPTING_REQUESTS)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Publicada exitosamente
 *       400:
 *         description: Estado inválido o fechas incoherentes
 */
router.post("/:id/publish", requireAuth, requireRole(["ADMIN"]), publishTenderHandler);
/**
 * @openapi
 * /api/tenders/{id}/award:
 *  post:
 *     tags: [Tenders]
 *     summary: Admin elige el ganador (CLOSED → AWARDED)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required: [winnerId]
 *            properties:
 *              winnerId:
 *                type: string
 *                format: uuid
 *     responses:
 *       200:
 *         description: Adjudicada exitosamente
 *       400:
 *         description: Estado inválido o usuario no es EMPRESA
 */
router.post("/:id/award", requireAuth, requireRole(["ADMIN"]), awardTenderHandler);
/**
 * @openapi
 * /api/tenders/{id}:
 *  delete:
 *     tags: [Tenders]
 *     summary: Admin elimina una licitación (solo en DRAFT)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Eliminada
 *       400:
 *         description: No se puede eliminar fuera de DRAFT
 */
router.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteTenderHandler);
// ==========================================
// REQUEST ROUTES (Productores)
// ==========================================
/**
 * @openapi
 * /api/tenders/{id}/requests:
 *  post:
 *     tags: [Tenders - Pedidos]
 *     summary: Productor carga su pedido en la licitación
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/RequestInput'
 *     responses:
 *       201:
 *         description: Pedido creado
 *       400:
 *         description: Etapa cerrada o inválida
 *       409:
 *         description: Ya existe un pedido para esta licitación
 */
router.post("/:id/requests", requireAuth, requireRole(["PRODUCTOR"]), createRequestHandler);
/**
 * @openapi
 * /api/tenders/{id}/requests:
 *  get:
 *     tags: [Tenders - Pedidos]
 *     summary: Listar todos los pedidos de una licitación (Admin)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/:id/requests", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getRequestsByTenderHandler);
/**
 * @openapi
 * /api/tenders/{id}/requests/{requestId}:
 *  put:
 *     tags: [Tenders - Pedidos]
 *     summary: Productor modifica su pedido (solo mientras la etapa de pedidos esté abierta)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *      - name: requestId
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              producerId:
 *                type: string
 *                format: uuid
 *              quantity:
 *                type: number
 *              notes:
 *                type: string
 *     responses:
 *       200:
 *         description: Actualizado
 *       400:
 *         description: Etapa cerrada
 *       403:
 *         description: No autorizado
 */
router.put("/:id/requests/:requestId", requireAuth, requireRole(["PRODUCTOR"]), updateRequestHandler);
/**
 * @openapi
 * /api/tenders/{id}/requests/{requestId}:
 *  delete:
 *     tags: [Tenders - Pedidos]
 *     summary: Productor elimina su pedido (solo mientras la etapa de pedidos esté abierta)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *      - name: requestId
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              producerId:
 *                type: string
 *                format: uuid
 *     responses:
 *       200:
 *         description: Eliminado
 *       403:
 *         description: No autorizado
 */
router.delete("/:id/requests/:requestId", requireAuth, requireRole(["PRODUCTOR"]), deleteRequestHandler);
// ==========================================
// PROPOSAL ROUTES (Empresas)
// ==========================================
/**
 * @openapi
 * /api/tenders/{id}/proposals:
 *  post:
 *     tags: [Tenders - Ofertas]
 *     summary: Empresa envía su oferta (se bloquea automáticamente al enviar)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/ProposalInput'
 *     responses:
 *       201:
 *         description: Oferta enviada y bloqueada
 *       400:
 *         description: Etapa inválida o plazo vencido
 *       409:
 *         description: Ya existe una oferta para esta licitación
 */
router.post("/:id/proposals", requireAuth, requireRole(["EMPRESA"]), createProposalHandler);
/**
 * @openapi
 * /api/tenders/{id}/proposals:
 *  put:
 *     tags: [Tenders - Ofertas]
 *     summary: Empresa edita su oferta mientras la etapa esté abierta
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              pricePerUnit:
 *                type: number
 *              paymentMethod:
 *                type: string
 *              logisticsConditions:
 *                type: string
 *              offerValidity:
 *                type: string
 *     responses:
 *       200:
 *         description: Oferta actualizada
 *       400:
 *         description: Etapa inválida o plazo vencido
 */
router.put("/:id/proposals", requireAuth, requireRole(["EMPRESA"]), updateProposalHandler);
/**
 * @openapi
 * /api/tenders/{id}/proposals:
 *  get:
 *     tags: [Tenders - Ofertas]
 *     summary: Ver todas las ofertas con ranking (solo post-cierre)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ranking de ofertas ordenado por precio ASC
 *       403:
 *         description: Las ofertas no son visibles hasta el cierre
 */
router.get("/:id/proposals", requireAuth, requireRole(["ADMIN", "EMPRESA"]), getProposalsHandler);
/**
 * @openapi
 * /api/tenders/{id}/proposals/my:
 *  get:
 *     tags: [Tenders - Ofertas]
 *     summary: Empresa ve solo su propia oferta
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *      - name: companyId
 *        in: query
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: No encontrada
 */
router.get("/:id/proposals/my", requireAuth, requireRole(["EMPRESA"]), getMyProposalHandler);
/**
 * @openapi
 * /api/tenders/{id}/awarded-info:
 *  get:
 *     tags: [Tenders - Resultado]
 *     summary: Empresa ganadora ve datos de contacto de los productores que hicieron pedido
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string, format: uuid }
 *      - name: companyId
 *        in: query
 *        required: true
 *        schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de productores con datos de contacto y tambo
 *       403:
 *         description: Solo la empresa ganadora puede acceder
 *       400:
 *         description: Resultado aún no publicado
 */
router.get("/:id/awarded-info", requireAuth, requireRole(["EMPRESA"]), getAwardedInfoHandler);
export default router;
