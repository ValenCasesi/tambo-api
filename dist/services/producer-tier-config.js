export class ProducerTierConfigError extends Error {
    status = 400;
}
function assertNonNegativeInteger(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new ProducerTierConfigError(`${label} debe ser un número entero mayor o igual a cero`);
    }
}
export function getProducerTierTag(minVo, maxVo) {
    if (minVo === 0 && maxVo === null)
        return "Todos los VO";
    if (minVo === 0 && maxVo !== null)
        return `<${maxVo + 1} VO`;
    if (maxVo === null)
        return `>${minVo - 1} VO`;
    return `${minVo}–${maxVo} VO`;
}
export function getProducerTierName(minVo, maxVo) {
    return `Plan ${getProducerTierTag(minVo, maxVo)}`;
}
export function isVoInProducerTier(vo, minVo, maxVo) {
    return vo >= minVo && (maxVo === null || vo <= maxVo);
}
export function validateProducerTierConfiguration(tiers) {
    if (tiers.length === 0) {
        throw new ProducerTierConfigError("Debe existir al menos un tramo de VO");
    }
    const ids = tiers.flatMap((tier) => tier.id ? [tier.id] : []);
    if (new Set(ids).size !== ids.length) {
        throw new ProducerTierConfigError("No se puede repetir un mismo plan dentro de la configuración");
    }
    tiers.forEach((tier, index) => {
        assertNonNegativeInteger(tier.minVo, `El VO mínimo del tramo ${index + 1}`);
        if (tier.maxVo !== null) {
            assertNonNegativeInteger(tier.maxVo, `El VO máximo del tramo ${index + 1}`);
            if (tier.maxVo < tier.minVo) {
                throw new ProducerTierConfigError(`El VO máximo del tramo ${index + 1} no puede ser menor al mínimo`);
            }
        }
        if (!Number.isFinite(tier.sigleaLiters) || tier.sigleaLiters <= 0) {
            throw new ProducerTierConfigError(`Los litros Siglea del tramo ${index + 1} deben ser mayores a cero`);
        }
    });
    if (tiers[0].minVo !== 0) {
        throw new ProducerTierConfigError("El primer tramo debe comenzar en 0 VO");
    }
    for (let index = 0; index < tiers.length; index += 1) {
        const tier = tiers[index];
        const isLast = index === tiers.length - 1;
        if (isLast) {
            if (tier.maxVo !== null) {
                throw new ProducerTierConfigError("El último tramo debe quedar sin límite máximo");
            }
            continue;
        }
        if (tier.maxVo === null) {
            throw new ProducerTierConfigError("Solo el último tramo puede quedar sin límite máximo");
        }
        const expectedNextMin = tier.maxVo + 1;
        if (tiers[index + 1].minVo !== expectedNextMin) {
            throw new ProducerTierConfigError(`El tramo ${index + 2} debe comenzar en ${expectedNextMin} VO para no dejar huecos ni superposiciones`);
        }
    }
    return tiers;
}
