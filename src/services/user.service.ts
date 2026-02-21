import { Role } from "@prisma/client";
import prisma from "../prisma/client.js";
import { hashPassword } from "./auth.service.js";

type CreateUserInput = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: Role | string;
    phone?: string | null;
    cuit?: string | null;
    imageUrl?: string | null;
};

export async function createUser(input: CreateUserInput) {
    const { email, cuit, password, role = "PRODUCTOR", firstName, lastName, phone, imageUrl } = input;

    // check email uniqueness
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) throw { status: 409, message: "Email already in use" };

    // check cuit uniqueness if provided
    if (cuit) {
        const existingByCuit = await prisma.user.findUnique({ where: { cuit } });
        if (existingByCuit) throw { status: 409, message: "CUIT already in use" };
    }

    const hashed = await hashPassword(password);

    const created = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: hashed,
            role: role as Role,
            phone,
            cuit,
            imageUrl,
        },
    });

    // remove password from returned object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = created;
    return safe;
}