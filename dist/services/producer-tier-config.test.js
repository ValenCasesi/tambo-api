import assert from "node:assert/strict";
import test from "node:test";
import { getProducerTierTag, isVoInProducerTier, ProducerTierConfigError, validateProducerTierConfiguration, } from "./producer-tier-config.js";
const validTiers = [
    { minVo: 0, maxVo: 299, sigleaLiters: 50 },
    { minVo: 300, maxVo: 1000, sigleaLiters: 75 },
    { minVo: 1001, maxVo: null, sigleaLiters: 100 },
];
test("accepts a complete producer tier configuration", () => {
    assert.doesNotThrow(() => validateProducerTierConfiguration(validTiers));
    assert.doesNotThrow(() => validateProducerTierConfiguration([
        { minVo: 0, maxVo: null, sigleaLiters: 60 },
    ]));
    assert.doesNotThrow(() => validateProducerTierConfiguration([
        { minVo: 0, maxVo: 199, sigleaLiters: 40 },
        { minVo: 200, maxVo: 499, sigleaLiters: 60 },
        { minVo: 500, maxVo: 999, sigleaLiters: 80 },
        { minVo: 1000, maxVo: null, sigleaLiters: 100 },
    ]));
    assert.equal(getProducerTierTag(0, 299), "<300 VO");
    assert.equal(getProducerTierTag(300, 1000), "300–1000 VO");
    assert.equal(getProducerTierTag(1001, null), ">1000 VO");
});
test("matches exact tier boundaries", () => {
    assert.equal(isVoInProducerTier(299, 0, 299), true);
    assert.equal(isVoInProducerTier(300, 0, 299), false);
    assert.equal(isVoInProducerTier(300, 300, 1000), true);
    assert.equal(isVoInProducerTier(1000, 300, 1000), true);
    assert.equal(isVoInProducerTier(1001, 1001, null), true);
});
test("rejects gaps, overlaps and a bounded final tier", () => {
    assert.throws(() => validateProducerTierConfiguration([
        { minVo: 0, maxVo: 299, sigleaLiters: 50 },
        { minVo: 301, maxVo: null, sigleaLiters: 75 },
    ]), ProducerTierConfigError);
    assert.throws(() => validateProducerTierConfiguration([
        { minVo: 0, maxVo: 300, sigleaLiters: 50 },
        { minVo: 300, maxVo: null, sigleaLiters: 75 },
    ]), ProducerTierConfigError);
    assert.throws(() => validateProducerTierConfiguration([
        { minVo: 0, maxVo: 500, sigleaLiters: 50 },
    ]), ProducerTierConfigError);
});
test("rejects fractional VO limits and non-positive liters", () => {
    assert.throws(() => validateProducerTierConfiguration([
        { minVo: 0, maxVo: 299.5, sigleaLiters: 50 },
        { minVo: 300.5, maxVo: null, sigleaLiters: 75 },
    ]), ProducerTierConfigError);
    assert.throws(() => validateProducerTierConfiguration([{ minVo: 0, maxVo: null, sigleaLiters: 0 }]), ProducerTierConfigError);
});
