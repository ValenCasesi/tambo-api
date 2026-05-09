import prisma from "../prisma/client.js";
import { deleteImage } from "./cloudinary.service.js";
export async function createProduct(input) {
    const { producerId, name, description, category, price, unit, location, images } = input;
    if (images && images.length > 3) {
        throw { status: 400, message: "Un producto puede tener un máximo de 3 imágenes" };
    }
    // Optional: Verify if the user exists and is a producer
    const producer = await prisma.user.findUnique({ where: { id: producerId } });
    if (!producer)
        throw { status: 404, message: "Producer not found" };
    const product = await prisma.marketplaceProduct.create({
        data: {
            producerId,
            name,
            description,
            category,
            price,
            unit,
            location,
            images, // Array of URLs stored as JSON
        },
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
export async function updateProduct(input) {
    const { id, images, ...rest } = input;
    const existing = await prisma.marketplaceProduct.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Product not found" };
    // If new images arrive, concatenate them to the current ones. We typecast as an array of strings since Prisma assumes Json.
    const currentImages = Array.isArray(existing.images) ? existing.images : [];
    if (images && currentImages.length + images.length > 3) {
        throw { status: 400, message: "Un producto puede tener un máximo de 3 imágenes" };
    }
    const updatedImages = images && images.length > 0 ? [...currentImages, ...images] : currentImages;
    const updated = await prisma.marketplaceProduct.update({
        where: { id },
        data: {
            ...rest,
            images: updatedImages,
        },
    });
    return updated;
}
export async function deleteProduct(id) {
    const existing = await prisma.marketplaceProduct.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Product not found" };
    if (existing.status === "DELETED")
        throw { status: 400, message: "Product is already deleted" };
    const deleted = await prisma.marketplaceProduct.update({
        where: { id },
        data: { status: "DELETED" }
    });
    return deleted;
}
export async function removeProductImage(id, imageUrl) {
    const existing = await prisma.marketplaceProduct.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "Product not found" };
    const currentImages = Array.isArray(existing.images) ? existing.images : [];
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
