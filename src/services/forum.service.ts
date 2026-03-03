import prisma from "../prisma/client.js";
import { EntityStatus } from "@prisma/client";

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
    return await prisma.forumComment.create({
        data: {
            ...data,
            status: EntityStatus.ACTIVE
        }
    });
}

export async function updateComment(id: string, data: Partial<{ content: string }>) {
    return await prisma.forumComment.update({
        where: { id },
        data
    });
}

export async function deleteComment(id: string) {
    return await prisma.forumComment.update({
        where: { id },
        data: { status: EntityStatus.DELETED }
    });
}
