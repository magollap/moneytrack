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

Replaces the current user's transactions with 90 days of generated demo data.

**Headers:** `x-user-id`

**Response 200:** same payload shape as `GET /analytics/summary`.

---

## 3. Transactions

### `POST /transactions/upload`

Upload a bank or credit-card statement as **PDF, CSV or TSV**.

- **PDF** — text is extracted with `pdf-parse`; dated lines with an amount are
  imported. Summary lines (opening/closing balance, totals, minimum payment) and
  credits/payments are skipped. Password-protected PDFs and image-only scans
  cannot be read; exports as CSV instead.
- **CSV/TSV** — rows are `date, description, amount`, separated by commas or
  tabs. A header row containing `date` is skipped.
- Maximum file size: 15 MB.

**Headers:** `x-user-id`
**Body:** `multipart/form-data`, field `file`

**Response 200**
```json
{
  "success": true,
  "data": {
    "period": "2026-10-03 → 2026-10-31",
    "total_spent": 847.35,
    "waste_total": 104.82,
    "annual_waste_projection": 1257.84,
    "potential_investment_value_10yr": 18142.75,
    "transaction_count": 18,
    "avg_daily_spend": 29.22,
    "waste_share": 12.4,
    "categories": [
      { "name": "Clothing", "amount": 219.89, "percentage": 26, "is_waste": false }
    ],
    "daily": [{ "date": "2026-10-03", "amount": 86.42, "waste": 0 }],
    "top_waste": [{ "description": "DOORDASH*SUSHI PALACE", "amount": 38.75 }],
    "import": {
      "source": "pdf",
      "pages": 2,
      "transactions": 18,
      "file": "sample-bank-statement.pdf"
    }
  }
}
```

`import.source` is `pdf` or `text`. `import.pages` is `null` for CSV/TSV.

**Errors**
- `422` — no selectable text (scanned PDF), no transactions detected, or an
  encrypted PDF.
- `400` — missing file.

### `GET /transactions`

**Query:** `start_date`, `end_date`, `category`, `account_id`, `is_waste`
(`true`/`false`), `q` (description contains), `limit` (max 2000, default 500).
Returns rows newest first.

```json
{
  "success": true,
  "data": [
    {
      "id": "…",
      "userId": "…",
      "accountId": null,
      "date": "2026-11-18T00:00:00.000Z",
      "description": "DOORDASH*SUSHI PALACE",
      "amount": 42.5,
      "category": "Dining Out",
      "isWaste": true,
      "notes": null
    }
  ]
}
```

---

## 4. Analytics

### `GET /analytics/summary`

**Headers:** `x-user-id`

```json
{
  "success": true,
  "data": {
    "period": "2026-08-23 → 2026-11-19",
    "total_spent": 1232.86,
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
      { "date": "2026-08-23", "amount": 84.2, "waste": 0 }
    ],
    "top_waste": [
      { "description": "UBER EATS LATE NIGHT", "amount": 158.19 }
    ]
  }
}
```

`period` is derived from the oldest and newest transaction. `daily` is the
series used by the trend chart; `top_waste` drives the merchant ranking.

Category rules: Dining Out, Subscriptions and Fees are flagged as waste.
The 10-year figure assumes the monthly waste amount is invested at 7% APY with
monthly compounding.

---

## 5. Plan & budget

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

## 6. Reports

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

## 7. AI skills

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
`compare`). Ollama answers can take ~30 seconds on a small local model.

---

## 8. System

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
