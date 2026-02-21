import prisma from "../prisma/client.js";
import { hashPassword } from "./auth.service.js";
export async function createUser(input) {
    const { email, cuit, password, role = "PRODUCTOR", firstName, lastName, phone, imageUrl } = input;
    // check email uniqueness
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail)
        throw { status: 409, message: "Email already in use" };
    // check cuit uniqueness if provided
    if (cuit) {
        const existingByCuit = await prisma.user.findUnique({ where: { cuit } });
        if (existingByCuit)
            throw { status: 409, message: "CUIT already in use" };
    }
    const hashed = await hashPassword(password);
    const created = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email,
            password: hashed,
            role: role,
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
export async function updateUser(input) {
    const { id, email, cuit, password, role, firstName, lastName, phone, imageUrl } = input;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "User not found" };
    if (email && email !== existing.email) {
        const existingByEmail = await prisma.user.findUnique({ where: { email } });
        if (existingByEmail)
            throw { status: 409, message: "Email already in use" };
    }
    if (cuit && cuit !== existing.cuit) {
        const existingByCuit = await prisma.user.findUnique({ where: { cuit } });
        if (existingByCuit)
            throw { status: 409, message: "CUIT already in use" };
    }
    let hashed;
    if (password) {
        hashed = await hashPassword(password);
    }
    const updated = await prisma.user.update({
        where: { id },
        data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(email && { email }),
            ...(phone !== undefined && { phone }),
            ...(cuit !== undefined && { cuit }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(role && { role: role }),
            ...(hashed && { password: hashed }),
        },
    });
    // remove password from returned object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = updated;
    return safe;
}
export async function getAllUsers() {
    const users = await prisma.user.findMany({
        where: {
            status: {
                not: "DELETED"
            }
        }
    });
    return users.map((u) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pwd, ...safe } = u;
        return safe;
    });
}
export async function deleteUser(id) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "User not found" };
    if (existing.status === "DELETED")
        throw { status: 400, message: "User is already deleted" };
    // Realizamos un borrado lógico (soft-delete) modificando el status 
    // para evitar errores de Foreign Key Constraint con tablas relacionadas (Tambos, Foros, etc)
    const deleted = await prisma.user.update({
        where: { id },
        data: { status: "DELETED" }
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = deleted;
    return safe;
}
