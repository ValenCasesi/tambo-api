import { Router } from "express";
import { loginHandler, logoutHandler, acceptTermsHandler } from "../controller/auth.controller.js";
const router = Router();
/**
 * @openapi
 * components:
 *  schemas:
 *    LoginInput:
 *      type: object
 *      required:
 *        - email
 *        - password
 *      properties:
 *        email:
 *          type: string
 *          format: email
 *          description: El correo electrónico del usuario
 *        password:
 *          type: string
 *          format: password
 *          description: La contraseña del usuario
 *    LoginResponse:
 *      type: object
 *      properties:
 *        token:
 *          type: string
 *          description: Token JWT para autenticación
 *        user:
 *          type: object
 *          properties:
 *            id:
 *              type: string
 *            email:
 *              type: string
 *            firstName:
 *              type: string
 *            lastName:
 *              type: string
 *            role:
 *              type: string
 */
/**
 * @openapi
 * /api/auth/login:
 *  post:
 *     tags:
 *     - Auth
 *     summary: Iniciar sesión y obtener un token JWT
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *           $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Error de validación
 *       401:
 *         description: Credenciales inválidas
 *       403:
 *         description: Usuario deshabilitado
 *       500:
 *         description: Error de servidor
 */
router.post("/login", loginHandler);
/**
 * @openapi
 * /api/auth/logout:
 *  post:
 *     tags:
 *     - Auth
 *     summary: Cerrar sesión (invalidar el token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 *       500:
 *         description: Error de servidor
 */
router.post("/logout", logoutHandler);
/**
 * @openapi
 * /api/auth/accept-terms:
 *  put:
 *     tags:
 *     - Auth
 *     summary: Aceptar Términos y Condiciones
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              userId:
 *                type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.put("/accept-terms", acceptTermsHandler);
export default router;
