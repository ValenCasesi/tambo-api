import assert from "node:assert/strict";
import test from "node:test";
import { producerTiersSchema } from "../controller/billing.controller.js";

test("preserves null as the unbounded maximum of the final producer tier", () => {
    const payload = {
        tiers: [
            { minVo: 0, maxVo: 299, sigleaLiters: 50 },
            { minVo: 300, maxVo: 1000, sigleaLiters: 100 },
            { minVo: 1001, maxVo: null, sigleaLiters: 150 },
        ],
    };

    const parsed = producerTiersSchema.parse(payload);

    assert.equal(parsed.tiers[2].maxVo, null);
});
