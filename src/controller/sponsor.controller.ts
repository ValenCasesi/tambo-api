import type { Request, Response } from "express";
import { z } from "zod";
import { EntityStatus } from "@prisma/client";
import { uploadImage } from "../services/cloudinary.service.js";
import { createSponsor, getAllSponsors, getSponsorById, updateSponsor, deleteSponsor } from "../services/sponsor.service.js";

const createSponsorSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().optional(),
    youtubeUrl: z.string().url().optional().or(z.literal("")),
});

export async function createSponsorHandler(req: Request, res: Response) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "La imagen es obligatoria" });
        }

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        // Upload to Cloudinary in a sponsors folder
        const uploadedUrl = await uploadImage(dataURI, "tambo_sponsors");

        const parsed = createSponsorSchema.parse(req.body);

        const sponsor = await createSponsor({
            ...parsed,
            imageUrl: uploadedUrl
        });

        return res.status(201).json(sponsor);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("createSponsorHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getAllSponsorsHandler(_req: Request, res: Response) {
    try {
        const sponsors = await getAllSponsors();
        return res.status(200).json(sponsors);
    } catch (err: any) {
        console.error("getAllSponsorsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getSponsorByIdHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const sponsor = await getSponsorById(id);
        return res.status(200).json(sponsor);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("getSponsorByIdHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const updateSponsorSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    youtubeUrl: z.string().url().optional().or(z.literal("")),
    status: z.nativeEnum(EntityStatus).optional(),
});

export async function updateSponsorHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        let imageUrl: string | undefined = undefined;

        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            imageUrl = await uploadImage(dataURI, "tambo_sponsors");
        }

        const parsed = updateSponsorSchema.parse(req.body);

        const sponsor = await updateSponsor({
            id,
            ...parsed,
            ...(imageUrl ? { imageUrl } : {}),
        });

        return res.status(200).json(sponsor);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("updateSponsorHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteSponsorHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const result = await deleteSponsor(id);
        return res.status(200).json({ message: "Sponsor eliminado exitosamente", sponsor: result });
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteSponsorHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
