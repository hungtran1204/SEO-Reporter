# SEO Report App (GSC / Looker CSV)

SEO reporting app with weekly, monthly, 3-month, and 6-month insights.

## Features

- This month publishing summary (count, topic, URL)
- Last 3 months SEO performance
- Trending up/down URLs in last 30 days
- 6-month URL movement signals
- HTML visualization report

## Local Setup

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## OAuth Setup (Google)

Required environment variables:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
```

Optional:

```bash
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GOOGLE_APPLICATION_CREDENTIALS=./keys/service-account.json
```

## Vercel Deployment

This project is configured for Vercel serverless with:

- `api/index.js` as serverless entrypoint
- `vercel.json` rewrite all routes to `api/index.js`
- `src/app.js` (Express app, no direct `listen`)

### Steps

1. Import GitHub repo into Vercel.
2. Framework preset: `Other`.
3. Root Directory: repo root (where `package.json` exists).
4. Add environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET`
   - `GOOGLE_REDIRECT_URI` (must match your production domain callback)
5. Deploy.

### OAuth Redirect URI for production

If your Vercel domain is:

`https://seo-reporter.vercel.app`

set callback:

`https://seo-reporter.vercel.app/auth/callback`

and add this exact URI in Google Cloud OAuth client settings.

## CLI Generate

```bash
npm run generate -- --source looker --lookerCsvPath samples/gsc-looker-sample.csv --contentCsvPath samples/content-sample.csv
```

Output file is written to `output/` in local environment.

## Data Files

- `samples/gsc-looker-sample.csv`
- `samples/content-sample.csv`

