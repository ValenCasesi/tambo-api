import prisma from "../prisma/client.js";
import { hashPassword } from "./auth.service.js";
import { sendMail } from "./email.service.js";
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
    // Asignar PENDING por defecto a Productores o Empresas
    const isPending = role === "PRODUCTOR" || role === "EMPRESA";
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
            status: isPending ? "PENDING" : "ACTIVE"
        },
    });
    if (isPending) {
        sendMail("admin@tamo.com", "Nueva Solicitud de Registro - TAMO", `Hola Admin,\n\nUn nuevo usuario acaba de registrarse y espera tu aprobación para ingresar.\n\nNombre: ${firstName} ${lastName}\nRol: ${role}\nEmail: ${email}\n\nIngresá al panel administrativo para aprobarlo.\n`).catch(err => console.error("Error firing admin register check email:", err));
    }
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
export async function getPendingUsers() {
    const users = await prisma.user.findMany({
        where: {
            status: "PENDING"
        }
    });
    return users.map((u) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pwd, ...safe } = u;
        return safe;
    });
}
export async function approveUser(id) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "User not found" };
    if (existing.status !== "PENDING")
        throw { status: 400, message: "User is not in PENDING status" };
    const approved = await prisma.user.update({
        where: { id },
        data: { status: "ACTIVE" }
    });
    sendMail(existing.email, "¡Bienvenido a TAMO! Tu cuenta ha sido activada", `Hola ${existing.firstName},\n\nTenemos el agrado de informarte que el administrador validó tus datos y tu cuenta registrada como ${existing.role} ya se encuentra ACTIVA.\n\nPodés ingresar a la plataforma con las credenciales que creaste.\n\nSaludos,\nEl equipo de TAMO.`).catch(err => console.error("Error firing approved user email:", err));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = approved;
    return safe;
}
export async function rejectUser(id) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "User not found" };
    if (existing.status !== "PENDING")
        throw { status: 400, message: "Solo se pueden rechazar usuarios en estado PENDING" };
    // Procedemos a eliminar físicamente al usuario para que pueda volver a intentar registrarse
    const rejected = await prisma.user.delete({
        where: { id }
    });
    sendMail(existing.email, "Solicitud de Alta Rechazada - TAMO", `Hola ${existing.firstName},\n\nTe informamos que el administrador revisó tu solicitud de registro y determinó que no cumple con los requisitos necesarios para ingresar a la plataforma en este momento.\n\nPor favor, verificá tus datos o ponete en contacto con la administración.\n\nSaludos,\nEl equipo de TAMO.`).catch(err => console.error("Error firing rejected user email:", err));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = rejected;
    return safe;
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
