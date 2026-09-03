import assert from "node:assert/strict";
import test from "node:test";
import { optionalNullableNonNegativeNumber } from "../controller/monthly-stats.controller.js";

test("preserves missing monthly values as null instead of coercing them to zero", () => {
    assert.equal(optionalNullableNonNegativeNumber.parse(null), null);
    assert.equal(optionalNullableNonNegativeNumber.parse(""), null);
});

test("keeps an explicitly reported zero as a valid monthly value", () => {
    assert.equal(optionalNullableNonNegativeNumber.parse(0), 0);
    assert.equal(optionalNullableNonNegativeNumber.parse("0"), 0);
});
