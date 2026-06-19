# Called It

Paid X trader scans with MPP, async jobs, price-backed call scoring, and public scorecards. Local testing is currently configured for a one-year scan window via `TWITTER_LOOKBACK_DAYS=365`.

## Structure

| Path | Purpose |
| --- | --- |
| `apps/api` | Fastify API, MPP payment gate, scan routes, worker entrypoint. |
| `apps/web` | Next.js app for leaderboard, paid scan flow, and profile scorecards. |
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

## Environment

Use `.env` for local secrets and provider keys. The app expects keys for the real scan stack, including X/Twitter data, OpenAI classification, price providers, Neon, and the MPP recipient/payment settings.

Important production knobs:

| Variable | Purpose |
| --- | --- |
| `SCAN_PRICE=2.00` | Amount charged for each fresh scan request. Cached public scorecards stay free to view. |
| `TWITTERAPI_IO_API_KEYS` | Comma-separated TwitterAPI.io key pool. The fetcher rotates across these keys. |
| `TWITTERAPI_IO_MIN_INTERVAL_MS` | Minimum delay per TwitterAPI.io key. Defaults to the Proof of Hype-style `50`ms cadence. |
| `TWITTERAPI_IO_FETCH_CONCURRENCY` | Timeline window fanout. Defaults to `max(50, keyCount * 25)`, so the five-key pool runs `125` window workers. |
| `TWITTERAPI_IO_DENSE_PROBE_PAGES` | Pages to probe before splitting dense tweet windows. Defaults to `4`. |
| `OPENAI_MODEL=gpt-5.4` | Classification and ambiguous ticker-resolution model. |
| `ALLOW_DEV_PAID_SCAN=true` | Local-only escape hatch for `x-dev-paid` / `?dev=1`. Leave unset in production. |
