import assert from "node:assert/strict";
import test from "node:test";
import { BillingCycle } from "@prisma/client";
import {
    calculateProducerCycleCharge,
    getBillingPeriodEnd,
    getProducerPriceMultiplier,
    PRODUCER_ANNUAL_PRICE_MULTIPLIER,
} from "./billing.service.js";

test("producer annual billing covers twelve months while charging ten monthly equivalents", () => {
    assert.equal(PRODUCER_ANNUAL_PRICE_MULTIPLIER, 10);
    assert.equal(getProducerPriceMultiplier(BillingCycle.MONTHLY), 1);
    assert.equal(getProducerPriceMultiplier(BillingCycle.ANNUAL), 10);
    assert.equal(getBillingPeriodEnd("202608", BillingCycle.ANNUAL), "202707");
    assert.equal(getBillingPeriodEnd("202608", BillingCycle.MONTHLY), null);
});

test("producer annual gross is monthly Siglea liters times ten and the current Siglea price", () => {
    assert.deepEqual(
        calculateProducerCycleCharge(37.5, 420, BillingCycle.ANNUAL),
        {
            priceMultiplier: 10,
            cycleSigleaLiters: 375,
            grossAmount: 157_500,
        }
    );
});
