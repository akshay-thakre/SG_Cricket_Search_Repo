# CricSearch SG 🏏

Search cricket player stats across Singapore cricket platforms — live data, aggregated in one place.

## Architecture

This is a **full-stack monorepo** with two services:

| Service | Directory | Technology | Role |
|---------|-----------|------------|------|
| Backend API | `cricsearch-backend/` | Express + Node.js | Server-side scraping of SCA (CricClubs) player data |
| Frontend SPA | `cricsearch-sg/` | React (CRA) | Search UI and in-app stats display |

The backend **must** run server-side — all scraping uses Cheerio + Axios and hits the SCA website. Browsers cannot call SCA directly due to CORS restrictions.

---

## Local Development

### Prerequisites
- Node.js ≥ 18
- npm ≥ 8

### 1. Start the Backend

```bash
cd cricsearch-backend
npm install
cp .env.example .env      # edit if needed
npm start                  # starts on http://localhost:5000
```

Verify it works:
```bash
curl http://localhost:5000/api/health
```

### 2. Start the Frontend

```bash
cd cricsearch-sg
npm install
cp .env.example .env      # sets REACT_APP_API_URL=http://localhost:5000
npm start                  # opens http://localhost:3000
```

### 3. Run Tests

```bash
# Backend unit tests (34 tests)
cd cricsearch-backend && npm test

# Frontend tests
cd cricsearch-sg && CI=true npm test
```

### 4. Production build check (same command Render runs)

```bash
cd cricsearch-sg
CI=false GENERATE_SOURCEMAP=false npm run build
# Build output is in cricsearch-sg/build/
```

---

## Production Deployment on Render

This app is configured for [Render](https://render.com) using `render.yaml`.  
**Two services are required**: one Web Service (backend) and one Static Site (frontend).

### Step 1 — Connect GitHub to Render

1. Go to [render.com](https://render.com) and sign in
2. **New → Blueprint** → connect your GitHub repo (`SG_Cricket_Search_Repo`)
3. Render reads `render.yaml` and shows both services — confirm

> Or create each service manually using the values in **Manual Setup** below.

---

### Step 2 — Deploy the Backend First

If using Blueprint, proceed to Step 3. For manual setup:

| Setting | Value |
|---------|-------|
| Service type | **Web Service** |
| Runtime | **Node** |
| Root Directory | `cricsearch-backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check Path | `/api/health` |
| Region | Singapore (or nearest to you) |
| Plan | Free |

**Environment variables to add in Render dashboard:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DEBUG_SCRAPER` | `false` |
| `ALLOWED_ORIGIN` | _(leave blank to allow all, or set to frontend URL after Step 3)_ |

After deploy, note your backend URL — e.g. `https://cricsearch-backend.onrender.com`

---

### Step 3 — Deploy the Frontend

| Setting | Value |
|---------|-------|
| Service type | **Static Site** |
| Root Directory | `cricsearch-sg` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `build` |

**Environment variables to add in Render dashboard:**

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://cricsearch-backend.onrender.com` ← your actual backend URL |
| `CI` | `false` |
| `GENERATE_SOURCEMAP` | `false` |

> ⚠️ `REACT_APP_API_URL` is baked into the React bundle at build time. If you change the backend URL you must **redeploy the frontend**.

---

### Step 4 — Wire up CORS (optional but recommended)

After both services are deployed:

1. Go to the **backend** service in Render dashboard → Environment
2. Add `ALLOWED_ORIGIN` = your frontend URL (e.g. `https://cricsearch-frontend.onrender.com`)
3. Click **Save Changes** — backend redeploys automatically

---

### Step 5 — Verify

```
https://cricsearch-backend.onrender.com/api/health
# Should return: { "status": "ok", ... }

https://cricsearch-frontend.onrender.com
# Should show the search page

# Search "Kintul" — player cards should appear with stats loading
```

---

## Environment Variables Reference

### Backend (`cricsearch-backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Auto-provided by Render — do not set manually |
| `NODE_ENV` | No | `development` | Set to `production` on Render |
| `DEBUG_SCRAPER` | No | `false` | Set `true` to enable verbose scraper logs |
| `ALLOWED_ORIGIN` | No | _(all allowed)_ | Comma-separated list of allowed CORS origins |

### Frontend (`cricsearch-sg/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_API_URL` | **Yes** | `http://localhost:5000` | Backend API base URL |
| `CI` | No | — | Set `false` to prevent warnings failing the build |
| `GENERATE_SOURCEMAP` | No | `true` | Set `false` to skip source maps (faster build) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend health check |
| GET | `/api/sca/health` | SCA-specific health check |
| POST | `/api/sca/players/search` | Search players by name/team/ID |
| GET | `/api/sca/players/:id/stats` | Fetch player profile stats |
| GET | `/api/sca/clubs` | List all SCA clubs |

---

## Troubleshooting Render Errors

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Backend shows "failed to start" | Wrong start command | Confirm Root Dir = `cricsearch-backend`, Start = `node server.js` |
| Frontend build fails | Missing `REACT_APP_API_URL` | Add the env var in Render dashboard and redeploy |
| Search returns network error | Wrong `REACT_APP_API_URL` | Check the URL points to your actual backend service |
| CORS error in browser console | `ALLOWED_ORIGIN` too strict | Set `ALLOWED_ORIGIN` to include your frontend URL, or leave blank |
| Free tier sleeps after 15 min | Render free plan behavior | First request after sleep is slow (~30s). Upgrade plan or use a ping service |
| Stats show "unavailable" | SCA website structure changed | Check backend logs — the HTML parser may need selector updates |

### Checking Logs on Render

1. Open the service in Render dashboard
2. Click **Logs** in the left sidebar
3. For backend errors: look for `[SCA:search]` or `[SCA:stats]` prefixed messages
4. For build errors: check the **Events** tab

---

## Project Structure

```
SG_Cricket_Search_Repo/
├── render.yaml                        # Render deployment config
├── .gitignore
├── README.md
├── cricsearch-backend/                # Express API
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── routes/sca.routes.js
│       └── services/sca/
│           ├── sca.client.js          # HTTP session management
│           ├── sca.parser.js          # Search results HTML parser
│           ├── sca.profile.js         # Profile page stats parser
│           ├── sca.selectors.js       # CSS selectors & URL config
│           ├── sca.service.js         # Orchestration
│           └── __tests__/
│               └── sca.profile.test.js
└── cricsearch-sg/                     # React frontend
    ├── package.json
    ├── .env.example
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── AggregatedResults.jsx  # Player stats cards
        │   └── MultiPlatformSearchBar.jsx
        └── services/
            └── apiService.js          # API client
```

---

## Limitations

- **Free tier cold starts**: Render free Web Services spin down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds.
- **SCA scraping reliability**: If SCA changes their HTML structure, the parser selectors may need updating.
- **Only SCA is live**: Stumps, Last Man Stands, and CricHeroes integrations are planned for Phase 2.
- **Stats availability**: If a player has no recorded matches, stats show "No statistics recorded for this player yet."
