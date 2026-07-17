# Called It

Called It turns public X/Twitter ticker calls into price-backed scorecards.
Enter an X handle, wait for an asynchronous scan, then review direction-adjusted returns, call history, supporting posts, and leaderboard placement.

Called It is an experimental measurement tool, not investment advice or a complete record of a person's trading performance.

## How it works

1. The API validates an X handle and reuses a fresh scorecard when one exists.
2. A worker fetches the public profile and timeline, extracts cashtags, and asks OpenAI to classify high-conviction bullish or bearish calls.
3. Shared pricing logic resolves assets and looks up historical and current market prices.
4. The worker stores the scorecard in Postgres for the Next.js web app and public API.

The default scan window is 365 days.
The score starts each call from the previous available daily close, adjusts returns for bullish or bearish direction, and starts a new leg when the classified stance changes.
Hit rate is the share of priced call legs with a positive direction-adjusted return.

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or newer.
- A Postgres database reachable through `@neondatabase/serverless`; Neon is the currently tested provider.
- A [TwitterAPI.io](https://twitterapi.io/) key for X profile and timeline data.
- An [OpenAI API](https://developers.openai.com/api/docs/overview) key for call classification and ambiguous ticker resolution.

Yahoo Finance chart and search endpoints provide equity and ETF data without a repository credential.
[Hyperliquid](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) public APIs provide crypto and perpetual-market data.
Those public endpoints can change or rate-limit callers independently of this project.

## Local setup

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Fill the required values in `.env`, then initialize the database:

```bash
bun run db:migrate
```

Start the API and web app in separate terminals:

```bash
bun run api
bun run web
```

Open `http://127.0.0.1:3002`.
The API defaults to `http://127.0.0.1:3001`.

The UI and API run locally, but a complete scan is not offline-only.
It requires Postgres, TwitterAPI.io, OpenAI, Yahoo Finance, and Hyperliquid network access.
Ignored files under `.cache/twitter/` can replace some X and classification requests for development, but no cache or proprietary dataset is included.

## Configuration

Required values are intentionally blank in [`.env.example`](.env.example).
Never commit a populated environment file, Neon link file, provider credential, database dump, or local cache.

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API and migrations | Postgres connection string. |
| `OPENAI_API_KEY` | New scans | Classification and ambiguous asset resolution. |
| `TWITTERAPI_IO_API_KEYS` | New scans | Comma-separated TwitterAPI.io key pool. |
| `NEXT_PUBLIC_API_URL` | Production web build | Browser-visible base URL for the API. |
| `NEXT_PUBLIC_SITE_URL` | Production web build | Canonical public URL used for metadata and share images. |
| `CORS_ORIGIN` | Production API | Comma-separated browser origins allowed to call the API. |

The scanner also accepts one key through `TWITTERAPI_IO_API_KEY` or `TWITTERAPI_IO_FALLBACK_API_KEY`.
Common optional controls include `API_PORT`, `WEB_PORT`, `SCAN_WORKER_ENABLED`, `TWITTER_LOOKBACK_DAYS`, `TWITTER_WINDOW_DAYS`, `TWITTER_MAX_PAGES_PER_WINDOW`, `TWITTERAPI_IO_FETCH_CONCURRENCY`, `OPENAI_MODEL`, `OPENAI_CLASSIFY_BATCH_SIZE`, `OPENAI_CLASSIFY_CONCURRENCY`, and `PRICING_CONCURRENCY`.
See the provider adapters for the remaining tuning controls.

Missing database or worker credentials fail before the corresponding process starts.
Production web builds fail without explicit public API and site URLs.
Production API startup fails without an explicit CORS allowlist.

## Development

```bash
bun run test
bun run lint
bun run typecheck
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 \
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3002 \
  bun run build:web
```

With a configured `.env`, run the full local gate with:

```bash
bun run check
```

## Architecture and data sources

| Path | Responsibility |
| --- | --- |
| [`apps/web`](apps/web) | Next.js UI for scans, scorecards, share images, and the leaderboard. |
| [`apps/api`](apps/api) | Fastify API, asynchronous scan worker, feedback endpoint, and health check. |
| [`packages/core`](packages/core) | X fetching, classification, asset resolution, pricing, and scoring. |
| [`packages/db`](packages/db) | Drizzle schema, migrations, Neon/Postgres client, and queries. |
| [`packages/core/src/twitter`](packages/core/src/twitter) | TwitterAPI.io integration and ignored local cache format. |
| [`packages/core/src/pricing`](packages/core/src/pricing) | Yahoo Finance and Hyperliquid pricing adapters. |
| [`railway.json`](railway.json) | Example API deployment configuration. |
| [`vercel.json`](vercel.json) | Example web deployment configuration. |

## Scoring, privacy, and operational limits

- Classification is probabilistic and conservative, but it can still miss context, sarcasm, deleted posts, position sizing, exits, or hedges.
- Daily equity bars make the entry price an approximation rather than the execution price of a trade.
- Symbol resolution, corporate actions, delistings, market outages, provider coverage, and stale prices can distort results.
- A scorecard measures public directional calls only; it does not measure a full portfolio, realized profit, risk, or credibility.
- The database stores public profile fields, public post text and URLs, derived stances and prices, scan state, and submitted correction feedback.
- Feedback records include the submitting browser's user-agent string; the feedback rate limiter hashes IP and user-agent data in memory and does not persist the IP address.
- Scorecard API responses include stored public post text by default.
- Provider quotas and costs scale with lookback length, pagination, concurrency, and the number of scans.
- The repository does not yet provide distributed scan rate limiting or authentication, so add an edge or shared-store abuse control before exposing a deployment to untrusted traffic.

## License and contributions

No project license has been selected.
Until a license is added, the code is publicly visible but is not licensed for reuse, modification, or redistribution.
Contributions are not currently accepted because contribution terms and governance have not been defined.
Choose a license and contribution policy before describing the project as open source.
