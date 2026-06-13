import prisma from "../prisma/client.js";
import { deleteImage } from "./cloudinary.service.js";

type CreateProductInput = {
    producerId: string;
    name: string;
    description: string;
    category: string;
    price: number;
    priceCurrency: "ARS" | "USD";
    unit: string;
    location: string;
    images: string[];
};

export async function createProduct(input: CreateProductInput) {
    const { producerId, name, description, category, price, priceCurrency, unit, location, images } = input;

    if (images && images.length > 3) {
        throw { status: 400, message: "Un producto puede tener un máximo de 3 imágenes" };
    }

    // Optional: Verify if the user exists and is a producer
    const producer = await prisma.user.findUnique({ where: { id: producerId } });
    if (!producer) throw { status: 404, message: "Producer not found" };

    const product = await prisma.marketplaceProduct.create({
        data: {
            producerId,
            name,
            description,
            category,
            price,
            priceCurrency,
            unit,
            location,
            images, // Array of URLs stored as JSON
        } as any,
    });

    return product;
}

export async function getAllProducts() {
    // Only return products that are active and available.
    // We also include basic info about the producer to show in the UI.
    const products = await prisma.marketplaceProduct.findMany({
        where: {
            status: "ACTIVE",
            isAvailable: true,
            producer: {
                status: "ACTIVE" // The producer must also be active
            }
        },
        include: {
            producer: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    imageUrl: true,
                    phone: true
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return products;
}

type UpdateProductInput = {
    id: string;
    producerId?: string;
    name?: string;
    description?: string;
    category?: string;
    price?: number;
    priceCurrency?: "ARS" | "USD";
    unit?: string;
    location?: string;
    images?: string[];
    isAvailable?: boolean;
};

export async function updateProduct(input: UpdateProductInput, actor?: { id: string; role: string }) {
    const { id, images, ...rest } = input;

    const existing = await prisma.marketplaceProduct.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Product not found" };

    if (actor && actor.role === "PRODUCTOR" && existing.producerId !== actor.id) {
        throw { status: 403, message: "No puedes modificar productos de otros productores" };
    }

    // If new images arrive, concatenate them to the current ones. We typecast as an array of strings since Prisma assumes Json.
    const currentImages = Array.isArray(existing.images) ? (existing.images as string[]) : [];

    if (images && currentImages.length + images.length > 3) {
        throw { status: 400, message: "Un producto puede tener un máximo de 3 imágenes" };
    }

    const updatedImages = images && images.length > 0 ? [...currentImages, ...images] : currentImages;

    const updated = await prisma.marketplaceProduct.update({
        where: { id },
        data: {
            ...rest,
            images: updatedImages,
        } as any,
    });

    return updated;
}

export async function deleteProduct(id: string, actor?: { id: string; role: string }) {
    const existing = await prisma.marketplaceProduct.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Product not found" };
    if (existing.status === "DELETED") throw { status: 400, message: "Product is already deleted" };

    if (actor && actor.role === "PRODUCTOR" && existing.producerId !== actor.id) {
        throw { status: 403, message: "No puedes eliminar productos de otros productores" };
    }

    const deleted = await prisma.marketplaceProduct.update({
        where: { id },
        data: { status: "DELETED" }
    });

    return deleted;
}

export async function removeProductImage(id: string, imageUrl: string, actor?: { id: string; role: string }) {
    const existing = await prisma.marketplaceProduct.findUnique({ where: { id } });
    if (!existing) throw { status: 404, message: "Product not found" };

    if (actor && actor.role === "PRODUCTOR" && existing.producerId !== actor.id) {
        throw { status: 403, message: "No puedes modificar productos de otros productores" };
    }

    const currentImages = Array.isArray(existing.images) ? (existing.images as string[]) : [];

    // Check if the image exists in the product
    if (!currentImages.includes(imageUrl)) {
        throw { status: 400, message: "Image not found on this product" };
    }

    // Filter out the image
    const updatedImages = currentImages.filter(img => img !== imageUrl);

    // Call Cloudinary delete
    await deleteImage(imageUrl);

    // Update the DB
    const updated = await prisma.marketplaceProduct.update({
        where: { id },
        data: { images: updatedImages }
    });

    return updated;
}

