import { z } from "zod";
import * as forumService from "../services/forum.service.js";
const postSchema = z.object({
    authorId: z.string().uuid("El authorId debe ser un UUID válido"),
    title: z.string().min(1, "El título es requerido"),
    content: z.string().min(1, "El contenido es requerido"),
    category: z.string().min(1, "La categoría es requerida")
});
const postUpdateSchema = postSchema.omit({ authorId: true }).partial();
const commentSchema = z.object({
    authorId: z.string().uuid("El authorId debe ser un UUID válido"),
    content: z.string().min(1, "El contenido es requerido"),
    parentId: z.string().uuid("El parentId debe ser un UUID válido").optional()
});
const commentUpdateSchema = z.object({
    content: z.string().min(1, "El contenido es requerido")
});
export async function createPostHandler(req, res) {
    try {
        const parsed = postSchema.parse(req.body);
        const post = await forumService.createPost(parsed);
        return res.status(201).json(post);
    }
    catch (err) {
        if (err?.issues)
            return res.status(400).json({ error: "Error de validación", details: err.issues });
        console.error("createPostHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getPostsHandler(req, res) {
    try {
        const category = req.query.category;
        const posts = await forumService.getPosts({ category });
        return res.status(200).json(posts);
    }
    catch (err) {
        console.error("getPostsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function getPostByIdHandler(req, res) {
    try {
        const id = req.params.id;
        const post = await forumService.getPostById(id);
        if (!post)
            return res.status(404).json({ error: "Post no encontrado" });
        return res.status(200).json(post);
    }
    catch (err) {
        console.error("getPostByIdHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function updatePostHandler(req, res) {
    try {
        const id = req.params.id;
        const parsed = postUpdateSchema.parse(req.body);
        const post = await forumService.updatePost(id, parsed);
        return res.status(200).json(post);
    }
    catch (err) {
        if (err?.code === 'P2025')
            return res.status(404).json({ error: "Post no encontrado" });
        if (err?.issues)
            return res.status(400).json({ error: "Error de validación", details: err.issues });
        console.error("updatePostHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function deletePostHandler(req, res) {
    try {
        const id = req.params.id;
        await forumService.deletePost(id);
        return res.status(200).json({ message: "Post eliminado exitosamente" });
    }
    catch (err) {
        if (err?.code === 'P2025')
            return res.status(404).json({ error: "Post no encontrado" });
        console.error("deletePostHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function createCommentHandler(req, res) {
    try {
        const postId = req.params.postId;
        const parsed = commentSchema.parse(req.body);
        const comment = await forumService.createComment({ ...parsed, postId });
        return res.status(201).json(comment);
    }
    catch (err) {
        if (err?.issues)
            return res.status(400).json({ error: "Error de validación", details: err.issues });
        console.error("createCommentHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function updateCommentHandler(req, res) {
    try {
        const id = req.params.id;
        const parsed = commentUpdateSchema.parse(req.body);
        const comment = await forumService.updateComment(id, parsed);
        return res.status(200).json(comment);
    }
    catch (err) {
        if (err?.code === 'P2025')
            return res.status(404).json({ error: "Comentario no encontrado" });
        if (err?.issues)
            return res.status(400).json({ error: "Error de validación", details: err.issues });
        console.error("updateCommentHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
export async function deleteCommentHandler(req, res) {
    try {
        const id = req.params.id;
        await forumService.deleteComment(id);
        return res.status(200).json({ message: "Comentario eliminado exitosamente" });
    }
    catch (err) {
        if (err?.code === 'P2025')
            return res.status(404).json({ error: "Comentario no encontrado" });
        console.error("deleteCommentHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
