import { PrismaClient } from "@prisma/client";
import "dotenv/config"; // carga .env antes de crear PrismaClient
// Pasar un objeto vacío evita el error "needs to be constructed with a non-empty, valid PrismaClientOptions"
const prisma = new PrismaClient({});
export default prisma;
