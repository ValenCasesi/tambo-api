import prisma from "../prisma/client.js";
import { TenderStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { sendMail, buildHtmlTemplate } from "./email.service.js";
// ==========================================
// HELPER: Auto-transition by dates (Option A)
// ==========================================
async function syncAllTendersStatuses() {
    const now = new Date();
    // 1. Move ACCEPTING_REQUESTS -> ACCEPTING_PROPOSALS
    await prisma.tender.updateMany({
        where: {
            status: TenderStatus.ACCEPTING_REQUESTS,
            requestDeadline: { lt: now }
        },
        data: { status: TenderStatus.ACCEPTING_PROPOSALS }
    });
    // 2. Move ACCEPTING_PROPOSALS -> CLOSED / AWARDED
    const expiringTenders = await prisma.tender.findMany({
        where: {
            status: TenderStatus.ACCEPTING_PROPOSALS,
            proposalDeadline: { lt: now }
        }
    });
    for (const tender of expiringTenders) {
        await closeAndAwardTender(tender.id);
    }
}
async function syncTenderStatus(tenderId) {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender)
        throw { status: 404, message: "Licitación no encontrada" };
    const now = new Date();
    if (tender.status === TenderStatus.ACCEPTING_REQUESTS && now > tender.requestDeadline) {
        return await prisma.tender.update({
            where: { id: tenderId },
            data: { status: TenderStatus.ACCEPTING_PROPOSALS }
        });
    }
    if (tender.status === TenderStatus.ACCEPTING_PROPOSALS && now > tender.proposalDeadline) {
        return await closeAndAwardTender(tenderId);
    }
    return tender;
}
async function closeAndAwardTender(tenderId) {
    const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        include: {
            proposals: {
                orderBy: [
                    { pricePerUnit: 'asc' },
                    { submittedAt: 'asc' }
                ],
                include: { company: true }
            },
            requests: {
                include: { producer: true }
            }
        }
    });
    if (!tender)
        throw { status: 404, message: "Licitación no encontrada" };
    const now = new Date();
    if (tender.proposals.length > 0) {
        const winningProposal = tender.proposals[0];
        const updatedTender = await prisma.tender.update({
            where: { id: tenderId },
            data: {
                status: TenderStatus.AWARDED,
                winnerId: winningProposal.companyId,
                closedAt: now,
                awardedAt: now
            }
        });
        const producers = tender.requests.map(r => r.producer);
        const companies = tender.proposals.map(p => p.company);
        const participantsMap = new Map();
        for (const user of [...producers, ...companies]) {
            participantsMap.set(user.email, user);
        }
        for (const user of participantsMap.values()) {
            const subject = `¡Licitación Adjudicada! - ${tender.title}`;
            const html = buildHtmlTemplate({
                title: `Resultado de Licitación: ${tender.title}`,
                messageLines: [
                    `Hola ${user.firstName},`,
                    `La licitación por <b>${tender.product}</b> ha finalizado y se ha seleccionado un ganador.`,
                    `<b>Total Solicitado por Productores:</b> ${tender.totalPedidoTender.toString()} ${getTenderVolumeUnit(tender)}`,
                    `<b>Empresa Ganadora:</b> ${winningProposal.company.firstName} ${winningProposal.company.lastName}`,
                    `<b>Precio Unitario:</b> $${winningProposal.pricePerUnit.toString()} / ${getTenderVolumeUnit(tender)}`,
                    `Ingresa a la plataforma para ver más detalles y acceder a los datos de contacto.`
                ],
                buttonText: "Ver Resultado",
                buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
            });
            sendMail(user.email, subject, "Se ha adjudicado la licitación.", html)
                .catch(err => console.error(`Error enviando email a ${user.email}:`, err));
        }
        return updatedTender;
    }
    else {
        const updatedTender = await prisma.tender.update({
            where: { id: tenderId },
            data: {
                status: TenderStatus.CLOSED,
                closedAt: now
            }
        });
        const producersMap = new Map();
        for (const req of tender.requests) {
            producersMap.set(req.producer.email, req.producer);
        }
        for (const user of producersMap.values()) {
            const subject = `Licitación Cerrada Sin Ofertas - ${tender.title}`;
            const html = buildHtmlTemplate({
                title: `Licitación Sin Ofertas: ${tender.title}`,
                messageLines: [
                    `Hola ${user.firstName},`,
                    `Te informamos que la licitación por <b>${tender.product}</b> ha finalizado su periodo de ofertas.`,
                    `<b>Total Solicitado por Productores:</b> ${tender.totalPedidoTender.toString()} ${getTenderVolumeUnit(tender)}`,
                    `Lamentablemente, no se recibió ninguna propuesta por parte de las empresas proveedoras, por lo que la licitación ha sido cerrada.`
                ],
                buttonText: "Ir a la Plataforma",
                buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
            });
            sendMail(user.email, subject, "La licitación ha cerrado sin ofertas.", html)
                .catch(err => console.error(`Error enviando email a ${user.email}:`, err));
        }
        return updatedTender;
    }
}
function generateProposalCode() {
    const year = new Date().getUTCFullYear();
    const random = randomBytes(3).toString("hex").toUpperCase();
    return `PROP-${year}-${random}`;
}
function getTenderVolumeUnit(tender) {
    return tender.volumeUnit || "unidades";
}
export async function createTender(data) {
    return await prisma.tender.create({ data });
}
export async function getTenders(status) {
    await syncAllTendersStatuses();
    const where = status ? { status } : {};
    return await prisma.tender.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            _count: { select: { requests: true, proposals: true } },
            winner: { select: { id: true, firstName: true, lastName: true } }
        }
    });
}
export async function getTenderById(id) {
    const tender = await syncTenderStatus(id);
    const full = await prisma.tender.findUnique({
        where: { id },
        include: {
            winner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            _count: { select: { requests: true, proposals: true } }
        }
    });
    if (!full)
        throw { status: 404, message: "Licitación no encontrada" };
    return full;
}
export async function updateTender(id, data) {
    const tender = await prisma.tender.findUnique({ where: { id } });
    if (!tender)
        throw { status: 404, message: "Licitación no encontrada" };
    if (tender.status !== TenderStatus.DRAFT) {
        throw { status: 400, message: "Solo se puede editar una licitación en estado DRAFT" };
    }
    return await prisma.tender.update({ where: { id }, data });
}
export async function publishTender(id) {
    const tender = await prisma.tender.findUnique({ where: { id } });
    if (!tender)
        throw { status: 404, message: "Licitación no encontrada" };
    if (tender.status !== TenderStatus.DRAFT) {
        throw { status: 400, message: "Solo se puede publicar una licitación en estado DRAFT" };
    }
    if (tender.requestDeadline >= tender.proposalStartDate) {
        throw { status: 400, message: "La fecha de corte de pedidos debe ser anterior al inicio de ofertas" };
    }
    if (tender.proposalStartDate >= tender.proposalDeadline) {
        throw { status: 400, message: "La fecha de inicio de ofertas debe ser anterior al cierre de ofertas" };
    }
    const updatedTender = await prisma.tender.update({
        where: { id },
        data: { status: TenderStatus.ACCEPTING_REQUESTS }
    });
    // Notify active producers and companies
    const targetUsers = await prisma.user.findMany({
        where: {
            status: "ACTIVE",
            role: { in: ["PRODUCTOR", "EMPRESA"] }
        }
    });
    for (const user of targetUsers) {
        const subject = `¡Nueva Licitación Publicada! - ${tender.title}`;
        const html = buildHtmlTemplate({
            title: `¡Nueva Licitación Publicada!`,
            messageLines: [
                `Hola ${user.firstName},`,
                `Se ha publicado una nueva licitación en Sinergia Plataforma.`,
                `<b>Producto:</b> ${tender.product}`,
                `<b>Unidad:</b> ${getTenderVolumeUnit(tender)}`,
                `<b>Especificaciones:</b> ${tender.specifications}`,
                `<b>Apertura de pedidos (Productores):</b> ${tender.requestStartDate.toLocaleDateString('es-AR')}`,
                `<b>Cierre de pedidos (Productores):</b> ${tender.requestDeadline.toLocaleDateString('es-AR')}`,
                `<b>Apertura de ofertas (Empresas):</b> ${tender.proposalStartDate.toLocaleDateString('es-AR')}`,
                `<b>Cierre de ofertas (Empresas):</b> ${tender.proposalDeadline.toLocaleDateString('es-AR')}`,
                `Ingresa a la plataforma para ver más detalles.`
            ],
            buttonText: "Ver Licitación",
            buttonUrl: process.env.FRONTEND_URL || "http://localhost:3000"
        });
        sendMail(user.email, subject, "Se ha publicado una nueva licitación en Sinergia Plataforma.", html)
            .catch(err => console.error(`Error enviando email a ${user.email}:`, err));
    }
    return updatedTender;
}
export async function awardTender(id, winnerId) {
    const tender = await syncTenderStatus(id);
    if (tender.status !== TenderStatus.CLOSED) {
        throw { status: 400, message: "Solo se puede adjudicar una licitación en estado CLOSED" };
    }
    const winner = await prisma.user.findUnique({ where: { id: winnerId } });
    if (!winner)
        throw { status: 404, message: "Empresa ganadora no encontrada" };
    if (winner.role !== "EMPRESA")
        throw { status: 400, message: "El ganador debe ser una EMPRESA" };
    return await prisma.tender.update({
        where: { id },
        data: { status: TenderStatus.AWARDED, winnerId, awardedAt: new Date() }
    });
}
export async function deleteTender(id) {
    const tender = await prisma.tender.findUnique({ where: { id } });
    if (!tender)
        throw { status: 404, message: "Licitación no encontrada" };
    if (tender.status !== TenderStatus.DRAFT) {
        throw { status: 400, message: "Solo se puede eliminar una licitación en estado DRAFT" };
    }
    return await prisma.tender.delete({ where: { id } });
}
// ==========================================
// TENDER REQUESTS (Productores)
// ==========================================
export async function createRequest(tenderId, producerId, quantity, notes) {
    const tender = await syncTenderStatus(tenderId);
    if (tender.status !== TenderStatus.ACCEPTING_REQUESTS) {
        throw { status: 400, message: "La licitación no está en la etapa de carga de pedidos" };
    }
    const now = new Date();
    if (now < tender.requestStartDate) {
        throw { status: 400, message: "La etapa de pedidos aún no comenzó" };
    }
    if (now > tender.requestDeadline) {
        throw { status: 400, message: "La fecha de corte de pedidos ya pasó" };
    }
    const producer = await prisma.user.findUnique({ where: { id: producerId } });
    if (!producer)
        throw { status: 404, message: "Productor no encontrado" };
    if (producer.role !== "PRODUCTOR")
        throw { status: 403, message: "Solo los PRODUCTORES pueden hacer pedidos" };
    const existing = await prisma.tenderRequest.findUnique({
        where: { tenderId_producerId: { tenderId, producerId } }
    });
    if (existing)
        throw { status: 409, message: "Ya existe un pedido para esta licitación. Usá el endpoint de actualización." };
    const request = await prisma.tenderRequest.create({
        data: { tenderId, producerId, quantity, notes }
    });
    await prisma.tender.update({
        where: { id: tenderId },
        data: { totalPedidoTender: { increment: quantity } }
    });
    return request;
}
export async function getRequestsByTender(tenderId) {
    return await prisma.tenderRequest.findMany({
        where: { tenderId },
        include: {
            producer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
        },
        orderBy: { createdAt: "asc" }
    });
}
export async function updateRequest(requestId, producerId, quantity, notes) {
    const request = await prisma.tenderRequest.findUnique({ where: { id: requestId } });
    if (!request)
        throw { status: 404, message: "Pedido no encontrado" };
    if (request.producerId !== producerId)
        throw { status: 403, message: "No podés modificar un pedido ajeno" };
    const tender = await syncTenderStatus(request.tenderId);
    if (tender.status !== TenderStatus.ACCEPTING_REQUESTS) {
        throw { status: 400, message: "La etapa de pedidos ya cerró, no se puede modificar" };
    }
    const diff = quantity - Number(request.quantity);
    const updated = await prisma.tenderRequest.update({
        where: { id: requestId },
        data: { quantity, notes }
    });
    if (diff !== 0) {
        await prisma.tender.update({
            where: { id: tender.id },
            data: { totalPedidoTender: { increment: diff } }
        });
    }
    return updated;
}
export async function deleteRequest(requestId, producerId) {
    const request = await prisma.tenderRequest.findUnique({ where: { id: requestId } });
    if (!request)
        throw { status: 404, message: "Pedido no encontrado" };
    if (request.producerId !== producerId)
        throw { status: 403, message: "No podés eliminar un pedido ajeno" };
    const tender = await syncTenderStatus(request.tenderId);
    if (tender.status !== TenderStatus.ACCEPTING_REQUESTS) {
        throw { status: 400, message: "La etapa de pedidos ya cerró, no se puede eliminar" };
    }
    const deleted = await prisma.tenderRequest.delete({ where: { id: requestId } });
    await prisma.tender.update({
        where: { id: tender.id },
        data: { totalPedidoTender: { decrement: Number(request.quantity) } }
    });
    return deleted;
}
export async function createProposal(tenderId, data) {
    const tender = await syncTenderStatus(tenderId);
    if (tender.status !== TenderStatus.ACCEPTING_PROPOSALS) {
        if (tender.status === TenderStatus.ACCEPTING_REQUESTS) {
            throw { status: 400, message: "La etapa de pedidos aún está abierta. Las ofertas se aceptan después del corte de pedidos." };
        }
        throw { status: 400, message: "La licitación no está en la etapa de carga de ofertas" };
    }
    const now = new Date();
    if (now < tender.proposalStartDate) {
        throw { status: 400, message: "La etapa de carga de ofertas aún no comenzó" };
    }
    if (now > tender.proposalDeadline) {
        throw { status: 400, message: "El plazo de carga de ofertas ya venció" };
    }
    const company = await prisma.user.findUnique({ where: { id: data.companyId } });
    if (!company)
        throw { status: 404, message: "Empresa no encontrada" };
    if (company.role !== "EMPRESA")
        throw { status: 403, message: "Solo las EMPRESAS pueden enviar ofertas" };
    const existing = await prisma.tenderProposal.findUnique({
        where: { tenderId_companyId: { tenderId, companyId: data.companyId } }
    });
    if (existing)
        throw { status: 409, message: "Ya enviaste una oferta para esta licitación." };
    const proposalCode = generateProposalCode();
    return await prisma.tenderProposal.create({
        data: {
            tenderId,
            companyId: data.companyId,
            proposalCode,
            pricePerUnit: data.pricePerUnit,
            paymentMethod: data.paymentMethod,
            logisticsConditions: data.logisticsConditions,
            offerValidity: data.offerValidity,
            isSubmitted: true,
            submittedAt: now
        }
    });
}
export async function updateProposal(tenderId, companyId, data) {
    const tender = await syncTenderStatus(tenderId);
    if (tender.status !== TenderStatus.ACCEPTING_PROPOSALS) {
        if (tender.status === TenderStatus.ACCEPTING_REQUESTS) {
            throw { status: 400, message: "La etapa de pedidos aún está abierta. Las ofertas se aceptan después del corte de pedidos." };
        }
        throw { status: 400, message: "La licitación no está en la etapa de carga de ofertas" };
    }
    const now = new Date();
    if (now < tender.proposalStartDate) {
        throw { status: 400, message: "La etapa de carga de ofertas aún no comenzó" };
    }
    if (now > tender.proposalDeadline) {
        throw { status: 400, message: "El plazo de carga de ofertas ya venció" };
    }
    const existing = await prisma.tenderProposal.findUnique({
        where: { tenderId_companyId: { tenderId, companyId } }
    });
    if (!existing)
        throw { status: 404, message: "No encontramos una oferta tuya para esta licitación" };
    return await prisma.tenderProposal.update({
        where: { tenderId_companyId: { tenderId, companyId } },
        data: {
            ...data,
            submittedAt: now
        }
    });
}
export async function getProposals(tenderId) {
    const tender = await syncTenderStatus(tenderId);
    if (tender.status === TenderStatus.DRAFT || tender.status === TenderStatus.ACCEPTING_REQUESTS || tender.status === TenderStatus.ACCEPTING_PROPOSALS) {
        throw { status: 403, message: "Las ofertas solo son visibles después del cierre de la licitación" };
    }
    return await prisma.tenderProposal.findMany({
        where: { tenderId },
        include: {
            company: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { pricePerUnit: "asc" }
    });
}
export async function getMyProposal(tenderId, companyId) {
    const proposal = await prisma.tenderProposal.findUnique({
        where: { tenderId_companyId: { tenderId, companyId } }
    });
    if (!proposal)
        throw { status: 404, message: "No encontramos una oferta tuya para esta licitación" };
    return proposal;
}
export async function getAwardedInfo(tenderId, companyId) {
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender)
        throw { status: 404, message: "Licitación no encontrada" };
    if (tender.status !== TenderStatus.AWARDED) {
        throw { status: 400, message: "El resultado aún no fue publicado" };
    }
    if (tender.winnerId !== companyId) {
        throw { status: 403, message: "Solo la empresa ganadora puede acceder a esta información" };
    }
    // Devuelve productores que hicieron pedido con sus datos de contacto
    return await prisma.tenderRequest.findMany({
        where: { tenderId },
        include: {
            producer: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    tambos: {
                        select: { name: true, location: true, province: true },
                        take: 1
                    }
                }
            }
        }
    });
}
