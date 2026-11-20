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
- **Account** — bank/credit/cash account owned by a user. Fields: `name`,
  `type` (`checking` | `savings` | `credit_card` | `cash`), `institution`,
  `last4`, `openingBalance`, `isDemo`. **Balance is derived**:
  `openingBalance + money_in − money_out`, so imports, manual entries and
  deletions always move it consistently.
- **Transaction** — `date`, `description`, `amount` (always positive),
  `accountId`, `category`, `flow` (`income` | `expense` | `fee` |
  `card_payment` | `transfer` | `refund`), `direction` (`in` | `out`),
  `statementType`, `source` (`upload` | `manual` | `demo`), `fingerprint`,
  `isWaste`.
- **Budget** — per-category monthly limit. Rows with `month = "default"` form
  the standing plan; a `YYYY-MM` row overrides it for one month.

Indexes: `Transaction(userId, accountId, date)` for account-scoped lists and
`Transaction(userId, fingerprint)` for duplicate checks.

## 4. Request lifecycle

1. **Auth** — `POST /api/v1/auth/login` with `{username, password}`.
   - If the username does not exist, the account is self-registered.
   - If the database has zero users, the new account gets `isAdmin: true`.
   - If the username exists, the password must match.
2. **Upload** — `POST /api/v1/transactions/upload` (multipart `file`,
   optional `account_id`).
   - CSV/TSV is split on commas/tabs with a quote-aware parser; PDF text is
     extracted with `pdf-parse`.
   - The statement type is detected (`bank`, `credit_card`, `statement`) from
     document keywords, and debit/credit section headings establish direction.
   - Dated rows with an amount are imported; balances and summary totals are
     skipped. Scanned PDFs return `422` with CSV guidance.
   - `classifyMovement()` assigns `flow` and `direction`: salary/payroll →
     income, deposits/interest → income, payments to a card → card_payment,
     transfers → transfer, refunds → refund, fees → fee, everything else →
     expense. Unmatched credits are kept as deposits (bank) or refunds (card).
   - Keyword rules map descriptions to categories and mark leaky spend
     (`Dining Out`, `Subscriptions`, `Fees`).
   - **Account resolution** (`server/lib/accounts.js`): a chosen `account_id`
     wins; otherwise the importer matches an existing account by last4, then by
     institution, else creates one from the statement header.
   - **Deduplication**: each row is keyed by
     `account + ISO date + amount + direction + normalised description`
     (unassigned legacy rows key on `*`). Rows already in the database are
     counted as duplicates and skipped; only new rows are inserted.
   - The response returns `imported`/`duplicates` counts alongside the summary,
     `flows`, the new rows and the refreshed account list.
3. **Analytics** — `GET /api/v1/analytics/summary?account_id=…` aggregates the
   selected scope (`all`, an account id or `unassigned`) into spending totals,
   category shares, money in/out/net, an annualized waste projection, and a
   10-year invested-value estimate (7% APY, monthly compounding). Spending
   totals exclude income, refunds, transfers and card payments.
4. **Budgets** — `GET /api/v1/budgets?month=YYYY-MM` joins the standing plan
   and overrides with that month's spend and assigns `ok`/`warn`/`over` status.
   `POST /budgets` edits a limit; `POST /budgets/generate` derives a plan from
   the previous three months.
5. **Reports** — `GET /api/v1/reports?month=YYYY-MM` compares spending with
   the previous month, ranks merchants, lists six-month history, exposes
   `cashflow` (money in/out/net) and writes plain-language insights.
6. **AI** — `POST /api/v1/ai/ask` builds a compact JSON context (totals,
   budgets, merchants, history, per-row `flow`/`direction`) and tries Ollama,
   then `skills/spend_skill.py`, then built-in JS rules. Spend questions ignore
   non-spending rows; income and cash-flow questions use the flow fields.
7. **Demo** — `POST /api/v1/demo/load` regenerates 90 days of demo data in a
   tagged demo account (`source="demo"`). `POST /api/v1/demo/clear` removes
   only those rows and the demo account; uploaded and manual data are never
   touched.

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
    Overview.jsx          account cards/total, KPIs, trend, donut, budget health, recent list
    Accounts.jsx          add/list/delete accounts, per-account balances
    Transactions.jsx      account scope, manual entry, inline category/account edit, delete, export
    Budgets.jsx           month stepper, ring, limits, alerts, smart plan
    Reports.jsx           totals, 6-month bars, category movement, merchants
    AiSkills.jsx          chat, suggestions, engine status
    Import.jsx            PDF/CSV dropzone, account selector, dedupe result, demo loader
    Settings.jsx          account, runtime status, remove demo data, clear all, sign out
  lib/
    api.js                fetch wrapper, adds x-user-id, account-aware calls
    format.js             currency, dates, category colours
server/
  lib/accounts.js         derived balances, upload account matching, fingerprints, dedupe
  lib/classify.js         flow/direction classification, spending vs income helpers, flow summaries
  lib/statement.js        statement-type detection, PDF/CSV/TSV parsing, metadata
  lib/plan.js             budget plan, overrides, smart generation (spending only)
  lib/reports.js          monthly report builder, cash-flow insight (spending only)
  lib/ai.js               Ollama → Python → JS answer cascade
  lib/demo.js             summary builder and flow-aware demo generator
skills/spend_skill.py     deterministic offline Q&A skill
```

Routing is `location.hash` (`#overview`, `#accounts`, `#transactions`,
`#budgets`, `#reports`, `#ai`, `#import`, `#settings`) so the back button and
deep links work without a router dependency. Shared server state is fetched in
`App.jsx`; the global account scope (`all`, an account id or `unassigned`) lives
there and drives `/analytics/summary` and `/transactions`. Budget/report/AI
pages load their own month-scoped data.

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

These rules live in one place (`categorize()` in `server/lib/classify.js`) so
they can be replaced by user-defined rules or an LLM classifier later.

## 5b. Money-flow model

`server/lib/classify.js` is the single source of truth for what a movement is:

| `flow` | Meaning | `direction` |
|---|---|---|
| `income` | Salary, payroll, mobile/check deposit, interest | `in` |
| `expense` | Purchases, bills, rent, subscriptions | `out` |
| `fee` | ATM, late, overdraft, interest/finance charges | `out` |
| `card_payment` | Payment from a bank account to a card, or received by a card | `out` / `in` |
| `transfer` | Moves between the user's own accounts | `in` / `out` |
| `refund` | Refund, reversal or chargeback | `in` |

Helpers `isSpending()`, `isIncome()`, `flowOf()` and `directionOf()` are used by
budgets, reports, analytics, AI answers and the UI. `summarizeFlows()` produces
money in/out/net, per-flow totals and direction+category groups. Budgets,
spending totals and “how much did I spend” answers include only
`expense`/`fee` rows with `direction = "out"`.

The CSV parser accepts `date`, `description` (or merchant/details/memo),
`amount`, `debit`/`credit` and `type` columns, with comma or tab separators.
PDF parsing also understands `CR`/`DR` markers, trailing-minus amounts,
debit/credit section headings and credit-card `Payments and Credits` sections.


## 5c. Budget model

Twelve fixed categories ship by default: Housing, Groceries, Utilities,
Transport, Health & Fitness, Dining Out, Subscriptions, Fees, Clothing,
Entertainment, Miscellaneous, and Savings (a goal, excluded from spend totals).
Each has a standing `default` limit. Category status is `over` above 100%,
`warn` at ≥80%, otherwise `ok`; the UI mirrors this as red/amber/green. The
smart plan recomputes limits from the previous three months (average × 1.05,
rounded to $5).

## 5d. Accounts, scope and duplicate detection

`server/lib/accounts.js` owns everything account-related:

- `listAccounts()` derives each balance from `openingBalance` plus transaction
  direction, and returns `totals` (assigned accounts) plus a separate
  `unassigned` bucket.
- `accountScope(accountId)` converts `all` / id / `unassigned` into Prisma
  filters used by both `/transactions` and `/analytics/summary`.
- `resolveUploadAccount()` picks the destination account for an import.
- `transactionKey()` / `splitDuplicates()` generate the stable duplicate key
  from account, date, amount, direction and normalised description. Legacy rows
  with `accountId = null` are matched via the `*` account slot, so re-importing
  old data does not double-count.
- Manual entries use `flowDirection()` to derive `flow`/`direction` from the
  selected kind, and immediately affect the derived balance.

Deleting an account sets its transactions to `accountId = null` (unassigned)
rather than deleting them. Deleting a transaction also silently moves the
account balance back.

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
