# Called It

Free X/Twitter trader scans with async jobs, price-backed call scoring, public scorecards, and a leaderboard. Local testing is currently configured for a one-year scan window via `TWITTER_LOOKBACK_DAYS=365`.

## Structure

| Path | Purpose |
| --- | --- |
| `apps/api` | Fastify API, scan routes, feedback endpoint, and worker entrypoint. |
| `apps/web` | Next.js app for leaderboard, free scan flow, and profile scorecards. |
| `packages/core` | Shared tweet scanning, classification, asset resolution, pricing, and scoring logic. |
| `packages/db` | Drizzle schema, Neon client, migrations, and DB queries. |

Optional local tweet/classification cache lives in `.cache/twitter` and is ignored.

## Commands

```bash
bun install
bun run db:migrate
bun run api
bun run web
bun run typecheck
```

## Deployment

### Backend: Railway

Railway should deploy from the repo root. `railway.json` uses Nixpacks, starts the API with `bun run api`, and checks `/health`.

Set production env vars in Railway, including:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon/Postgres connection string. |
| `OPENAI_API_KEY` | Classification and ticker-resolution calls. |
| `TWITTERAPI_IO_API_KEYS` | Comma-separated TwitterAPI.io key pool. |
| `NIXPACKS_NODE_VERSION=22` | Forces Railway's Nixpacks builder off the Node 18 default. |

Railway supplies `PORT`; the API also honors `API_PORT` for local overrides.

### Frontend: Vercel

Vercel should deploy from the repo root. `vercel.json` installs with Bun and builds the web app with `bun run build:web`.

Optional:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public Railway API URL override. Production defaults to `https://called-it-api-production.up.railway.app`. |

## Environment

Use `.env` for local secrets and provider keys. The app expects keys for the real scan stack, including X/Twitter data, OpenAI classification, and Neon/Postgres.

Important production knobs:

| Variable | Purpose |
| --- | --- |
| `TWITTERAPI_IO_API_KEYS` | Comma-separated TwitterAPI.io key pool. The fetcher rotates across these keys. |
| `TWITTERAPI_IO_MIN_INTERVAL_MS` | Minimum delay per TwitterAPI.io key. Defaults to the Proof of Hype-style `50`ms cadence. |
| `TWITTERAPI_IO_FETCH_CONCURRENCY` | Timeline window fanout. Defaults to `max(50, keyCount * 25)`, so the five-key pool runs `125` window workers. |
| `TWITTERAPI_IO_DENSE_PROBE_PAGES` | Pages to probe before splitting dense tweet windows. Defaults to `4`. |
| `OPENAI_MODEL=gpt-5.4` | Classification and ambiguous ticker-resolution model. |
