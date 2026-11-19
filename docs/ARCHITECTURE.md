# MoneyTrack Architecture

MoneyTrack is a local-first personal finance manager: it ingests bank and
credit-card statements (PDF/CSV/TSV), classifies spending, enforces a fixed
monthly budget plan, flags "waste", and explains the numbers through local AI.

The same codebase runs on a Raspberry Pi, a small VM, or a laptop on Windows,
macOS, and Linux.

---

## 1. High-level shape

```
┌──────────────────────────┐        ┌────────────────────────────┐
│  Browser (React + Vite)  │  /api  │  Node/Express API (:4000)  │
│  dashboard, auth, upload │ ─────► │  auth, parsing, analytics  │
└──────────────────────────┘        └─────────────┬──────────────┘
                                                  │ Prisma ORM
                                        ┌─────────▼─────────┐
                                        │ SQLite (default)  │
                                        │ PostgreSQL (opt.) │
                                        └───────────────────┘
```

Single-process deployment: `node server.js` serves the built SPA from `dist/`
and exposes the REST API on the same origin, so there is no CORS or second port
in production. In development Vite (:5173) proxies `/api` to :4000.

## 2. Technology choices

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + Vite | Fast dev loop, small runtime bundle |
| Styling | Tailwind CSS v4 | Utility-first, no runtime CSS-in-JS cost |
| Charts | Recharts | SVG charts, works on low-power devices |
| Icons | lucide-react | Tree-shaken SVG icons |
| API | Express 5 | Tiny, no framework overhead |
| Uploads | multer (memory) + pdf-parse | Statements stay in memory; pure-JS PDF text extraction |
| Budgets | `server/lib/plan.js` | Fixed limits, per-month overrides, smart plan |
| AI | Ollama → Python skill → JS rules | Local-first answers with graceful degradation |
| ORM | Prisma 7 | One schema for SQLite and PostgreSQL |
| DB driver | libSQL adapter | Escape hatch to Turso/remote SQLite later |
| DB (default) | SQLite | Zero-admin, file-based, ideal for Pi/VM |
| DB (scale) | PostgreSQL | Years of transactions, concurrent users |

## 3. Data model

`prisma/schema.prisma`

- **User** — `username` (unique), `password`, `isAdmin`.
  No server-side session: the client stores the authenticated user and sends
  `x-user-id` on API calls. Suitable for a local-first single-household app;
  see §7 for hardening.
- **Account** — bank/credit accounts owned by a user (reserved for multi-account
  imports; statement upload currently writes transactions without an account).
- **Transaction** — `date`, `description`, `amount`, `category`, `isWaste`.
- **Budget** — per-category monthly limit. Rows with `month = "default"` form
  the standing plan; a `YYYY-MM` row overrides it for one month.

Indexes worth adding as data grows: `Transaction(userId, date)` and
`Transaction(userId, category)`.

## 4. Request lifecycle

1. **Auth** — `POST /api/v1/auth/login` with `{username, password}`.
   - If the username does not exist, the account is self-registered.
   - If the database has zero users, the new account gets `isAdmin: true`.
   - If the username exists, the password must match.
2. **Upload** — `POST /api/v1/transactions/upload` (multipart `file`).
   - CSV/TSV is split on commas/tabs; PDF text is extracted with `pdf-parse`.
   - Dated rows with an amount are imported; balances, totals and credits are
     skipped. Scanned PDFs return `422` with CSV guidance.
   - Keyword rules map descriptions to categories and mark leaky spend
     (`Dining Out`, `Subscriptions`, `Fees`).
   - Rows are inserted with `createMany`, then a summary plus `import` metadata
     (source, pages, row count) is returned.
3. **Analytics** — `GET /api/v1/analytics/summary` aggregates all transactions
   into totals, category shares, an annualized waste projection, and a
   10-year invested-value estimate (7% APY, monthly compounding).
4. **Budgets** — `GET /api/v1/budgets?month=YYYY-MM` joins the standing plan
   and overrides with that month's spend and assigns `ok`/`warn`/`over` status.
   `POST /budgets` edits a limit; `POST /budgets/generate` derives a plan from
   the previous three months.
5. **Reports** — `GET /api/v1/reports?month=YYYY-MM` compares the month with
   the previous one, ranks merchants, lists six-month history and writes plain
   language insights.
6. **AI** — `POST /api/v1/ai/ask` builds a compact JSON context (totals,
   budgets, merchants, history) and tries Ollama, then
   `skills/spend_skill.py`, then built-in JS rules.
7. **Demo** — `POST /api/v1/demo/load` replaces the user's transactions with
   90 days of generated data for instant exploration.

## 4b. Frontend structure

```
src/
  App.jsx                 auth gate, hash router, data loading
  components/
    AppShell.jsx          sidebar (≥1024px) + 5-slot bottom nav + More sheet
    AuthPage.jsx          register/login split screen
    ui.jsx                Card, Button, Badge, Spinner, EmptyState, ErrorNote
    charts.jsx            area trend, category donut, monthly bars (Recharts)
  pages/
    Overview.jsx          KPIs, trend, donut, budget health, recent list
    Transactions.jsx      search / category / waste filters, CSV export
    Budgets.jsx           month stepper, ring, limits, alerts, smart plan
    Reports.jsx           totals, 6-month bars, category movement, merchants
    AiSkills.jsx          chat, suggestions, engine status
    Import.jsx            PDF/CSV dropzone, demo loader, parsing explainer
    Settings.jsx          account, runtime status, data controls
  lib/
    api.js                fetch wrapper, adds x-user-id
    format.js             currency, dates, category colours
server/
  lib/demo.js             categorisation, summaries, demo generator
  lib/statement.js        CSV/TSV/PDF parsing
  lib/plan.js             budget plan, overrides, smart generation
  lib/reports.js          monthly report builder
  lib/ai.js               Ollama → Python → JS answer cascade
skills/spend_skill.py     deterministic offline Q&A skill
```

Routing is `location.hash` (`#overview`, `#transactions`, `#budgets`,
`#reports`, `#ai`, `#import`, `#settings`) so the back button and deep links
work without a router dependency. Shared server state is fetched in `App.jsx`;
budget/report/AI pages load their own month-scoped data.

Visual rules, tokens, breakpoints and accessibility checks live in
[`DESIGN.md`](./DESIGN.md).

## 5. Waste model

A transaction is "waste" when its category is one of:

- Dining Out (delivery, coffee, restaurants)
- Subscriptions (streaming, memberships)
- Fees (ATM, late payment, overdraft)

Waste drives three derived metrics: current waste total, `waste × 12`
(annual projection), and the future value of investing that annual amount
monthly for 10 years at 7% APY.

These rules live in one place (`categorize()` in `server/lib/demo.js`) so they
can be replaced by user-defined rules or an LLM classifier later.

## 5b. Budget model

Twelve fixed categories ship by default: Housing, Groceries, Utilities,
Transport, Health & Fitness, Dining Out, Subscriptions, Fees, Clothing,
Entertainment, Miscellaneous, and Savings (a goal, excluded from spend totals).
Each has a standing `default` limit. Category status is `over` above 100%,
`warn` at ≥80%, otherwise `ok`; the UI mirrors this as red/amber/green. The
smart plan recomputes limits from the previous three months (average × 1.05,
rounded to $5).

## 6. Deployment & portability

| Concern | Approach |
|---|---|
| Low-power hardware | SQLite + single Node process; no Redis, no Docker required |
| Windows/macOS/Linux | Pure Node dependencies (libSQL ships prebuilt binaries) |
| Process supervision | systemd (Linux), launchd (macOS), Task Scheduler/NSSM (Windows) |
| Frontend delivery | `npm run build` → served by Express from `dist/` |
| Dev | Vite :5173 with `/api` proxy → :4000 |
| API port | `PORT` env var, default 4000 |
| AI (optional) | Ollama on `OLLAMA_URL` (default `http://localhost:11434`) |
| AI fallback | Python 3 + `skills/spend_skill.py`, then built-in JS rules |

SQLite file: `prisma/dev.db` (git-ignored). Back it up by copying that file.

## 7. Security posture & hardening path

Current auth is intentionally simple for a local, single-user tool: plaintext
password, no session token, no rate limiting. Before exposing MoneyTrack to a
network:

1. Hash passwords with `argon2`/`bcrypt` and compare hashes.
2. Issue a signed JWT or HTTP-only session cookie; stop trusting `x-user-id`.
3. Add rate limiting on `/auth/login` and upload size limits.
4. Serve over HTTPS via a reverse proxy (Caddy/nginx).

## 8. Future: mobile

The API is stateless JSON and the UI is a responsive React SPA, so a future
React Native / Expo client can reuse the same endpoints. Keep business logic in
the API layer (already the case) rather than in components.

## 9. PostgreSQL switch

1. Change `prisma/schema.prisma` → `provider = "postgresql"`.
2. Set `prisma.config.ts` (and `DATABASE_URL`) to the Postgres connection string.
3. `npm run db:push && npm run db:seed`.
4. Run `npm run server`.

Swap the libSQL adapter for `@prisma/adapter-pg` in `src/lib/db.js`.
