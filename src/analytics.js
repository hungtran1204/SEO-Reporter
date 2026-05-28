import dayjs, { clampDateRangeByDays, daysBetweenInclusive, monthKey, parseDate } from "./lib/time.js";

function inRange(dateString, start, end) {
  return dateString >= start && dateString <= end;
}

function filterRowsByRange(rows, start, end) {
  return rows.filter((row) => row.date && inRange(row.date, start, end));
}

function summarizeRows(rows) {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;

  for (const row of rows) {
    const rowClicks = Number(row.clicks || 0);
    const rowImpressions = Number(row.impressions || 0);
    const rowPosition = Number(row.position || 0);

    clicks += rowClicks;
    impressions += rowImpressions;
    weightedPosition += rowPosition * rowImpressions;
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

function calcDelta(current, previous) {
  const absolute = current - previous;
  const percent = previous === 0 ? (current > 0 ? null : 0) : (absolute / previous) * 100;

  return {
    absolute,
    percent,
  };
}

function buildPeriodCard(rows, endDate, periodDays, label) {
  const currentRange = clampDateRangeByDays(endDate, periodDays);

  const prevEnd = dayjs(currentRange.start).subtract(1, "day").format("YYYY-MM-DD");
  const previousRange = clampDateRangeByDays(prevEnd, periodDays);

  const currentRows = filterRowsByRange(rows, currentRange.start, currentRange.end);
  const previousRows = filterRowsByRange(rows, previousRange.start, previousRange.end);

  const currentSummary = summarizeRows(currentRows);
  const previousSummary = summarizeRows(previousRows);

  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    range: currentRange,
    previousRange,
    summary: currentSummary,
    previous: previousSummary,
    delta: {
      clicks: calcDelta(currentSummary.clicks, previousSummary.clicks),
      impressions: calcDelta(currentSummary.impressions, previousSummary.impressions),
      ctr: calcDelta(currentSummary.ctr, previousSummary.ctr),
      position: {
        absolute: previousSummary.position - currentSummary.position,
        percent:
          previousSummary.position === 0
            ? (currentSummary.position === 0 ? 0 : null)
            : ((previousSummary.position - currentSummary.position) / previousSummary.position) * 100,
      },
    },
  };
}

function buildDailySeries(rows, start, end) {
  const grouped = new Map();

  for (const row of rows) {
    if (!inRange(row.date, start, end)) {
      continue;
    }

    const existing = grouped.get(row.date) || {
      date: row.date,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };

    existing.clicks += Number(row.clicks || 0);
    existing.impressions += Number(row.impressions || 0);
    existing.weightedPosition += Number(row.position || 0) * Number(row.impressions || 0);

    grouped.set(row.date, existing);
  }

  return daysBetweenInclusive(start, end).map((date) => {
    const item = grouped.get(date) || {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };

    const ctr = item.impressions > 0 ? item.clicks / item.impressions : 0;
    const position = item.impressions > 0 ? item.weightedPosition / item.impressions : 0;

    return {
      date,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr,
      position,
    };
  });
}

function build3MonthPerformance(rows, endDate) {
  const range = clampDateRangeByDays(endDate, 90);
  const dailySeries = buildDailySeries(rows, range.start, range.end);
  const monthlyMap = new Map();

  for (const row of filterRowsByRange(rows, range.start, range.end)) {
    const key = monthKey(row.date);
    const existing = monthlyMap.get(key) || {
      month: key,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };

    existing.clicks += Number(row.clicks || 0);
    existing.impressions += Number(row.impressions || 0);
    existing.weightedPosition += Number(row.position || 0) * Number(row.impressions || 0);

    monthlyMap.set(key, existing);
  }

  const monthly = Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      month: item.month,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.impressions > 0 ? item.clicks / item.impressions : 0,
      position: item.impressions > 0 ? item.weightedPosition / item.impressions : 0,
    }));

  return {
    range,
    dailySeries,
    monthly,
    total: summarizeRows(filterRowsByRange(rows, range.start, range.end)),
  };
}

function summarizeByUrl(rows, start, end) {
  const grouped = new Map();

  for (const row of rows) {
    if (!inRange(row.date, start, end)) {
      continue;
    }

    const key = row.url;
    const existing = grouped.get(key) || {
      url: key,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };

    existing.clicks += Number(row.clicks || 0);
    existing.impressions += Number(row.impressions || 0);
    existing.weightedPosition += Number(row.position || 0) * Number(row.impressions || 0);

    grouped.set(key, existing);
  }

  return grouped;
}

function pctFromDelta(delta, base) {
  if (base === 0) {
    return delta > 0 ? null : 0;
  }

  return (delta / base) * 100;
}

function buildTrending30Days(rows, endDate) {
  const currentRange = clampDateRangeByDays(endDate, 30);
  const prevEnd = dayjs(currentRange.start).subtract(1, "day").format("YYYY-MM-DD");
  const previousRange = clampDateRangeByDays(prevEnd, 30);

  const currentMap = summarizeByUrl(rows, currentRange.start, currentRange.end);
  const previousMap = summarizeByUrl(rows, previousRange.start, previousRange.end);

  const urls = new Set([...currentMap.keys(), ...previousMap.keys()]);
  const movementRows = [];

  for (const url of urls) {
    const current = currentMap.get(url) || { clicks: 0, impressions: 0, weightedPosition: 0 };
    const previous = previousMap.get(url) || { clicks: 0, impressions: 0, weightedPosition: 0 };

    const clickDelta = current.clicks - previous.clicks;
    const impressionDelta = current.impressions - previous.impressions;
    const clickPct = pctFromDelta(clickDelta, previous.clicks);
    const impressionPct = pctFromDelta(impressionDelta, previous.impressions);

    if (current.clicks === 0 && previous.clicks === 0 && current.impressions === 0 && previous.impressions === 0) {
      continue;
    }

    movementRows.push({
      url,
      currentClicks: current.clicks,
      previousClicks: previous.clicks,
      clickDelta,
      clickPct,
      currentImpressions: current.impressions,
      previousImpressions: previous.impressions,
      impressionDelta,
      impressionPct,
      isNew: previous.clicks === 0 && current.clicks > 0,
      isDropToZero: previous.clicks > 0 && current.clicks === 0,
    });
  }

  const meaningful = movementRows.filter(
    (row) => row.currentImpressions + row.previousImpressions >= 50 || row.currentClicks + row.previousClicks >= 10,
  );

  const trendingUp = [...meaningful]
    .filter((row) => row.clickDelta > 0)
    .sort((a, b) => b.clickDelta - a.clickDelta || b.currentClicks - a.currentClicks)
    .slice(0, 12);

  const trendingDown = [...meaningful]
    .filter((row) => row.clickDelta < 0)
    .sort((a, b) => a.clickDelta - b.clickDelta || b.previousClicks - a.previousClicks)
    .slice(0, 12);

  return {
    currentRange,
    previousRange,
    trendingUp,
    trendingDown,
  };
}

function linearSlope(values) {
  const n = values.length;
  if (n <= 1) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return 0;
  }

  return (n * sumXY - sumX * sumY) / denominator;
}

function build6MonthUrlInsights(rows, endDate) {
  const end = parseDate(endDate) ?? dayjs();
  const monthKeys = [];

  for (let i = 5; i >= 0; i -= 1) {
    monthKeys.push(end.subtract(i, "month").format("YYYY-MM"));
  }

  const keySet = new Set(monthKeys);
  const byUrlByMonth = new Map();

  for (const row of rows) {
    const key = monthKey(row.date);
    if (!keySet.has(key)) {
      continue;
    }

    const urlMap = byUrlByMonth.get(row.url) || new Map();
    const current = urlMap.get(key) || 0;
    urlMap.set(key, current + Number(row.clicks || 0));

    byUrlByMonth.set(row.url, urlMap);
  }

  const metrics = [];

  for (const [url, monthMap] of byUrlByMonth.entries()) {
    const clicksByMonth = monthKeys.map((key) => monthMap.get(key) || 0);
    const firstMonth = clicksByMonth[0];
    const lastMonth = clicksByMonth[clicksByMonth.length - 1];
    const delta = lastMonth - firstMonth;
    const pct = pctFromDelta(delta, firstMonth);
    const slope = linearSlope(clicksByMonth);
    const totalClicks = clicksByMonth.reduce((sum, value) => sum + value, 0);

    metrics.push({
      url,
      clicksByMonth,
      firstMonth,
      lastMonth,
      delta,
      pct,
      slope,
      totalClicks,
    });
  }

  const filtered = metrics.filter((item) => item.totalClicks >= 20);

  const topIncreaseMost = [...filtered]
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 12);

  const topDecreaseMost = [...filtered]
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 12);

  const topIncreaseFast = [...filtered]
    .filter((item) => item.slope > 0)
    .sort((a, b) => b.slope - a.slope)
    .slice(0, 12);

  const topDecreaseFast = [...filtered]
    .filter((item) => item.slope < 0)
    .sort((a, b) => a.slope - b.slope)
    .slice(0, 12);

  const signals = [...filtered]
    .filter((item) => Math.abs(item.delta) >= 10)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 25)
    .map((item) => ({
      url: item.url,
      direction: item.delta >= 0 ? "up" : "down",
      delta: item.delta,
      pct: item.pct,
      slope: item.slope,
      firstMonth: item.firstMonth,
      lastMonth: item.lastMonth,
    }));

  return {
    monthKeys,
    topIncreaseMost,
    topDecreaseMost,
    topIncreaseFast,
    topDecreaseFast,
    signals,
  };
}

function buildThisMonthPublishing(contentRows, endDate) {
  const end = parseDate(endDate) ?? dayjs();
  const monthStart = end.startOf("month").format("YYYY-MM-DD");
  const monthEnd = end.format("YYYY-MM-DD");

  const thisMonth = contentRows
    .filter((item) => inRange(item.publishedDate, monthStart, monthEnd))
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  const topicMap = new Map();

  for (const item of thisMonth) {
    const key = item.topic || "Unknown";
    topicMap.set(key, (topicMap.get(key) || 0) + 1);
  }

  const topics = Array.from(topicMap.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  return {
    month: end.format("YYYY-MM"),
    range: {
      start: monthStart,
      end: monthEnd,
    },
    count: thisMonth.length,
    topics,
    items: thisMonth,
  };
}

function inferDateSpan(rows) {
  if (!rows.length) {
    return null;
  }

  let min = rows[0].date;
  let max = rows[0].date;

  for (const row of rows) {
    if (row.date < min) {
      min = row.date;
    }

    if (row.date > max) {
      max = row.date;
    }
  }

  return { start: min, end: max };
}

export function buildSeoInsights({ rows, contentRows = [], endDate }) {
  const dataEnd = parseDate(endDate) ?? (rows.length ? parseDate(inferDateSpan(rows).end) : dayjs());
  const safeEnd = dataEnd.format("YYYY-MM-DD");

  const periodCards = [
    buildPeriodCard(rows, safeEnd, 7, "Weekly"),
    buildPeriodCard(rows, safeEnd, 30, "Monthly"),
    buildPeriodCard(rows, safeEnd, 90, "3 Months"),
    buildPeriodCard(rows, safeEnd, 180, "6 Months"),
  ];

  return {
    generatedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    reportEndDate: safeEnd,
    dataSpan: inferDateSpan(rows),
    periodCards,
    thisMonthPublishing: buildThisMonthPublishing(contentRows, safeEnd),
    performance3Months: build3MonthPerformance(rows, safeEnd),
    trending30Days: buildTrending30Days(rows, safeEnd),
    url6MonthInsights: build6MonthUrlInsights(rows, safeEnd),
  };
}
