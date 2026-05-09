import type { Request, Response } from "express";
import { z } from "zod";
import { createProduct, getAllProducts, updateProduct, deleteProduct, removeProductImage } from "../services/product.service.js";
import { uploadImage } from "../services/cloudinary.service.js";

const createProductSchema = z.object({
    producerId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    price: z.coerce.number().positive(),
    unit: z.string().min(1),
    location: z.string().min(1),
});

export async function createProductHandler(req: Request, res: Response) {
    try {
        let imageUrls: string[] = [];

        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                const dataURI = "data:" + file.mimetype + ";base64," + b64;
                // Upload explicitly to a products folder
                const uploadedUrl = await uploadImage(dataURI, "tambo_products");
                imageUrls.push(uploadedUrl);
            }
        }

        const parsed = createProductSchema.parse(req.body);

        const product = await createProduct({
            ...parsed,
            images: imageUrls,
        });

        return res.status(201).json(product);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("createProductHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getAllProductsHandler(_req: Request, res: Response) {
    try {
        const products = await getAllProducts();
        return res.status(200).json(products);
    } catch (err: any) {
        console.error("getAllProductsHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const updateProductSchema = z.object({
    producerId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    unit: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    isAvailable: z.coerce.boolean().optional(),
});

export async function updateProductHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        let imageUrls: string[] = [];

        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                const dataURI = "data:" + file.mimetype + ";base64," + b64;
                const uploadedUrl = await uploadImage(dataURI, "tambo_products");
                imageUrls.push(uploadedUrl);
            }
        }

        const parsed = updateProductSchema.parse(req.body);

        const product = await updateProduct({
            id,
            ...parsed,
            ...(req.files && Array.isArray(req.files) && req.files.length > 0 ? { images: imageUrls } : {}),
        }, req.user);

        return res.status(200).json(product);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("updateProductHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteProductHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const result = await deleteProduct(id, req.user);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("deleteProductHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

const removeImageSchema = z.object({
    imageUrl: z.string().url(),
});

export async function removeProductImageHandler(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const parsed = removeImageSchema.parse(req.body);

        const result = await removeProductImage(id, parsed.imageUrl, req.user);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err?.status && err?.message) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.issues) {
            return res.status(400).json({ error: "Validation error", details: err.issues });
        }
        console.error("removeProductImageHandler:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}


