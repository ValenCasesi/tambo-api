import { z } from "zod";
import { createTender, getTenders, getTenderById, updateTender, publishTender, awardTender, deleteTender, createRequest, getRequestsByTender, updateRequest, deleteRequest, createProposal, getProposals, getMyProposal, getAwardedInfo, updateProposal } from "../services/tender.service.js";
// ==========================================
// ZOD SCHEMAS
// ==========================================
const tenderSchema = z.object({
    title: z.string().min(1, "El título es requerido"),
    product: z.string().min(1, "El producto es requerido"),
    volumeUnit: z.string().min(1, "La unidad es requerida").default("unidades"),
    priceCurrency: z.enum(["ARS", "USD_BN"]).default("ARS"),
    specifications: z.string().min(1, "Las especificaciones son requeridas"),
    deliveryConditions: z.string().min(1, "Las condiciones de entrega son requeridas"),
    paymentOptions: z.array(z.string()).min(1, "Debe haber al menos una opción de pago"),
    requestStartDate: z.coerce.date(),
    requestDeadline: z.coerce.date(),
    proposalStartDate: z.coerce.date(),
    proposalDeadline: z.coerce.date()
}).refine(d => d.requestDeadline > d.requestStartDate, {
    message: "requestDeadline debe ser posterior a requestStartDate", path: ["requestDeadline"]
}).refine(d => d.proposalStartDate >= d.requestDeadline, {
    message: "proposalStartDate debe ser igual o posterior a requestDeadline", path: ["proposalStartDate"]
}).refine(d => d.proposalDeadline > d.proposalStartDate, {
    message: "proposalDeadline debe ser posterior a proposalStartDate", path: ["proposalDeadline"]
});
const tenderUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    product: z.string().min(1).optional(),
    volumeUnit: z.string().min(1).optional(),
    priceCurrency: z.enum(["ARS", "USD_BN"]).optional(),
    specifications: z.string().min(1).optional(),
    deliveryConditions: z.string().min(1).optional(),
    paymentOptions: z.array(z.string()).min(1).optional(),
    requestStartDate: z.coerce.date().optional(),
    requestDeadline: z.coerce.date().optional(),
    proposalStartDate: z.coerce.date().optional(),
    proposalDeadline: z.coerce.date().optional()
});
const requestSchema = z.object({
    producerId: z.string().uuid("El producerId debe ser un UUID válido"),
    quantity: z.coerce.number().positive("La cantidad debe ser positiva"),
    notes: z.string().optional()
});
const proposalSchema = z.object({
    companyId: z.string().uuid("El companyId debe ser un UUID válido"),
    pricePerUnit: z.coerce.number().positive("El precio debe ser positivo"),
    paymentMethod: z.string().min(1, "La forma de pago es requerida"),
    logisticsConditions: z.string().min(1, "Las condiciones logísticas son requeridas"),
    offerValidity: z.string().min(1, "La vigencia de la oferta es requerida")
});
// ==========================================
// ERROR HANDLER HELPER
// ==========================================
function handleError(err, res, context) {
    if (err?.status && err?.message) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err?.issues) {
        return res.status(400).json({ error: "Error de validación", details: err.issues });
    }
    console.error(`${context}:`, err);
    return res.status(500).json({ error: "Internal server error" });
}
// ==========================================
// TENDER HANDLERS
// ==========================================
export async function createTenderHandler(req, res) {
    try {
        const parsed = tenderSchema.parse(req.body);
        const tender = await createTender(parsed);
        return res.status(201).json(tender);
    }
    catch (err) {
        return handleError(err, res, "createTenderHandler");
    }
}
export async function getTendersHandler(req, res) {
    try {
        const status = req.query.status;
        const tenders = await getTenders(status);
        return res.status(200).json(tenders);
    }
    catch (err) {
        return handleError(err, res, "getTendersHandler");
    }
}
export async function getTenderByIdHandler(req, res) {
    try {
        const tender = await getTenderById(req.params["id"]);
        return res.status(200).json(tender);
    }
    catch (err) {
        return handleError(err, res, "getTenderByIdHandler");
    }
}
export async function updateTenderHandler(req, res) {
    try {
        const parsed = tenderUpdateSchema.parse(req.body);
        const tender = await updateTender(req.params["id"], parsed);
        return res.status(200).json(tender);
    }
    catch (err) {
        return handleError(err, res, "updateTenderHandler");
    }
}
export async function publishTenderHandler(req, res) {
    try {
        const tender = await publishTender(req.params["id"]);
        return res.status(200).json(tender);
    }
    catch (err) {
        return handleError(err, res, "publishTenderHandler");
    }
}
export async function awardTenderHandler(req, res) {
    try {
        const winnerId = z.string().uuid().parse(req.body.winnerId);
        const tender = await awardTender(req.params["id"], winnerId);
        return res.status(200).json(tender);
    }
    catch (err) {
        return handleError(err, res, "awardTenderHandler");
    }
}
export async function deleteTenderHandler(req, res) {
    try {
        await deleteTender(req.params["id"]);
        return res.status(200).json({ message: "Licitación eliminada exitosamente" });
    }
    catch (err) {
        return handleError(err, res, "deleteTenderHandler");
    }
}
// ==========================================
// REQUEST HANDLERS (Productores)
// ==========================================
export async function createRequestHandler(req, res) {
    try {
        const parsed = requestSchema.parse(req.body);
        const request = await createRequest(req.params["id"], parsed.producerId, parsed.quantity, parsed.notes);
        return res.status(201).json(request);
    }
    catch (err) {
        return handleError(err, res, "createRequestHandler");
    }
}
export async function getRequestsByTenderHandler(req, res) {
    try {
        const requests = await getRequestsByTender(req.params["id"]);
        return res.status(200).json(requests);
    }
    catch (err) {
        return handleError(err, res, "getRequestsByTenderHandler");
    }
}
export async function updateRequestHandler(req, res) {
    try {
        const { producerId, quantity, notes } = z.object({
            producerId: z.string().uuid(),
            quantity: z.coerce.number().positive(),
            notes: z.string().optional()
        }).parse(req.body);
        const request = await updateRequest(req.params["requestId"], producerId, quantity, notes);
        return res.status(200).json(request);
    }
    catch (err) {
        return handleError(err, res, "updateRequestHandler");
    }
}
export async function deleteRequestHandler(req, res) {
    try {
        const producerId = z.string().uuid().parse(req.body.producerId);
        await deleteRequest(req.params["requestId"], producerId);
        return res.status(200).json({ message: "Pedido eliminado exitosamente" });
    }
    catch (err) {
        return handleError(err, res, "deleteRequestHandler");
    }
}
// ==========================================
// PROPOSAL HANDLERS (Empresas)
// ==========================================
export async function createProposalHandler(req, res) {
    try {
        const parsed = proposalSchema.parse(req.body);
        const proposal = await createProposal(req.params["id"], parsed);
        return res.status(201).json(proposal);
    }
    catch (err) {
        return handleError(err, res, "createProposalHandler");
    }
}
export async function getProposalsHandler(req, res) {
    try {
        const proposals = await getProposals(req.params["id"]);
        return res.status(200).json(proposals);
    }
    catch (err) {
        return handleError(err, res, "getProposalsHandler");
    }
}
const proposalUpdateSchema = z.object({
    pricePerUnit: z.coerce.number().positive("El precio debe ser positivo").optional(),
    paymentMethod: z.string().min(1, "La forma de pago es requerida").optional(),
    logisticsConditions: z.string().min(1, "Las condiciones logísticas son requeridas").optional(),
    offerValidity: z.string().min(1, "La vigencia de la oferta es requerida").optional()
}).refine(data => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar"
});
export async function updateProposalHandler(req, res) {
    try {
        const parsed = proposalUpdateSchema.parse(req.body);
        const proposals = await updateProposal(req.params["id"], req.user.id, parsed);
        return res.status(200).json(proposals);
    }
    catch (err) {
        return handleError(err, res, "updateProposalHandler");
    }
}
export async function getMyProposalHandler(req, res) {
    try {
        const companyId = z.string().uuid().parse(req.query.companyId);
        const proposal = await getMyProposal(req.params["id"], companyId);
        return res.status(200).json(proposal);
    }
    catch (err) {
        return handleError(err, res, "getMyProposalHandler");
    }
}
export async function getAwardedInfoHandler(req, res) {
    try {
        const companyId = z.string().uuid().parse(req.query.companyId);
        const info = await getAwardedInfo(req.params["id"], companyId);
        return res.status(200).json(info);
    }
    catch (err) {
        return handleError(err, res, "getAwardedInfoHandler");
    }
}
