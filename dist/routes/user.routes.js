import { Router } from "express";
import { createUserHandler, updateUserHandler, getAllUsersHandler, deleteUserHandler } from "../controller/user.controller.js";
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
 *     summary: Get all active users
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
 *     summary: Soft delete a user
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
export default router;
