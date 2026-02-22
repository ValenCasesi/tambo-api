import { EntityStatus } from "@prisma/client";
import prisma from "../prisma/client.js";

type CreateSponsorInput = {
    name: string;
    description?: string;
    imageUrl: string;
    youtubeUrl?: string;
};

export async function createSponsor(input: CreateSponsorInput) {
    return prisma.sponsor.create({
        data: input
    });
}

export async function getAllSponsors() {
    return prisma.sponsor.findMany({
        where: { status: EntityStatus.ACTIVE },
        orderBy: { createdAt: "desc" }
    });
}

export async function getSponsorById(id: string) {
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) throw { status: 404, message: "Sponsor no encontrado" };
    return sponsor;
}

type UpdateSponsorInput = {
    id: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    youtubeUrl?: string;
    status?: EntityStatus;
};

export async function updateSponsor(input: UpdateSponsorInput) {
    const { id, ...data } = input;

    // Check if exists
    await getSponsorById(id);

    return prisma.sponsor.update({
        where: { id },
        data
    });
}

export async function deleteSponsor(id: string) {
    // Check if exists
    await getSponsorById(id);

    // Hard delete
    return prisma.sponsor.delete({
        where: { id }
    });
}
