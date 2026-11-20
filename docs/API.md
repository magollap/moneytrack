# MoneyTrack REST API

Base URL: `http://localhost:4000/api/v1` (dev proxy: `http://localhost:5173/api/v1`)

Response envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": "message" }
```

Authenticated endpoints require the header `x-user-id: <user id>` returned by
the login call.

---

## 1. Auth

### `POST /auth/login`

Self-registration + login in one call.

**Body**
```json
{ "username": "demo", "password": "demo123" }
```

**Behaviour**
- Unknown username → account is created.
- First account in the database → `isAdmin: true`.
- Existing username → password must match, otherwise `401`.

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "95774478-f66a-442f-a7e5-dfbc51861009",
    "username": "demo",
    "isAdmin": true,
    "createdAt": "2026-11-19T21:33:35.969Z"
  }
}
```

**Errors** — `400` missing fields, `401` invalid password, `500` server error.

---

## 2. Demo data

### `POST /demo/load`

Generates 90 days of demo data into a tagged demo account
(`source="demo"`, `Account.isDemo=true`). Re-loading replaces only those demo
rows; statements you uploaded and transactions you added manually are kept.

**Headers:** `x-user-id`

**Response 200:** `GET /analytics/summary` payload plus `demo_account_id`.

### `POST /demo/clear`

Deletes every transaction with `source="demo"` and the demo account, leaving
uploaded and manual data untouched.

**Response 200**
```json
{ "success": true, "data": { "removed": 64, "accounts": { "accounts": [], "totals": {}, "unassigned": {} } } }
```

---

## 3. Accounts

An account stores a name, type (`checking`, `savings`, `credit_card`, `cash`),
institution, optional last four digits and an opening balance. **Current balance
is derived**, never stored as an editable snapshot:

```
balance = opening_balance + money_in − money_out
```

Aggregates exclude unassigned transactions from `totals`; unassigned activity is
reported separately.

### `GET /accounts`

**Headers:** `x-user-id`

```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "…",
        "name": "Everyday checking",
        "type": "checking",
        "institution": "Northwind Bank",
        "last4": "4821",
        "is_demo": false,
        "opening_balance": 1000,
        "balance": 2221.91,
        "transaction_count": 24,
        "money_in": 3901.48,
        "money_out": 2679.57,
        "net": 1221.91
      }
    ],
    "totals": {
      "balance": 2221.91,
      "money_in": 3901.48,
      "money_out": 2679.57,
      "net": 1221.91,
      "transaction_count": 24,
      "account_count": 1
    },
    "unassigned": { "transaction_count": 0, "money_in": 0, "money_out": 0, "net": 0 }
  }
}
```

### `POST /accounts`

**Body**

```json
{
  "name": "Everyday checking",
  "type": "checking",
  "institution": "Northwind Bank",
  "last4": "4821",
  "opening_balance": 1000
}
```

**Response 200:** `{ "account": {…}, "accounts": {accounts, totals, unassigned} }`.

### `PATCH /accounts/:id`

Accepts any of `name`, `type`, `institution`, `last4`,
`opening_balance`/`openingBalance`. Returns the full account list payload.

### `DELETE /accounts/:id`

Deletes the account. Its transactions are **kept** and become unassigned
(`accountId = null`). Returns the full account list payload.

---

## 4. Transactions

### `POST /transactions/upload`

Upload a bank or credit-card statement as **PDF, CSV or TSV**.

The parser understands the document, not just the numbers:

- **Statement type** — detected as `bank`, `credit_card` or `statement` from
  keywords (billing period, available credit, deposits/withdrawals, …).
- **Direction** — debit/credit section headings (`Deposits and Credits`,
  `Withdrawals and Debits`, `Purchases`, `Payments and Credits`), `CR`/`DR`
  markers, signed amounts and explicit debit/credit columns all set `in`/`out`.
  On a credit-card statement a negative amount is a payment or refund (money
  in), not a purchase.
- **Flow** — each row is classified as `income` (salary, payroll, deposits,
  interest), `expense`, `fee`, `card_payment`, `transfer` or `refund`.
- **PDF** — text is extracted with `pdf-parse`; dated lines with an amount are
  imported. Summary lines (opening/closing balance, totals, minimum payment)
  are skipped. Password-protected PDFs and image-only scans cannot be read;
  export CSV instead.
- **CSV/TSV** — header matching is case-insensitive. Supported columns:
  `date`, `description` (or `merchant`/`details`/`memo`), `amount`,
  `debit`/`credit` (or withdrawal/deposit), and `type`. Signed amounts
  (`-84.20`), parenthesised amounts, trailing minus and quoted fields work.
  Separator may be a comma or a tab.
- Maximum file size: 15 MB.

`Transaction.amount` stays positive; `direction` decides whether money came in
or went out.

**Deduplication** — each imported row gets a fingerprint of
`account + ISO date + amount + direction + normalised description`. Rows already
stored (including legacy unassigned rows) are skipped, so re-uploading the same
file or an overlapping next-month statement imports only new lines.

**Account matching** — pass `account_id` to force a destination. Omit it (or
send `auto`) to match an existing account by last four digits, then by
institution, or create one from the statement header.

**Headers:** `x-user-id`
**Body:** `multipart/form-data` — `file`, optional `account_id`

**Response 200**
```json
{
  "success": true,
  "data": {
    "period": "2026-10-01 → 2026-10-31",
    "total_spent": 1921.57,
    "income_total": 3354.18,
    "money_in": 3901.48,
    "money_out": 2675.07,
    "net_cash_flow": 1226.41,
    "flows": {
      "money_in": 3901.48,
      "money_out": 2675.07,
      "net": 1226.41,
      "income": 3354.18,
      "spending": 1921.57,
      "fees": 3.5,
      "card_payments_in": 0,
      "card_payments_out": 450,
      "transfers_in": 500,
      "transfers_out": 300,
      "refunds": 47.3,
      "flow_totals": [
        { "flow": "expense", "direction": "out", "label": "Spending", "amount": 1921.57, "count": 16 }
      ],
      "groups": [
        { "category": "Housing", "flow": "expense", "direction": "out", "amount": 1200, "count": 1 }
      ]
    },
    "import": {
      "source": "pdf",
      "pages": 2,
      "statement_type": "bank",
      "institution": "Northwind Bank",
      "period": "Oct 1 – Oct 31, 2026",
      "account": "4821",
      "account_id": "…",
      "account_name": "Everyday checking",
      "transactions": 23,
      "imported": 23,
      "duplicates": 0,
      "file": "sample-bank-statement.pdf"
    },
    "transactions": [
      {
        "date": "2026-10-01T00:00:00.000Z",
        "description": "ACME CORP PAYROLL DIRECT DEPOSIT",
        "amount": 3200,
        "category": "Salary",
        "flow": "income",
        "direction": "in",
        "isWaste": false
      }
    ]
  }
}
```

`import.source` is `pdf` or `text`. `import.pages` is `null` for CSV/TSV.
`import.transactions` is every parsed line, `import.imported` the number saved
and `import.duplicates` the number skipped. `flows.groups` is grouped by
`direction + category`; `flows.flow_totals` is grouped by `direction + flow`.
`transactions` returns up to 500 newly imported rows for the preview, and
`accounts` returns the refreshed account list. Spending totals exclude income,
refunds, transfers and card payments.

**Errors**
- `422` — no selectable text (scanned PDF), no transactions detected, or an
  encrypted PDF.
- `400` — missing file, or an unknown `account_id`.

### `POST /transactions`

Add a transaction manually. It appears immediately and changes the derived
account balance.

**Body**

```json
{
  "date": "2026-11-19",
  "description": "Coffee with a friend",
  "amount": 4.5,
  "category": "Dining Out",
  "flow": "expense",
  "direction": "out",
  "account_id": "…",
  "is_waste": false,
  "notes": "optional"
}
```

`amount` is positive; `flow` is one of `income`, `expense`, `fee`,
`card_payment`, `transfer`, `refund`. If `is_waste` is omitted it is inferred
from the category. `account_id` may be `null` or `"unassigned"`. Returns the
created transaction.

### `PATCH /transactions/:id`

Edit an existing transaction. Accepts `description`, `amount`, `date`,
`category`, `account_id` (`null`/`"unassigned"` to detach), `flow`,
`direction`, `is_waste`, `notes`. Changing a category also refreshes the waste
flag unless `is_waste` is supplied. Returns the updated transaction.

### `DELETE /transactions/:id`

Deletes one transaction. `404` if it does not belong to the user.

### `DELETE /transactions/all`

Deletes every transaction for the current user (accounts are kept).

**Response 200:** `{ "removed": 42 }`.

### `GET /transactions`

**Query:** `start_date`, `end_date`, `category`, `account_id`, `is_waste`
(`true`/`false`), `flow` (`income`/`expense`/`fee`/`card_payment`/`transfer`/
`refund`), `direction` (`in`/`out`), `q` (description contains), `limit` (max
2000, default 500). Returns rows newest first.

`account_id` accepts an account id, `all` (default) or `unassigned`. Each row
includes its `account` object (`id`, `name`, `type`, `institution`, `last4`) when
assigned.

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "userId": "…",
      "accountId": null,
      "date": "2026-11-18T00:00:00.000Z",
      "description": "ACME CORP PAYROLL",
      "amount": 3200,
      "category": "Salary",
      "flow": "income",
      "direction": "in",
      "statementType": "bank",
      "source": "upload",
      "fingerprint": "…",
      "isWaste": false,
      "notes": null,
      "account": { "id": "…", "name": "Everyday checking", "type": "checking", "institution": "Northwind Bank", "last4": "4821" }
    }
  ]
}
```

`flow` and `direction` are authoritative; older rows default to
`flow="expense"`, `direction="out"`. `source` is `upload`, `manual` or `demo`.

---

## 5. Analytics

### `GET /analytics/summary`

**Query:** optional `account_id` (account id, `all`, or `unassigned`).

**Headers:** `x-user-id`

```json
{
  "success": true,
  "data": {
    "period": "2026-08-23 → 2026-11-19",
    "total_spent": 1232.86,
    "income_total": 6400,
    "money_in": 7180.55,
    "money_out": 4120.4,
    "net_cash_flow": 3060.15,
    "flows": {
      "money_in": 7180.55,
      "money_out": 4120.4,
      "net": 3060.15,
      "income": 6400,
      "spending": 3020.9,
      "fees": 12,
      "card_payments_out": 900,
      "transfers_out": 187.5,
      "refunds": 100,
      "flow_totals": [],
      "groups": []
    },
    "waste_total": 521.28,
    "annual_waste_projection": 6255.36,
    "potential_investment_value_10yr": 90204.11,
    "transaction_count": 36,
    "avg_daily_spend": 13.85,
    "waste_share": 42.3,
    "categories": [
      { "name": "Dining Out", "amount": 226.12, "percentage": 18.3, "is_waste": true }
    ],
    "daily": [
      { "date": "2026-08-23", "amount": 84.2, "waste": 0, "income": 0 }
    ],
    "top_waste": [
      { "description": "UBER EATS LATE NIGHT", "amount": 158.19 }
    ]
  }
}
```

`period` is derived from the oldest and newest transaction. `daily` is the
series used by the trend chart; `top_waste` drives the merchant ranking.
`total_spent` and `categories` count spending only: income, refunds, transfers
and credit-card payments are excluded. `income_total` includes income and
refunds; `money_in`/`money_out`/`net_cash_flow` cover every movement. `flows`
exposes per-direction and per-category breakdowns. `account_scope` echoes the
scope used (`all`, an account id or `unassigned`).

Category rules: Dining Out, Subscriptions and Fees are flagged as waste.
The 10-year figure assumes the monthly waste amount is invested at 7% APY with
monthly compounding.

---

## 6. Plan & budget

Budgets are stored once per category with `month = "default"` (the standing
plan) plus optional per-month overrides. The default plan is created on first
read and includes: Housing, Groceries, Utilities, Transport, Health & Fitness,
Dining Out, Subscriptions, Fees, Clothing, Entertainment, Miscellaneous, and a
Savings goal.

### `GET /budgets?month=YYYY-MM`

Returns spending against limits for the requested month (current month by
default). Status thresholds: `over` above 100%, `warn` at 80% or more, `ok`
below 80%, `unset` when there is no limit.

```json
{
  "success": true,
  "data": {
    "month": "2026-11",
    "label": "November 2026",
    "total": {
      "budget": 2805,
      "spent": 184.59,
      "remaining": 2620.41,
      "percentage": 6.6,
      "status": "ok"
    },
    "savings_goal": { "target": 400, "spent": 0 },
    "categories": [
      {
        "id": "…",
        "category": "Groceries",
        "limit": 450,
        "spent": 115.57,
        "remaining": 334.43,
        "percentage": 25.7,
        "status": "ok",
        "kind": "essential",
        "note": "Food at home",
        "isWaste": false,
        "source": "plan"
      }
    ],
    "unbudgeted": [{ "category": "Pet care", "spent": 40 }],
    "alerts": []
  }
}
```

`kind` is one of `essential`, `leak`, `lifestyle`, `goal`, or `lifestyle` for
custom categories. `source` is `plan` or `override`.

### `POST /budgets`

Create or update a per-category limit.

```json
{
  "category": "Groceries",
  "amount": 500,
  "month": "default",
  "view_month": "2026-11"
}
```

- Omit `month` (or use `default`) to change the standing plan.
- Use `month: "YYYY-MM"` for a one-month override.
- `view_month` selects the month returned in the response (defaults to the
  current month).

**Response 200:** the full budget state (same shape as `GET /budgets`).

### `DELETE /budgets/:id?month=YYYY-MM`

Deletes a limit and returns the updated budget state for `month`.

### `POST /budgets/generate`

Rebuilds the standing plan from the previous three months of spending:
average per category × 1.05, rounded to $5 (Savings derives from 15% of average
monthly spend). Existing plan rows are updated.

**Body:** `{ "month": "2026-11" }` (optional, view month for the response)

```json
{
  "success": true,
  "data": {
    "month": "2026-11",
    "label": "November 2026",
    "generated_from": ["2026-08", "2026-09", "2026-10"],
    "suggestions": [
      { "category": "Groceries", "amount": 455, "kind": "essential", "basis": "average spend + 5%" }
    ]
  }
}
```

The response also includes `total`, `savings_goal`, `categories`,
`unbudgeted`, and `alerts`.

---

## 7. Reports

### `GET /reports?month=YYYY-MM`

Monthly report with six-month history, category movement, merchant ranking and
budget outcome.

```json
{
  "success": true,
  "data": {
    "month": "2026-11",
    "label": "November 2026",
    "previous_month": "2026-10",
    "totals": {
      "spent": 184.59,
      "waste": 93.4,
      "count": 7,
      "previous_spent": 586.81,
      "change": -402.22,
      "change_pct": -68.5,
      "avg_per_day": 9.72,
      "days": 19
    },
    "budgets": { "total": { }, "categories": [] },
    "categories": [
      {
        "name": "Utilities",
        "amount": 78.03,
        "count": 1,
        "previous": 0,
        "change": 78.03,
        "change_pct": null,
        "share": 42.3,
        "isWaste": false,
        "budget": { "limit": 180, "status": "ok", "percentage": 43.4 }
      }
    ],
    "top_merchants": [
      {
        "description": "COMCAST INTERNET",
        "amount": 79.99,
        "count": 1,
        "category": "Utilities",
        "isWaste": false
      }
    ],
    "monthly": [
      { "month": "2026-06", "spent": 400.12, "waste": 90.2, "count": 12 }
    ],
    "daily": [{ "date": "2026-11-01", "amount": 12.5, "waste": 0 }],
    "insights": ["Utilities was the largest category at $78.03 (42.3% of spend)."]
  }
}
```

`previous` and `change` compare against the previous calendar month.
`change_pct` is `null` when the previous amount is zero. `avg_per_day` uses
days elapsed for the current month, or the full month otherwise.

---

## 8. AI skills

### `GET /ai/status?refresh=true`

Reports which local answer engine is available. Detection is cached for 20
seconds unless `refresh=true`.

```json
{
  "success": true,
  "data": {
    "ollama": {
      "available": true,
      "model": "qwen3.5:4b",
      "models": ["qwen3.5:4b"],
      "url": "http://localhost:11434"
    },
    "python": {
      "available": true,
      "command": "python3",
      "skill": "skills/spend_skill.py"
    },
    "preferred": "ollama"
  }
}
```

`preferred` is `ollama`, `python-skill` or `local-js`.

### `POST /ai/ask`

Answers a natural-language question over the user's own transactions and
budgets. Priority: Ollama (`OLLAMA_URL`, `OLLAMA_MODEL`) → local Python skill →
built-in JavaScript rules. Nothing leaves the machine.

**Body**
```json
{ "question": "How much did I spend on groceries last month?", "month": "2026-11" }
```

`question` is required and limited to 500 characters. `month` sets the budget
context and defaults to the current month.

**Response 200**
```json
{
  "success": true,
  "data": {
    "question": "How much did I spend on groceries last month?",
    "answer": "You spent $115.57 on Groceries in last month across 2 transactions.",
    "engine": "python-skill",
    "model": null,
    "intent": "total",
    "latency_ms": 910,
    "engine_status": { "ollama": { }, "python": { }, "preferred": "python-skill" }
  }
}
```

`engine` is `ollama`, `python-skill` or `local-js`. `intent` is present for
non-Ollama engines (`total`, `budget`, `waste`, `merchants`, `count`,
`compare`, `income`, `cashflow`, `card_payment`). Spending answers ignore
income, refunds, transfers and card payments; income and cash-flow questions
use `flow`/`direction`. Month names such as “October” or “March 2026” are
understood. Ollama answers can take ~30 seconds on a small local model.

---

## 9. System

### `GET /system/status`

```json
{
  "status": "online",
  "version": "1.1.0",
  "db_type": "sqlite",
  "platform": "linux",
  "uptime_seconds": 16,
  "memory_usage_mb": 22
}
```

`db_type` reports `postgresql` when `DATABASE_URL` is set.

---

## Status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 400 | Missing file / fields, invalid question or amount |
| 401 | Missing or wrong credentials |
| 422 | Statement could not be parsed (scanned/encrypted PDF, no rows) |
| 500 | Parsing or database failure |
