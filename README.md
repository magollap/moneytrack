# MoneyTrack 💰

**MoneyTrack** is a lightweight, cross-platform personal finance manager and waste optimizer designed to run seamlessly on legacy hardware (e.g., Raspberry Pi, small VMs) as well as Windows, macOS, and Linux.

---

## 🌟 Key Features

- 📁 **CSV/TSV Auto-Parsing:** Easily upload bank and credit card statements.
- 🚨 **Leakage & Waste Detection:** Automatically flags high-risk categories like excessive dining out, unused subscriptions, and bank fees.
- 🎨 **Modern OLED Dark Theme:** Beautiful, eye-friendly, responsive interface built with React, Vite, and Tailwind CSS.
- ⚡ **Lightweight & Fast:** Runs effortlessly on minimal system resources.
- 🔒 **Local-First & Private:** Your financial data stays entirely on your device.
- 🐘 **Database Flexibility:** Starts with SQLite out of the box; easily configurable to connect to PostgreSQL for handling years of historical data.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- `npm` or `pnpm`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/magollap/moneytrack.git
   cd moneytrack
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   ```bash
   npx prisma db push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

Open your browser and navigate to `http://localhost:5173`.

---

## 📚 Documentation

Detailed documentation is available in the [`docs/`](./docs) directory:

- 🏗️ [**Architecture Overview**](./docs/ARCHITECTURE.md) – Tech stack, database schema, and design decisions.
- 🔌 [**API Documentation**](./docs/API.md) – REST endpoint specifications for integration and extension.
- 📦 [**Installation Guide**](./docs/INSTALL.md) – Step-by-step instructions for local, Docker, and cross-platform deployment.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Database / ORM:** Prisma ORM with SQLite (default) or PostgreSQL
- **Design System:** Generated via `ui-ux-pro-max` (OLED Dark Mode)

---

## 📄 License

[ISC License](./package.json)
EOF
