# Called It

Paid X trader scans with MPP, async jobs, price-backed call scoring, and public scorecards. Local testing is currently configured for a 30-day scan window via `TWITTER_LOOKBACK_DAYS=30`.

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
