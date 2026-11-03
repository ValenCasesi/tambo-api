import assert from "node:assert/strict";
import test from "node:test";
import { buildStatsActivitySummary, getMonthlyPeriodEnd } from "./stats-activity.js";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

test("does not warn producers without an active tambo", () => {
    assert.deepEqual(buildStatsActivitySummary(0, null, NOW), {
        shouldWarn: false,
        lastLoadedAt: null,
        lastReportedPeriod: null,
        daysWithoutStats: null
    });
});

test("warns when an active producer has no non-empty monthly statistics", () => {
    assert.deepEqual(buildStatsActivitySummary(1, null, NOW), {
        shouldWarn: true,
        lastLoadedAt: null,
        lastReportedPeriod: null,
        daysWithoutStats: null
    });
});

test("does not warn during the first 30 days after a load", () => {
    assert.equal(buildStatsActivitySummary(1, daysAgo(30), NOW).shouldWarn, false);
});

test("warns as soon as more than 30 days have elapsed", () => {
    const thirtyDaysAndOneMinuteAgo = new Date(daysAgo(30).getTime() - 60_000);
    const summary = buildStatsActivitySummary(1, thirtyDaysAndOneMinuteAgo, NOW);

    assert.equal(summary.shouldWarn, true);
    assert.equal(summary.daysWithoutStats, 30);
});

test("uses the end of the latest reported month to measure stale statistics", () => {
    const periodEnd = getMonthlyPeriodEnd(2026, 6);
    const summary = buildStatsActivitySummary(1, periodEnd, NOW, "202606");

    assert.equal(summary.shouldWarn, true);
    assert.equal(summary.lastReportedPeriod, "202606");
    assert.equal(summary.daysWithoutStats, 84);
});
