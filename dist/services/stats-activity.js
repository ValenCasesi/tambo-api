export const STATS_INACTIVITY_WARNING_DAYS = 30;
export function buildStatsActivitySummary(activeTamboCount, latestLoadedAt, now = new Date(), lastReportedPeriod = null) {
    if (activeTamboCount === 0) {
        return {
            shouldWarn: false,
            lastLoadedAt: null,
            lastReportedPeriod: null,
            daysWithoutStats: null
        };
    }
    if (!latestLoadedAt) {
        return {
            shouldWarn: true,
            lastLoadedAt: null,
            lastReportedPeriod: null,
            daysWithoutStats: null
        };
    }
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const elapsedMilliseconds = Math.max(0, now.getTime() - latestLoadedAt.getTime());
    const daysWithoutStats = Math.floor(elapsedMilliseconds / millisecondsPerDay);
    return {
        shouldWarn: elapsedMilliseconds > STATS_INACTIVITY_WARNING_DAYS * millisecondsPerDay,
        lastLoadedAt: latestLoadedAt.toISOString(),
        lastReportedPeriod,
        daysWithoutStats
    };
}
export function getMonthlyPeriodEnd(year, month) {
    return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}
