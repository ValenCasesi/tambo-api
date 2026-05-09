import prisma from "../prisma/client.js";
import { EntityStatus } from "@prisma/client";
import { sendMail, buildHtmlTemplate } from "./email.service.js";

export async function createPost(data: { authorId: string; title: string; content: string; category: string }) {
    return await prisma.forumPost.create({
        data: {
            ...data,
            status: EntityStatus.ACTIVE
        }
    });
}

export async function getPosts(filters?: { category?: string }) {
    const where: any = { status: EntityStatus.ACTIVE };
    if (filters?.category) {
        where.category = filters.category;
    }

    return await prisma.forumPost.findMany({
        where,
        include: {
            author: { select: { id: true, firstName: true, lastName: true, imageUrl: true } },
            _count: { select: { comments: { where: { status: EntityStatus.ACTIVE } } } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getPostById(id: string) {
    return await prisma.forumPost.findUnique({
        where: { id, status: EntityStatus.ACTIVE },
        include: {
            author: { select: { id: true, firstName: true, lastName: true, imageUrl: true } },
            comments: {
                where: { status: EntityStatus.ACTIVE, parentId: null },
                include: {
                    author: { select: { id: true, firstName: true, lastName: true, imageUrl: true } },
                    replies: {
                        where: { status: EntityStatus.ACTIVE },
                        include: {
                            author: { select: { id: true, firstName: true, lastName: true, imageUrl: true } }
                        },
                        orderBy: { createdAt: 'asc' }
                    }
                },
                orderBy: { createdAt: 'asc' }
            }
        }
    });
}

export async function updatePost(id: string, data: Partial<{ title: string; content: string; category: string }>) {
    return await prisma.forumPost.update({
        where: { id },
        data
    });
}

export async function deletePost(id: string) {
    return await prisma.forumPost.update({
        where: { id },
        data: { status: EntityStatus.DELETED }
    });
}

export async function createComment(data: { postId: string; authorId: string; content: string; parentId?: string }) {
    const comment = await prisma.forumComment.create({
        data: {
            ...data,
            status: EntityStatus.ACTIVE
        }
    });

    try {
        const commenter = await prisma.user.findUnique({ where: { id: data.authorId } });
        
        let targetUser = null;
        let postTitle = "";

        if (data.parentId) {
            // It's a reply to a comment. Find the parent comment's author.
            const parentComment = await prisma.forumComment.findUnique({
                where: { id: data.parentId },
                include: { author: true, post: true }
            });
            if (parentComment && parentComment.authorId !== data.authorId) {
                targetUser = parentComment.author;
                postTitle = parentComment.post.title;
            }
        } else {
            // It's a direct reply to the post. Find the post's author.
            const post = await prisma.forumPost.findUnique({
                where: { id: data.postId },
                include: { author: true }
            });
            if (post && post.authorId !== data.authorId) {
                targetUser = post.author;
                postTitle = post.title;
            }
        }

        if (targetUser && commenter) {
            const subject = "Alguien ha respondido a tu consulta en Sinergia Plataforma";
            const excerpt = data.content.length > 100 ? data.content.substring(0, 100) + "..." : data.content;
            
            const html = buildHtmlTemplate({
                title: "Nueva Respuesta en el Foro",
                messageLines: [
                    `Hola ${targetUser.firstName},`,
                    `El usuario ${commenter.firstName} ${commenter.lastName} ha respondido a tu consulta "${postTitle}" en el foro.`,
                    `<b>Mensaje:</b> "${excerpt}"`,
                    `Ingresa a la plataforma para ver la respuesta completa y continuar la conversación.`
                ],
                buttonText: "Ver Respuesta",
                buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
            });

            sendMail(targetUser.email, subject, "Alguien ha respondido a tu consulta en Sinergia Plataforma", html)
                .catch(err => console.error(`Error enviando email a ${targetUser.email}:`, err));
        }
    } catch (err) {
        console.error("Error procesando notificacion de comentario:", err);
    }

    return comment;
}

export async function updateComment(id: string, data: Partial<{ content: string }>) {
    return await prisma.forumComment.update({
        where: { id },
        data
    });
}

export async function deleteComment(id: string) {
    // Delete replies first to avoid FK constraints
    await prisma.forumComment.deleteMany({
        where: { parentId: id }
    });
    
    // Then delete the actual comment
    return await prisma.forumComment.delete({
        where: { id }
    });
}
