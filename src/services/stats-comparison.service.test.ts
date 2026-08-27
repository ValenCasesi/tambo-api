import assert from "node:assert/strict";
import test from "node:test";
import {
    addDerivedMonthlyMetrics,
    averageMetricRows,
    COMPARISON_MINIMUM_SAMPLE,
    evaluateMarketAccess,
    getLastClosedPeriods,
    MARKET_ACCESS_INPUT_KEYS
} from "./stats-comparison.service.js";

test("uses the two previous closed months, including across a year boundary", () => {
    assert.deepEqual(
        getLastClosedPeriods(new Date("2026-01-15T12:00:00Z")),
        [
            { period: "202512", year: 2025, month: 12 },
            { period: "202511", year: 2025, month: 11 }
        ]
    );
});

test("requires at least 70 percent completion in each recent closed period", () => {
    const periods = [
        { period: "202607", year: 2026, month: 7 },
        { period: "202606", year: 2026, month: 6 }
    ];
    const minimumCompleted = Math.ceil(MARKET_ACCESS_INPUT_KEYS.length * 0.7);
    const completedValues = Object.fromEntries(
        MARKET_ACCESS_INPUT_KEYS.slice(0, minimumCompleted).map((key) => [key, 1])
    );

    const eligible = evaluateMarketAccess(
        periods.map(({ period }) => ({ period, ...completedValues })),
        periods
    );
    assert.equal(eligible.eligible, true);

    const incompleteValues = Object.fromEntries(
        MARKET_ACCESS_INPUT_KEYS.slice(0, minimumCompleted - 1).map((key) => [key, 1])
    );
    const ineligible = evaluateMarketAccess(
        [
            { period: periods[0].period, ...completedValues },
            { period: periods[1].period, ...incompleteValues }
        ],
        periods
    );
    assert.equal(ineligible.eligible, false);
    assert.ok(ineligible.periods[1].completionPercentage < 70);
});

test("does not count technical zero defaults as loaded market access data", () => {
    const periods = [
        { period: "202607", year: 2026, month: 7 },
        { period: "202606", year: 2026, month: 6 }
    ];
    const zeroValues = Object.fromEntries(MARKET_ACCESS_INPUT_KEYS.map((key) => [key, 0]));
    const access = evaluateMarketAccess(
        periods.map(({ period }) => ({ period, ...zeroValues })),
        periods
    );

    assert.equal(access.eligible, false);
    assert.deepEqual(access.periods.map(({ completionPercentage }) => completionPercentage), [0, 0]);
});

test("calculates the percentage of milking cows from milking and total cows", () => {
    assert.equal(
        addDerivedMonthlyMetrics({ vacasOrdene: 80, vacasTotales: 100 }).porcentajeVacasOrdene,
        80
    );
    assert.equal(
        addDerivedMonthlyMetrics({ vacasOrdene: 80, vacasTotales: 0 }).porcentajeVacasOrdene,
        null
    );
});

test("gives each farm equal weight when averaging milking cow percentages", () => {
    const rows = [
        addDerivedMonthlyMetrics({ vacasOrdene: 50, vacasTotales: 100 }),
        addDerivedMonthlyMetrics({ vacasOrdene: 1000, vacasTotales: 1000 })
    ];

    assert.deepEqual(
        averageMetricRows(rows, ["porcentajeVacasOrdene"], 2),
        { porcentajeVacasOrdene: 75 }
    );
});

test("calculates current growth as a percentage of one twelfth of total cows", () => {
    assert.equal(
        addDerivedMonthlyMetrics({ crecimientoAnual: 5, vacasTotales: 1200 }).porcentajeCrecimientoActual,
        5
    );
    assert.equal(
        addDerivedMonthlyMetrics({ crecimientoAnual: -5, vacasTotales: 1200 }).porcentajeCrecimientoActual,
        -5
    );
});

test("does not publish an average with only 17 valid peer values", () => {
    const rows = Array.from(
        { length: COMPARISON_MINIMUM_SAMPLE - 1 },
        (_, index) => ({ metric: index + 1 })
    );

    assert.deepEqual(
        averageMetricRows(rows, ["metric"]),
        { metric: null }
    );
});

test("publishes an equal-weight average with exactly 18 valid peer values", () => {
    const rows = Array.from(
        { length: COMPARISON_MINIMUM_SAMPLE },
        (_, index) => ({ metric: index })
    );

    assert.deepEqual(
        averageMetricRows(rows, ["metric"]),
        { metric: 8.5 }
    );
});

test("treats zero as data and null as missing for the per-metric threshold", () => {
    const validRows = Array.from(
        { length: COMPARISON_MINIMUM_SAMPLE },
        () => ({ metric: 0 })
    );

    assert.deepEqual(
        averageMetricRows([...validRows, { metric: null }], ["metric"]),
        { metric: 0 }
    );

    assert.deepEqual(
        averageMetricRows([...validRows.slice(1), { metric: null }], ["metric"]),
        { metric: null }
    );
});
