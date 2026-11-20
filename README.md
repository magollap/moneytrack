# MoneyTrack 💰

**MoneyTrack** is a lightweight, local-first personal finance manager and waste
optimizer. It runs on a Raspberry Pi, a small VM, or your laptop — Windows,
macOS, and Linux — with no mandatory cloud services.

---

## ✨ What it does

Import a bank or credit-card statement and MoneyTrack separates money coming in
(salary, deposits, refunds) from money going out (spending, bills, fees, card
payments), then shows where the money went and what the habits cost over ten
years.

| Screen | Purpose |
|---|---|
| **Overview** | Account cards, total balance across accounts, four KPIs, money in/out/net, daily spend trend, category donut, budget health, recent activity |
| **Accounts** | Add checking, savings, credit-card or cash accounts with an opening balance; see per-account balances and switch the dashboard scope |
| **Transactions** | Account-aware list, search, filter by account/category/flow/waste, add transactions manually, edit category or account inline, delete, export CSV |
| **Plan & Budget** | Fixed monthly limits per category with green/amber/red status, alerts and a smart plan |
| **Reports** | Month-over-month spending, cash flow, six-month history, category movement, merchant ranking, insights |
| **AI Skills** | Ask “how much did I spend on groceries last month?” and get an answer from local models |
| **Import** | Drag-and-drop PDF/CSV/TSV statements, choose or auto-detect the account, duplicate detection, classified preview, sample files |
| **Settings** | Account, runtime health (DB, platform, uptime, memory), remove demo data, clear all transactions, sign out |

- 🔐 **Self-registration** — the first account in an empty database becomes the admin.
- 🧾 **Statement intelligence** — reads bank and credit-card PDFs/CSV/TSV, detects the statement type, and classifies every line as income, spending, fee, card payment, transfer or refund.
- 🏦 **Multi-account** — combine every account on one dashboard, or scope the whole app to one bank account, card or unassigned rows. Statements auto-match accounts by institution and last four digits.
- ♻️ **Duplicate-safe imports** — re-uploading the same month, or a statement that overlaps the previous one, keeps only the new lines and reports how many duplicates were skipped.
- ✍️ **Manual entry & edits** — add a transaction by hand and it immediately changes the account balance; change any transaction’s category or account, or delete it, right in the list.
- 🧹 **Demo data is opt-in and removable** — demo rows are tagged and live in a separate demo account. “Remove demo data” keeps everything you uploaded or entered yourself.
- 💵 **Spending vs deposits** — salary, payroll, mobile/check deposits, interest, refunds and card payments are listed separately instead of being counted as spending.
- 🧠 **Auto-categorisation** — Housing, Groceries, Utilities, Transport, Health, Dining, Subscriptions, Fees, Clothing, Entertainment, Misc.
- 🎯 **Fixed budget plan** — 12 starter categories; over-limit turns red, ≥80% amber, in control green.
- 📊 **Monthly reports** — what changed versus last month, cash flow, top merchants and automatic insights.
- 🤖 **Local AI** — Ollama when available, then the Python skill in `skills/`, then built-in rules. No data leaves the machine.
- 🚨 **Waste radar** — dining, subscriptions and fees are flagged and projected annually.
- 🎨 **OLED dark dashboard** — React 19, Vite, Tailwind v4, Recharts, Lucide; designed mobile-first.
- 🐘 **SQLite by default, PostgreSQL when you need scale.**

---

## 🚀 Quick Start

Requirements: **Node.js 20+**.

### Installer

```bash
# macOS / Linux / Raspberry Pi
chmod +x scripts/install.sh && ./scripts/install.sh --seed
```

```powershell
# Windows PowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\install.ps1 -Seed
```

### Or manually

```bash
git clone git@github.com:magollap/moneytrack.git
cd moneytrack
npm install
npm run db:push
npm run db:seed   # demo user + 90 days of data
npm run build
npm start         # http://localhost:4000
```

**Demo login:** `demo` / `demo123` (admin).

### Optional local AI

MoneyTrack answers questions with whatever is installed, in this order:

1. **Ollama** — start it and pull a small model:
   ```bash
   ollama serve
   ollama pull qwen3.5:4b
   ```
   Override with `OLLAMA_URL` / `OLLAMA_MODEL`.
2. **Python skill** — `python3` plus `skills/spend_skill.py` (included). No packages required.
3. **Built-in rules** — always available.

Check the active engine on **AI Skills → Check engines** or `GET /api/v1/ai/status`.

### Try a statement import

```bash
npm run sample:pdf      # writes samples/sample-bank-statement.pdf
                        #    and samples/sample-credit-card-statement.pdf
```

Upload either on the Import screen. Pick the account it belongs to, or leave
“detect from statement” on so MoneyTrack matches an existing account by last
four digits/institution or creates one. The result shows the detected statement
type, how many rows were new and how many duplicates were skipped, money in vs
money out, net cash flow, grouped inflow/outflow categories and every classified
row. CSV/TSV work the same way; scanned, image-only PDFs are rejected with a
CSV-export hint (no OCR).

### Start / stop / status

```bash
./scripts/moneytrack.sh start | stop | restart | status | logs
```

```powershell
.\scripts\moneytrack.ps1 start | stop | restart | status | logs
```

Custom port: `PORT=4100 ./scripts/moneytrack.sh start` or `-Port 4100`.
For boot-time supervision see systemd / launchd / NSSM examples in the install
guide.

### Development

```bash
npm run server   # API on :4000
npm run dev      # UI on :5173 (proxies /api)
npm test         # statement parser regression tests
```

---

## 🧱 Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Recharts, lucide-react |
| Backend | Node.js, Express 5, multer |
| Statements | `pdf-parse` (text PDFs), CSV/TSV parser |
| AI (optional) | Ollama, Python 3 offline skill, JS rule fallback |
| Data | Prisma 7, SQLite (libSQL adapter), optional PostgreSQL |
| Design | `ui-ux-pro-max` OLED dark system, Fira Sans / Fira Code |

---

## 📚 Documentation

- 🏗️ [Architecture](./docs/ARCHITECTURE.md) — data model, API lifecycle, frontend structure, deployment.
- 🔌 [API reference](./docs/API.md) — endpoints, payloads, filters, status codes.
- 🎨 [Design](./docs/DESIGN.md) — tokens, typography, layout, charts, accessibility, mobile path.
- 📦 [Installation](./docs/INSTALL.md) — installers, service management, PostgreSQL, Raspberry Pi.
- 🎛️ [Design system source](./design-system/moneytrack/MASTER.md).

---

## 📁 Layout

```
server.js              Express API + serves dist/
server/
  lib/                 statement parsing, flow classification, budgets, reports, AI cascade, demo data
skills/spend_skill.py  offline Python Q&A skill
src/
  App.jsx              auth gate, hash router, data loading
  components/          AppShell, AuthPage, ui primitives, charts
  pages/               Overview, Accounts, Transactions, Budgets, Reports, AiSkills, Import, Settings
  lib/                 api client, formatting, category colours
prisma/schema.prisma   User, Account, Transaction, Budget
samples/               generated bank and credit-card statement PDFs
scripts/               installers, seed, sample PDF, start/stop/status
docs/                  architecture, API, design, install
```

---

## 🗺️ Roadmap

- [ ] Password hashing + session tokens (documented hardening path)
- [ ] OCR for scanned PDF statements
- [x] Statement deduplication when the same file or an overlapping month is imported twice
- [ ] React Native / Expo client reusing the same API
- [x] Multi-account imports and reconciliation

---

## 📄 License

ISC
