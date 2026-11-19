# MoneyTrack 💰

**MoneyTrack** is a lightweight, local-first personal finance manager and waste
optimizer. It runs on a Raspberry Pi, a small VM, or your laptop — Windows,
macOS, and Linux — with no mandatory cloud services.

---

## 🌟 Features

- 📁 **CSV/TSV import** — drag & drop a bank or card statement.
- 🧠 **Auto-categorisation** — Dining Out, Subscriptions, Fees, Groceries, Transport, Utilities, Housing.
- 🚨 **Waste detection** — flags leaky spend and projects the annual cost plus 10-year opportunity cost of investing it.
- 📊 **Analytics dashboard** — totals, category chart, detailed breakdown.
- 🔐 **Self-registration login** — first account created becomes the admin.
- 🧪 **Demo mode** — one click loads 90 days of realistic sample transactions.
- 🎨 **OLED dark theme** — React + Vite + Tailwind, responsive for a future mobile build.
- 🐘 **SQLite by default, PostgreSQL when you need scale.**

---

## 🚀 Quick Start

Requirements: **Node.js 20+**.

```bash
git clone git@github.com:magollap/moneytrack.git
cd moneytrack
npm install
npm run db:push     # create the SQLite schema
npm run db:seed     # demo user + 90 days of data
npm run build
npm run server      # http://localhost:4000
```

**Demo login:** `demo` / `demo123` (admin).

### Development

```bash
npm run server   # API on :4000
npm run dev      # UI on :5173 (proxies /api)
```

### Auth model

Open the app, enter any new username + password to self-register. The **first
user in an empty database becomes admin**. Existing usernames require the
matching password.

---

## 📚 Documentation

- 🏗️ [Architecture](./docs/ARCHITECTURE.md) — data model, request lifecycle, deployment, hardening.
- 🔌 [API reference](./docs/API.md) — endpoints, payloads, status codes.
- 📦 [Installation](./docs/INSTALL.md) — Windows/macOS/Linux, start/stop/status, PostgreSQL, Raspberry Pi.
- 🎨 [Design system](./design-system/moneytrack/MASTER.md) — tokens and rules.

---

## 🛠️ Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Recharts, lucide-react |
| Backend | Node.js, Express 5, multer |
| Data | Prisma 7, SQLite (libSQL adapter), optional PostgreSQL |
| Design | `ui-ux-pro-max` generated OLED dark system |

---

## 📁 Layout

```
server.js              Express API + serves dist/
src/
  App.jsx              auth gate + dashboard shell
  components/
    AuthPage.jsx       register/login
    TransactionUpload.jsx
    AnalyticsSummary.jsx
  lib/db.js            Prisma client (libSQL adapter)
prisma/
  schema.prisma        User, Account, Transaction, Budget
scripts/seed.js        demo user + generated transactions
docs/                  architecture, API, install
```

---

## 📄 License

ISC
