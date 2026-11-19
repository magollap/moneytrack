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

Upload a CSV/TSV statement. Header row containing `date` is skipped. Each row:
`date, description, amount` (comma or tab separated).

**Headers:** `x-user-id`
**Body:** `multipart/form-data`, field `file`

**Response 200**
```json
{
  "success": true,
  "data": {
    "period": "Last 90 days",
    "total_spent": 1882.22,
    "waste_total": 464.47,
    "annual_waste_projection": 5573.64,
    "potential_investment_value_10yr": 80392.7,
    "categories": [
      { "name": "Groceries", "amount": 656, "percentage": 34.9, "is_waste": false }
    ]
  }
}
```

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

## 5. System

### `GET /system/status`

```json
{
  "status": "online",
  "version": "1.0.0",
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
| 400 | Missing file / fields |
| 401 | Missing or wrong credentials |
| 500 | Parsing or database failure |
