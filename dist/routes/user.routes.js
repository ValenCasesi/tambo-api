import { Router } from "express";
import { createUserHandler, updateUserHandler, getAllUsersHandler, deleteUserHandler, getPendingUsersHandler, approveUserHandler, rejectUserHandler, reactivateUserHandler } from "../controller/user.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
const router = Router();
/**
 * @openapi
 * components:
 *  schemas:
 *    UserResponse:
 *      type: object
 *      properties:
 *        id:
 *          type: string
 *          description: The user ID
 *        firstName:
 *          type: string
 *        lastName:
 *          type: string
 *        email:
 *          type: string
 *        role:
 *          type: string
 *        cuit:
 *          type: string
 *          nullable: true
 *        razonSocial:
 *          type: string
 *          nullable: true
 *        localidad:
 *          type: string
 *          nullable: true
 *        imageUrl:
 *          type: string
 *          nullable: true
 */
/**
 * @openapi
 * /api/users:
 *  get:
 *     tags:
 *     - Users
 *     summary: Get all users (except pending by default)
 *     parameters:
 *      - in: query
 *        name: status
 *        schema:
 *          type: string
 *          enum: [ACTIVE, INACTIVE, DELETED, PENDING]
 *        required: false
 *        description: Filtrar por estado de usuario.
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *          application/json:
 *           schema:
 *            type: array
 *            items:
 *             $ref: '#/components/schemas/UserResponse'
 */
router.get("/", getAllUsersHandler);
/**
 * @openapi
 * /api/users/pending:
 *  get:
 *     tags:
 *     - Users
 *     summary: Obtener todos los usuarios pendientes de aprobación
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/pending", getPendingUsersHandler);
/**
 * @openapi
 * /api/users/{id}/approve:
 *  put:
 *     tags:
 *     - Users
 *     summary: Aprobar a un usuario pendiente (Admin)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string }
 *     responses:
 *       200:
 *         description: User activated successfully
 *       400:
 *         description: Not in PENDING status
 */
router.put("/:id/approve", approveUserHandler);
/**
 * @openapi
 * /api/users/{id}/reject:
 *  put:
 *     tags:
 *     - Users
 *     summary: Rechazar a un usuario pendiente (Admin)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema: { type: string }
 *     responses:
 *       200:
 *         description: User rejected successfully
 *       400:
 *         description: Not in PENDING status
 */
router.put("/:id/reject", rejectUserHandler);
/**
 * @openapi
 * /api/users:
 *  post:
 *     tags:
 *     - Users
 *     summary: Create a new user
 *     requestBody:
 *      required: true
 *      content:
 *        multipart/form-data:
 *         schema:
 *          type: object
 *          properties:
 *            firstName:
 *              type: string
 *            lastName:
 *              type: string
 *            email:
 *              type: string
 *            password:
 *              type: string
 *            role:
 *              type: string
 *            cuit:
 *              type: string
 *            razonSocial:
 *              type: string
 *            localidad:
 *              type: string
 *            image:
 *              type: string
 *              format: binary
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Conflict (Email/CUIT in use)
 */
router.post("/", upload.single("image"), createUserHandler);
/**
 * @openapi
 * /api/users/{id}:
 *  put:
 *     tags:
 *     - Users
 *     summary: Update an existing user
 *     parameters:
 *      - name: id
 *        in: path
 *        description: The user ID
 *        required: true
 *        schema:
 *          type: string
 *     requestBody:
 *      required: false
 *      content:
 *        multipart/form-data:
 *         schema:
 *          type: object
 *          properties:
 *            firstName:
 *              type: string
 *            lastName:
 *              type: string
 *            role:
 *              type: string
 *            cuit:
 *              type: string
 *            razonSocial:
 *              type: string
 *            localidad:
 *              type: string
 *            image:
 *              type: string
 *              format: binary
 *     responses:
 *       200:
 *         description: Updated successfully
 *       404:
 *         description: User not found
 */
router.put("/:id", upload.single("image"), updateUserHandler);
/**
 * @openapi
 * /api/users/{id}:
 *  delete:
 *     tags:
 *     - Users
 *     summary: Soft delete (suspend) a user
 *     parameters:
 *      - name: id
 *        in: path
 *        description: The user ID
 *        required: true
 *        schema:
 *          type: string
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       400:
 *         description: User is already deleted
 *       404:
 *         description: User not found
 */
router.delete("/:id", deleteUserHandler);
/**
 * @openapi
 * /api/users/{id}/reactivate:
 *  put:
 *     tags:
 *     - Users
 *     summary: Reactivar un usuario suspendido/eliminado
 *     parameters:
 *      - name: id
 *        in: path
 *        description: The user ID
 *        required: true
 *        schema:
 *          type: string
 *     responses:
 *       200:
 *         description: User reactivated successfully
 *       400:
 *         description: User is already active
 *       404:
 *         description: User not found
 */
router.put("/:id/reactivate", reactivateUserHandler);
export default router;
