import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import isoWeek from "dayjs/plugin/isoWeek.js";

dayjs.extend(customParseFormat);
dayjs.extend(isoWeek);

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DDTHH:mm:ssZ",
];

export function parseDate(value) {
  if (!value) {
    return null;
  }

  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value : null;
  }

  if (value instanceof Date) {
    const parsedFromDate = dayjs(value);
    return parsedFromDate.isValid() ? parsedFromDate : null;
  }

  const asText = String(value).trim();
  if (!asText) {
    return null;
  }

  const strictMatch = dayjs(asText, DATE_FORMATS, true);
  if (strictMatch.isValid()) {
    return strictMatch;
  }

  const looseMatch = dayjs(asText);
  return looseMatch.isValid() ? looseMatch : null;
}

export function toISODate(value) {
  const parsed = parseDate(value);
  return parsed ? parsed.format("YYYY-MM-DD") : null;
}

export function daysBetweenInclusive(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end.isBefore(start, "day")) {
    return [];
  }

  const dates = [];
  let cursor = start.startOf("day");
  const last = end.startOf("day");

  while (cursor.isBefore(last, "day") || cursor.isSame(last, "day")) {
    dates.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }

  return dates;
}

export function clampDateRangeByDays(endDate, days) {
  const end = parseDate(endDate) ?? dayjs();
  const safeDays = Number(days);
  if (!Number.isFinite(safeDays) || safeDays <= 0) {
    throw new Error("days must be a positive number");
  }
  const start = end.subtract(safeDays - 1, "day");

  return {
    start: start.format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD"),
  };
}

export function monthKey(dateValue) {
  const parsed = parseDate(dateValue);
  return parsed ? parsed.format("YYYY-MM") : null;
}

export default dayjs;
