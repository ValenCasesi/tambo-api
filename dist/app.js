import cors from "cors";
import express from "express";
import prisma from "./prisma/client.js";
import userRoutes from "./routes/user.routes.js";
import productRoutes from "./routes/product.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import authRoutes from "./routes/auth.routes.js";
import tamboRoutes from "./routes/tambo.routes.js";
import sponsorRoutes from "./routes/sponsor.routes.js";
import forumRoutes from "./routes/forum.routes.js";
import { swaggerDocs } from "./docs/swagger.js";
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/tambos", tamboRoutes);
app.use("/api/sponsors", sponsorRoutes);
app.use("/api/forum", forumRoutes);
app.get("/", (_req, res) => res.send("tampo-api OK"));
// Initialize swagger docs
swaggerDocs(app);
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, async () => {
        // Opcional: probá la conexión a la DB al arrancar
        try {
            await prisma.$connect();
            console.log(`Server running on http://localhost:${PORT}`);
        }
        catch (err) {
            console.error("Failed connecting to DB at startup:", err);
            process.exit(1);
        }
    });
}
export default app;
