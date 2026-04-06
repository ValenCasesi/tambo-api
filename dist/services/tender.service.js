import prisma from "../prisma/client.js";
import { TenderStatus } from "@prisma/client";
import { randomBytes } from "crypto";
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
    // 2. Move ACCEPTING_PROPOSALS -> CLOSED
    await prisma.tender.updateMany({
        where: {
            status: TenderStatus.ACCEPTING_PROPOSALS,
            proposalDeadline: { lt: now }
        },
        data: { status: TenderStatus.CLOSED, closedAt: now }
    });
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
        return await prisma.tender.update({
            where: { id: tenderId },
            data: { status: TenderStatus.CLOSED, closedAt: now }
        });
    }
    return tender;
}
function generateProposalCode() {
    const year = new Date().getUTCFullYear();
    const random = randomBytes(3).toString("hex").toUpperCase();
    return `PROP-${year}-${random}`;
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
            winner: { select: { id: true, firstName: true, lastName: true, email: true } },
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
    return await prisma.tender.update({
        where: { id },
        data: { status: TenderStatus.ACCEPTING_REQUESTS }
    });
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
    return await prisma.tenderRequest.create({
        data: { tenderId, producerId, quantity, notes }
    });
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
    return await prisma.tenderRequest.update({
        where: { id: requestId },
        data: { quantity, notes }
    });
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
    return await prisma.tenderRequest.delete({ where: { id: requestId } });
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
        throw { status: 409, message: "Ya enviaste una oferta para esta licitación. Las ofertas no se pueden modificar una vez enviadas." };
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
        orderBy: { pricePerUnit: "asc" } // Ranking por precio ascendente
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
