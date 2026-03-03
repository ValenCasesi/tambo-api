import prisma from "../prisma/client.js";
import { EntityStatus } from "@prisma/client";
export async function createPost(data) {
    return await prisma.forumPost.create({
        data: {
            ...data,
            status: EntityStatus.ACTIVE
        }
    });
}
export async function getPosts(filters) {
    const where = { status: EntityStatus.ACTIVE };
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
export async function getPostById(id) {
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
export async function updatePost(id, data) {
    return await prisma.forumPost.update({
        where: { id },
        data
    });
}
export async function deletePost(id) {
    return await prisma.forumPost.update({
        where: { id },
        data: { status: EntityStatus.DELETED }
    });
}
export async function createComment(data) {
    return await prisma.forumComment.create({
        data: {
            ...data,
            status: EntityStatus.ACTIVE
        }
    });
}
export async function updateComment(id, data) {
    return await prisma.forumComment.update({
        where: { id },
        data
    });
}
export async function deleteComment(id) {
    return await prisma.forumComment.update({
        where: { id },
        data: { status: EntityStatus.DELETED }
    });
}
