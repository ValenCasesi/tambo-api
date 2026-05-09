import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../prisma/client.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

export interface AuthPayload {
    userId: string;
    role: string;
    email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        email: string;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Acceso no autorizado. Token faltante o inválido." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
        
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, role: true, status: true, email: true }
        });

        if (!user || user.status !== "ACTIVE") {
            return res.status(401).json({ error: "Usuario inactivo o no encontrado." });
        }

        req.user = {
            id: user.id,
            role: user.role as Role,
            email: user.email
        };

        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido o expirado." });
    }
};

export const requireRole = (allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ error: "No autenticado" });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "No tienes permisos para realizar esta acción" });
        }

        next();
    };
};
