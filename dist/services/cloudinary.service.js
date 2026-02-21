import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
});
export async function uploadImage(dataURIorPath, folder = "tamo_users") {
    try {
        const result = await cloudinary.uploader.upload(dataURIorPath, {
            folder,
        });
        return result.secure_url;
    }
    catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Error uploading image to Cloudinary");
    }
}
