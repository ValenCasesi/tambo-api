import { Router } from "express";
import {
    createSponsorHandler,
    getAllSponsorsHandler,
    getSponsorByIdHandler,
    updateSponsorHandler,
    deleteSponsorHandler
} from "../controller/sponsor.controller.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

/**
 * @openapi
 * components:
 *  schemas:
 *    Sponsor:
 *      type: object
 *      properties:
 *        id:
 *          type: string
 *          format: uuid
 *        name:
 *          type: string
 *        description:
 *          type: string
 *        imageUrl:
 *          type: string
 *        youtubeUrl:
 *          type: string
 *        status:
 *          type: string
 *          enum: [ACTIVE, INACTIVE, DELETED]
 *        createdAt:
 *          type: string
 *          format: date-time
 *        updatedAt:
 *          type: string
 *          format: date-time
 */

/**
 * @openapi
 * /api/sponsors:
 *  post:
 *     tags:
 *     - Sponsors
 *     summary: Create a new Sponsor
 *     requestBody:
 *      required: true
 *      content:
 *        multipart/form-data:
 *          schema:
 *            type: object
 *            required:
 *              - name
 *              - image
 *            properties:
 *              name:
 *                type: string
 *              description:
 *                type: string
 *              youtubeUrl:
 *                type: string
 *              image:
 *                type: string
 *                format: binary
 *     responses:
 *       201:
 *         description: Sponsor created
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/", upload.single("image"), createSponsorHandler);

/**
 * @openapi
 * /api/sponsors:
 *  get:
 *     tags:
 *     - Sponsors
 *     summary: Get all active Sponsors
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sponsor'
 *       500:
 *         description: Internal server error
 */
router.get("/", getAllSponsorsHandler);

/**
 * @openapi
 * /api/sponsors/{id}:
 *  get:
 *     tags:
 *     - Sponsors
 *     summary: Get a Sponsor by ID
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sponsor'
 *       404:
 *         description: Sponsor not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", getSponsorByIdHandler);

/**
 * @openapi
 * /api/sponsors/{id}:
 *  put:
 *     tags:
 *     - Sponsors
 *     summary: Update an existing Sponsor
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     requestBody:
 *      content:
 *        multipart/form-data:
 *          schema:
 *            type: object
 *            properties:
 *              name:
 *                type: string
 *              description:
 *                type: string
 *              youtubeUrl:
 *                type: string
 *              status:
 *                type: string
 *                enum: [ACTIVE, INACTIVE, DELETED]
 *              image:
 *                type: string
 *                format: binary
 *     responses:
 *       200:
 *         description: Successfully updated Sponsor
 *       400:
 *         description: Validation error
 *       404:
 *         description: Sponsor not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", upload.single("image"), updateSponsorHandler);

/**
 * @openapi
 * /api/sponsors/{id}:
 *  delete:
 *     tags:
 *     - Sponsors
 *     summary: Delete a Sponsor (Hard delete)
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Successfully deleted Sponsor
 *       404:
 *         description: Sponsor not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", deleteSponsorHandler);

export default router;
