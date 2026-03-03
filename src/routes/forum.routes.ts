import { Router } from "express";
import {
    createPostHandler,
    getPostsHandler,
    getPostByIdHandler,
    updatePostHandler,
    deletePostHandler,
    createCommentHandler,
    updateCommentHandler,
    deleteCommentHandler
} from "../controller/forum.controller.js";

const router = Router();

/**
 * @openapi
 * components:
 *  schemas:
 *    PostInput:
 *      type: object
 *      required:
 *        - authorId
 *        - title
 *        - content
 *        - category
 *      properties:
 *        authorId:
 *          type: string
 *          format: uuid
 *          description: ID del Autor (Usuario)
 *        title:
 *          type: string
 *          example: "¿Cómo mejorar el rendimiento del tambo en verano?"
 *        content:
 *          type: string
 *          example: "Tengo un sistema pastoril y en verano noto una caída grande..."
 *        category:
 *          type: string
 *          example: "Nutrición"
 *    CommentInput:
 *      type: object
 *      required:
 *        - authorId
 *        - content
 *      properties:
 *        authorId:
 *          type: string
 *          format: uuid
 *        content:
 *          type: string
 *          example: "Yo te diría que pruebes suplementando con..."
 *        parentId:
 *          type: string
 *          format: uuid
 *          description: ID del comentario al que responde (opcional)
 */

/**
 * @openapi
 * /api/forum/posts:
 *  post:
 *     tags:
 *     - Forum
 *     summary: Create a new publication
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *         schema:
 *           $ref: '#/components/schemas/PostInput'
 *     responses:
 *       201:
 *         description: Created Post successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/posts", createPostHandler);

/**
 * @openapi
 * /api/forum/posts:
 *  get:
 *     tags:
 *     - Forum
 *     summary: Get all publications
 *     parameters:
 *      - in: query
 *        name: category
 *        schema:
 *          type: string
 *        description: Filtra posteos por categoria
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Internal server error
 */
router.get("/posts", getPostsHandler);

/**
 * @openapi
 * /api/forum/posts/{id}:
 *  get:
 *     tags:
 *     - Forum
 *     summary: Get a standard publication by ID with its nested comments
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
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
router.get("/posts/:id", getPostByIdHandler);

/**
 * @openapi
 * /api/forum/posts/{id}:
 *  put:
 *     tags:
 *     - Forum
 *     summary: Update an existing publication
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
 *             title:
 *               type: string
 *             content:
 *               type: string
 *             category:
 *               type: string
 *     responses:
 *       200:
 *         description: Successfully updated Post
 *       400:
 *         description: Validation error
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
router.put("/posts/:id", updatePostHandler);

/**
 * @openapi
 * /api/forum/posts/{id}:
 *  delete:
 *     tags:
 *     - Forum
 *     summary: Soft delete an existing publication
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Successfully deleted Post
 *       404:
 *         description: Post not found
 *       500:
 *         description: Internal server error
 */
router.delete("/posts/:id", deletePostHandler);


/**
 * @openapi
 * /api/forum/posts/{postId}/comments:
 *  post:
 *     tags:
 *     - Forum
 *     summary: Create a new comment on a publication
 *     parameters:
 *      - name: postId
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
 *           $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       201:
 *         description: Created Comment successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/posts/:postId/comments", createCommentHandler);

/**
 * @openapi
 * /api/forum/comments/{id}:
 *  put:
 *     tags:
 *     - Forum
 *     summary: Update an existing comment
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
 *             content:
 *               type: string
 *     responses:
 *       200:
 *         description: Successfully updated Comment
 *       400:
 *         description: Validation error
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.put("/comments/:id", updateCommentHandler);

/**
 * @openapi
 * /api/forum/comments/{id}:
 *  delete:
 *     tags:
 *     - Forum
 *     summary: Soft delete an existing comment
 *     parameters:
 *      - name: id
 *        in: path
 *        required: true
 *        schema:
 *          type: string
 *          format: uuid
 *     responses:
 *       200:
 *         description: Successfully deleted Comment
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.delete("/comments/:id", deleteCommentHandler);


export default router;
