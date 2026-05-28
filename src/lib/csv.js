import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { parseDate, toISODate } from "./time.js";

const LOOKER_COLUMN_ALIASES = {
  date: ["date", "day", "ngay", "ngày"],
  url: ["page", "url", "landing page", "landing_page", "page url", "page_url"],
  clicks: ["clicks", "url clicks", "click"],
  impressions: ["impressions", "url impressions", "impression"],
  ctr: ["ctr", "url ctr", "click through rate"],
  position: ["position", "url position", "average position", "avg position"],
};

const CONTENT_COLUMN_ALIASES = {
  url: ["url", "page", "link"],
  title: ["title", "post title", "article", "ten bai", "tieu de", "tiêu đề"],
  topic: ["topic", "category", "chuyen muc", "chủ đề", "chuyen_de", "tag"],
  publishedDate: [
    "published_date",
    "publish_date",
    "published date",
    "publish date",
    "date",
    "ngay dang",
    "ngày đăng",
  ],
};

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function resolveColumn(row, aliases) {
  const normalizedToRaw = new Map();
  for (const [rawKey, value] of Object.entries(row)) {
    normalizedToRaw.set(normalizeHeader(rawKey), value);
  }

  for (const alias of aliases) {
    const value = normalizedToRaw.get(normalizeHeader(alias));
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return 0;
  }

  const isPercent = normalized.endsWith("%");
  const cleaned = normalized.replace(/[,\s%]/g, "");
  const parsed = Number.parseFloat(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return isPercent ? parsed / 100 : parsed;
}

export async function parseCsvFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const csvContent = await fs.readFile(absolutePath, "utf8");

  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });
}

export async function loadLookerCsvRows(filePath) {
  const rows = await parseCsvFile(filePath);

  return rows
    .map((row) => {
      const isoDate = toISODate(resolveColumn(row, LOOKER_COLUMN_ALIASES.date));
      const url = resolveColumn(row, LOOKER_COLUMN_ALIASES.url);

      if (!isoDate || !url) {
        return null;
      }

      const impressions = toNumber(resolveColumn(row, LOOKER_COLUMN_ALIASES.impressions));
      const clicks = toNumber(resolveColumn(row, LOOKER_COLUMN_ALIASES.clicks));
      const rawCtr = resolveColumn(row, LOOKER_COLUMN_ALIASES.ctr);
      const parsedCtr = toNumber(rawCtr);

      const ctr =
        parsedCtr > 1 && parsedCtr <= 100
          ? parsedCtr / 100
          : Math.max(0, Math.min(1, parsedCtr || (impressions > 0 ? clicks / impressions : 0)));

      const position = toNumber(resolveColumn(row, LOOKER_COLUMN_ALIASES.position));

      return {
        date: isoDate,
        url: String(url).trim(),
        clicks,
        impressions,
        ctr,
        position,
      };
    })
    .filter(Boolean);
}

export async function loadContentMetadataRows(filePath) {
  if (!filePath) {
    return [];
  }

  const rows = await parseCsvFile(filePath);

  return rows
    .map((row) => {
      const url = resolveColumn(row, CONTENT_COLUMN_ALIASES.url);
      const publishedDate = toISODate(resolveColumn(row, CONTENT_COLUMN_ALIASES.publishedDate));

      if (!url || !publishedDate) {
        return null;
      }

      const title = resolveColumn(row, CONTENT_COLUMN_ALIASES.title);
      const topic = resolveColumn(row, CONTENT_COLUMN_ALIASES.topic);
      const parsedDate = parseDate(publishedDate);

      return {
        url: String(url).trim(),
        publishedDate,
        title: title ? String(title).trim() : "",
        topic: topic ? String(topic).trim() : "Unknown",
        monthKey: parsedDate ? parsedDate.format("YYYY-MM") : "",
      };
    })
    .filter(Boolean);
}
