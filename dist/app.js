import cors from "cors";
import express from "express";
import prisma from "./prisma/client.js";
import userRoutes from "./routes/user.routes.js";
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use("/api/users", userRoutes);
app.get("/", (_req, res) => res.send("tampo-api OK"));
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
