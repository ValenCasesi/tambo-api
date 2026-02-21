import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

export async function uploadImage(dataURIorPath: string, folder: string = "tambo_users") {
    try {
        const result = await cloudinary.uploader.upload(dataURIorPath, {
            folder,
        });
        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Error uploading image to Cloudinary");
    }
}

export async function deleteImage(imageUrl: string) {
    try {
        // Extract public ID from the Cloudinary URL
        // Example URL: https://res.cloudinary.com/.../upload/v12345/tambo_products/my_image.jpg
        const parts = imageUrl.split("/");
        const filenameWithExt = parts.pop() || "";
        const folder = parts.pop() || "";
        const filename = filenameWithExt.split(".")[0]; // remove extension

        const publicId = `${folder}/${filename}`;

        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error("Cloudinary delete error:", error);
        // We log the error but don't throw to avoid interrupting the user flow if the image was already deleted in Cloudinary
    }
}

