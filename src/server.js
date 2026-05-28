import express from "express";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import session from "express-session";
import { google } from "googleapis";
import { buildSeoInsights } from "./analytics.js";
import { loadReportData } from "./dataLoader.js";
import { renderHtmlReport } from "./renderHtmlReport.js";
import { listGscSites } from "./datasources/gscApi.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OUTPUT_DIR = path.resolve("output");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/reports", express.static(OUTPUT_DIR));

function buildRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  return `${req.protocol}://${req.get("host")}/auth/callback`;
}

function createOAuthClient(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = buildRedirectUri(req);
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getAuthorizedClient(req) {
  const tokens = req.session?.googleTokens;
  if (!tokens) {
    return null;
  }
  const client = createOAuthClient(req);
  client.setCredentials(tokens);
  return client;
}

async function loadSitesForSession(req) {
  const authClient = getAuthorizedClient(req);
  if (!authClient) {
    return [];
  }
  return listGscSites({ authClient });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomePage({ sites = [], authenticated = false, defaultValues = {}, error = "" } = {}) {
  const lookerPath = defaultValues.lookerCsvPath || "samples/gsc-looker-sample.csv";
  const contentPath = defaultValues.contentCsvPath || "samples/content-sample.csv";
  const gscOptions = sites
    .map(
      (site) =>
        `<option value="${escapeHtml(site.siteUrl)}">${escapeHtml(site.siteUrl)} (${escapeHtml(site.permissionLevel)})</option>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SEO Report Builder</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-1: #edf3ea;
      --bg-2: #f9f0df;
      --ink: #12232e;
      --muted: #4f5d75;
      --brand: #2c6e49;
      --accent: #f95738;
      --line: #d7dfdc;
      --card: #fff;
    }
    body {
      margin: 0;
      font-family: "Public Sans", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 8%, rgba(44, 110, 73, 0.22), transparent 24%),
        radial-gradient(circle at 90% 2%, rgba(249, 87, 56, 0.22), transparent 30%),
        linear-gradient(155deg, var(--bg-1), var(--bg-2));
    }
    .shell { width: min(980px, 95vw); margin: 20px auto 40px; }
    .card {
      background: rgba(255,255,255,0.88);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      backdrop-filter: blur(6px);
    }
    h1, h2 { margin: 0 0 10px; font-family: "Space Grotesk", sans-serif; }
    p { margin-top: 0; color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    label { display: block; margin-bottom: 4px; font-weight: 600; font-size: 0.9rem; }
    input, select {
      width: 100%;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      font-size: 0.92rem;
      background: #fff;
    }
    .actions { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    .btn {
      text-decoration: none;
      border: 0;
      display: inline-block;
      padding: 10px 14px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-primary { background: var(--brand); color: #fff; }
    .btn-ghost { background: transparent; color: var(--brand); border: 1px solid var(--brand); }
    .error {
      background: rgba(249, 87, 56, 0.12);
      border: 1px solid rgba(249, 87, 56, 0.4);
      color: #7f1d1d;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .helper { margin-top: 16px; border-top: 1px dashed var(--line); padding-top: 12px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <h1>SEO Report Builder</h1>
      <p>Authenticate Google first, then select an authorized Search Console property.</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
      <div class="actions">
        ${authenticated ? '<a class="btn btn-ghost" href="/auth/logout">Logout Google</a>' : '<a class="btn btn-primary" href="/auth/google">Authenticate Google</a>'}
      </div>

      <form action="/generate" method="post">
        <div class="grid">
          <div>
            <label>Source Type</label>
            <select name="sourceType" id="sourceType">
              <option value="gsc">GSC API (OAuth)</option>
              <option value="looker">Looker CSV</option>
            </select>
          </div>
          <div>
            <label>GSC Property (choose after auth)</label>
            <select name="siteUrl">
              <option value="">${authenticated ? "Select a property" : "Authenticate first"}</option>
              ${gscOptions}
            </select>
          </div>
          <div>
            <label>Search Type</label>
            <select name="searchType">
              <option value="web">web</option>
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="news">news</option>
            </select>
          </div>
          <div>
            <label>Looker CSV Path</label>
            <input type="text" name="lookerCsvPath" value="${escapeHtml(lookerPath)}" />
          </div>
          <div>
            <label>Content Metadata CSV Path</label>
            <input type="text" name="contentCsvPath" value="${escapeHtml(contentPath)}" />
          </div>
          <div>
            <label>Start Date (optional)</label>
            <input type="date" name="startDate" />
          </div>
          <div>
            <label>End Date (optional)</label>
            <input type="date" name="endDate" />
          </div>
          <div>
            <label>Service Key File (optional fallback)</label>
            <input type="text" name="gscKeyFile" placeholder="C:\\keys\\service-account.json" />
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="btn btn-primary">Generate HTML Report</button>
        </div>
      </form>

      <div class="helper">
        <h2>Data format</h2>
        <p>Looker CSV: <code>Date,Page,Clicks,Impressions,CTR,Position</code></p>
        <p>Content CSV: <code>url,title,topic,published_date</code></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

app.get("/auth/google", (req, res) => {
  try {
    const client = createOAuthClient(req);
    const state = Math.random().toString(36).slice(2);
    req.session.oauthState = state;
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [GSC_SCOPE],
      state,
    });
    res.redirect(url);
  } catch (error) {
    res.status(400).send(`Auth config error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

app.get("/auth/callback", async (req, res) => {
  try {
    if (!req.query.code) {
      throw new Error("Missing authorization code.");
    }
    if (!req.query.state || req.query.state !== req.session.oauthState) {
      throw new Error("Invalid OAuth state.");
    }

    const client = createOAuthClient(req);
    const { tokens } = await client.getToken(String(req.query.code));
    req.session.googleTokens = tokens;
    req.session.oauthState = null;
    res.redirect("/");
  } catch (error) {
    res.status(400).send(`OAuth callback failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

app.get("/auth/logout", (req, res) => {
  req.session.googleTokens = null;
  req.session.oauthState = null;
  res.redirect("/");
});

app.get("/", async (req, res) => {
  try {
    const sites = await loadSitesForSession(req);
    res.type("html").send(
      renderHomePage({
        sites,
        authenticated: Boolean(req.session.googleTokens),
      }),
    );
  } catch (error) {
    res.type("html").send(
      renderHomePage({
        authenticated: Boolean(req.session.googleTokens),
        error: error instanceof Error ? error.message : "Failed to load sites.",
      }),
    );
  }
});

app.post("/generate", async (req, res) => {
  try {
    const sourceType = req.body.sourceType || "gsc";
    const authClient = getAuthorizedClient(req);

    if (sourceType === "gsc" && !authClient && !req.body.gscKeyFile && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error("Authenticate with Google first or provide service account key file.");
    }
    if (sourceType === "gsc" && !req.body.siteUrl) {
      throw new Error("Please select a GSC property before generating report.");
    }

    const input = {
      sourceType,
      siteUrl: req.body.siteUrl,
      lookerCsvPath: req.body.lookerCsvPath,
      contentCsvPath: req.body.contentCsvPath,
      searchType: req.body.searchType,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      gscKeyFile: req.body.gscKeyFile || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      authClient,
    };

    const { rows, contentRows, sourceInfo } = await loadReportData(input);
    const insights = buildSeoInsights({
      rows,
      contentRows,
      endDate: input.endDate || sourceInfo.range?.end,
    });

    const reportHtml = renderHtmlReport({ insights, sourceInfo });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, `seo-report-${Date.now()}.html`);
    await fs.writeFile(outputPath, reportHtml, "utf8");
    res.type("html").send(reportHtml);
  } catch (error) {
    const sites = await loadSitesForSession(req).catch(() => []);
    res.status(400).type("html").send(
      renderHomePage({
        sites,
        authenticated: Boolean(req.session.googleTokens),
        error: error instanceof Error ? error.message : "Report generation failed.",
      }),
    );
  }
});

app.listen(PORT, () => {
  console.log(`SEO report app is running at http://localhost:${PORT}`);
});

