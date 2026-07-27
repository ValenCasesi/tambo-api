import assert from "node:assert/strict";
import test from "node:test";
import { averageMetricRows, COMPARISON_MINIMUM_SAMPLE } from "./stats-comparison.service.js";
test("does not publish an average with only 17 valid peer values", () => {
    const rows = Array.from({ length: COMPARISON_MINIMUM_SAMPLE - 1 }, (_, index) => ({ metric: index + 1 }));
    assert.deepEqual(averageMetricRows(rows, ["metric"]), { metric: null });
});
test("publishes an equal-weight average with exactly 18 valid peer values", () => {
    const rows = Array.from({ length: COMPARISON_MINIMUM_SAMPLE }, (_, index) => ({ metric: index }));
    assert.deepEqual(averageMetricRows(rows, ["metric"]), { metric: 8.5 });
});
test("treats zero as data and null as missing for the per-metric threshold", () => {
    const validRows = Array.from({ length: COMPARISON_MINIMUM_SAMPLE }, () => ({ metric: 0 }));
    assert.deepEqual(averageMetricRows([...validRows, { metric: null }], ["metric"]), { metric: 0 });
    assert.deepEqual(averageMetricRows([...validRows.slice(1), { metric: null }], ["metric"]), { metric: null });
});
