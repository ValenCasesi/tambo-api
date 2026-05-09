import { Router } from "express";
import { createProductHandler, getAllProductsHandler, updateProductHandler, deleteProductHandler, removeProductImageHandler } from "../controller/product.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @openapi
 * components:
 *  schemas:
 *    ProducerSnippet:
 *      type: object
 *      properties:
 *        id:
 *          type: string
 *        firstName:
 *          type: string
 *        lastName:
 *          type: string
 *        imageUrl:
 *          type: string
 *          nullable: true
 *        phone:
 *          type: string
 *          nullable: true
 *    ProductResponse:
 *      type: object
 *      properties:
 *        id:
 *          type: string
 *        producerId:
 *          type: string
 *        name:
 *          type: string
 *        description:
 *          type: string
 *        category:
 *          type: string
 *        price:
 *          type: number
 *        unit:
 *          type: string
 *        images:
 *          type: array
 *          items:
 *            type: string
 *        location:
 *          type: string
 *        isAvailable:
 *          type: boolean
 *        status:
 *          type: string
 *        createdAt:
 *          type: string
 *          format: date-time
 *        updatedAt:
 *          type: string
 *          format: date-time
 *        producer:
 *          $ref: '#/components/schemas/ProducerSnippet'
 */

/**
 * @openapi
 * /api/products:
 *  get:
 *     tags:
 *     - Marketplace
 *     summary: Get all published marketplace products
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductResponse'
 */
router.get("/", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), getAllProductsHandler);

/**
 * @openapi
 * /api/products:
 *  post:
 *     tags:
 *     - Marketplace
 *     summary: Create a newly published product for the Marketplace
 *     requestBody:
 *      required: true
 *      content:
 *        multipart/form-data:
 *         schema:
 *          type: object
 *          properties:
 *            producerId:
 *              type: string
 *              description: The product owner (user ID)
 *            name:
 *              type: string
 *            description:
 *              type: string
 *            category:
 *              type: string
 *            price:
 *              type: number
 *            unit:
 *              type: string
 *            location:
 *              type: string
 *            image:
 *              type: array
 *              items:
 *                type: string
 *                format: binary
 *              description: Up to 3 product images to upload to Cloudinary
 *     responses:
 *       201:
 *         description: Created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Producer not found
 */
router.post("/", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), upload.array("image", 3), createProductHandler);

/**
 * @openapi
 * /api/products/{id}:
 *  put:
 *     tags:
 *     - Marketplace
 *     summary: Update an existing product
 *     parameters:
 *      - name: id
 *        in: path
 *        description: The product ID
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
 *            name:
 *              type: string
 *            description:
 *              type: string
 *            category:
 *              type: string
 *            price:
 *              type: number
 *            unit:
 *              type: string
 *            location:
 *              type: string
 *            isAvailable:
 *              type: boolean
 *            image:
 *              type: array
 *              items:
 *                type: string
 *                format: binary
 *              description: Up to 3 product images to upload to Cloudinary
 *     responses:
 *       200:
 *         description: Updated successfully
 *       404:
 *         description: Product not found
 */
router.put("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), upload.array("image", 3), updateProductHandler);

/**
 * @openapi
 * /api/products/{id}:
 *  delete:
 *     tags:
 *     - Marketplace
 *     summary: Soft delete a product
 *     parameters:
 *      - name: id
 *        in: path
 *        description: The product ID
 *        required: true
 *        schema:
 *          type: string
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       400:
 *         description: Product is already deleted
 *       404:
 *         description: Product not found
 */
router.delete("/:id", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), deleteProductHandler);

/**
 * @openapi
 * /api/products/{id}/images:
 *  delete:
 *     tags:
 *     - Marketplace
 *     summary: Remove a specific image from a product
 *     parameters:
 *      - name: id
 *        in: path
 *        description: The product ID
 *        required: true
 *        schema:
 *          type: string
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *          type: object
 *          properties:
 *            imageUrl:
 *              type: string
 *              description: The exact URL of the image to remove
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       400:
 *         description: Validation error or image not found on product
 *       404:
 *         description: Product not found
 */
router.delete("/:id/images", requireAuth, requireRole(["ADMIN", "PRODUCTOR"]), removeProductImageHandler);

export default router;

