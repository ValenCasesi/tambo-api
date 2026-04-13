import prisma from "../prisma/client.js";
import { hashPassword } from "./auth.service.js";
import { sendMail, buildHtmlTemplate } from "./email.service.js";
export async function createUser(input) {
    const { email, cuit, razonSocial, localidad, password, role = "PRODUCTOR", firstName, lastName, phone, imageUrl } = input;
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
            razonSocial,
            localidad,
            imageUrl,
            status: isPending ? "PENDING" : "ACTIVE"
        },
    });
    if (isPending) {
        const adminDest = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        sendMail(adminDest, "Nueva Solicitud de Registro - Sinergia Plataforma", `Hola Admin,\n\nUn nuevo usuario acaba de registrarse y espera tu aprobación para ingresar.\n\nNombre: ${firstName} ${lastName}\nRol: ${role}\nEmail: ${email}\n\nIngresá al panel administrativo para aprobarlo.\n`, buildHtmlTemplate({
            title: "Nueva Solicitud de Registro",
            messageLines: [
                "Hola Admin,",
                "Un nuevo usuario acaba de registrarse y espera tu aprobación para ingresar.",
                `<b>Nombre y Apellido:</b> ${firstName} ${lastName}`,
                `<b>Razón Social:</b> ${razonSocial || "No especificada"}`,
                `<b>Localidad:</b> ${localidad || "No especificada"}`,
                `<b>Rol:</b> ${role}`,
                `<b>Email:</b> ${email}`,
                `<b>CUIT:</b> ${cuit}`,
                "Ingresa al panel administrativo para revisar la solicitud y aprobarla."
            ],
            buttonText: "Ir al Panel de Administración",
            buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
        })).catch(err => console.error("Error firing admin register check email:", err));
    }
    // remove password from returned object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = created;
    return safe;
}
export async function updateUser(input) {
    const { id, email, cuit, razonSocial, localidad, password, role, firstName, lastName, phone, imageUrl } = input;
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
            ...(razonSocial !== undefined && { razonSocial }),
            ...(localidad !== undefined && { localidad }),
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
export async function getAllUsers(statusFilter) {
    const whereClause = {};
    if (statusFilter) {
        whereClause.status = statusFilter;
    }
    else {
        whereClause.status = { not: "PENDING" }; // Default
    }
    const users = await prisma.user.findMany({
        where: whereClause
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
    sendMail(existing.email, "¡Bienvenido! Tu cuenta ha sido activada - Sinergia Plataforma", `Hola ${existing.firstName},\n\nTenemos el agrado de informarte que el administrador validó tus datos y tu cuenta registrada como ${existing.role} ya se encuentra ACTIVA.\n\nPodés ingresar a la plataforma con las credenciales que creaste.\n\nSaludos,\nEl equipo de Sinergia.`, buildHtmlTemplate({
        title: "¡Tu cuenta ha sido activada!",
        messageLines: [
            `Hola ${existing.firstName},`,
            `Tenemos el agrado de informarte que el administrador validó tus datos y tu cuenta registrada como <b>${existing.role}</b> ya se encuentra ACTIVA.`,
            "Ya puedes ingresar a la plataforma con las credenciales que creaste."
        ],
        buttonText: "Iniciar Sesión",
        buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
    })).catch(err => console.error("Error firing approved user email:", err));
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
    sendMail(existing.email, "Solicitud de Alta Rechazada - Sinergia Plataforma", `Hola ${existing.firstName},\n\nTe informamos que el administrador revisó tu solicitud de registro y determinó que no cumple con los requisitos necesarios para ingresar a la plataforma en este momento.\n\nPor favor, verificá tus datos o ponete en contacto con la administración.\n\nSaludos,\nEl equipo de Sinergia.`, buildHtmlTemplate({
        title: "Solicitud de Alta Rechazada",
        messageLines: [
            `Hola ${existing.firstName},`,
            "Te informamos que el administrador revisó tu solicitud de registro y determinó que no cumple con los requisitos necesarios para ingresar a la plataforma en este momento.",
            "Por favor, revisa tus datos de contacto o comunícate directamente con la administración."
        ],
        buttonText: "Ir a Sinergia",
        buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
    })).catch(err => console.error("Error firing rejected user email:", err));
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
export async function reactivateUser(id) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing)
        throw { status: 404, message: "User not found" };
    if (existing.status === "ACTIVE")
        throw { status: 400, message: "User is already active" };
    const reactivated = await prisma.user.update({
        where: { id },
        data: { status: "ACTIVE" }
    });
    sendMail(reactivated.email, "¡Tu cuenta ha sido reactivada! - Sinergia Plataforma", `Hola ${reactivated.firstName},\n\nTe informamos que el administrador ha rehabilitado el acceso a tu cuenta.\n\nYa podés ingresar nuevamente a la plataforma con tus credenciales habituales.\n\nSaludos,\nEl equipo de Sinergia.`, buildHtmlTemplate({
        title: "¡Tu cuenta ha sido reactivada!",
        messageLines: [
            `Hola ${reactivated.firstName},`,
            "Te informamos que el administrador ha rehabilitado el acceso a tu cuenta. Se han restaurado todos tus permisos.",
            "Ya puedes ingresar nuevamente a la plataforma utilizando tus credenciales habituales."
        ],
        buttonText: "Iniciar Sesión",
        buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
    })).catch(err => console.error("Error firing reactivated user email:", err));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pwd, ...safe } = reactivated;
    return safe;
}
