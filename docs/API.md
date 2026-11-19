# MoneyTrack REST API Documentation

Base URL: `/api/v1`

All responses return standard JSON format:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 1. System & Health

### `GET /system/status`
Returns server operational status, active database backend, and platform runtime.

**Response (200 OK):**
```json
{
  "status": "online",
  "version": "1.0.0",
  "db_type": "sqlite",
  "db_path": "/var/lib/moneytrack/moneytrack.db",
  "platform": "linux",
  "uptime_seconds": 14250,
  "memory_usage_mb": 42.5
}
```

### `POST /system/control`
Triggers service management actions (restart, reload DB connection, flush cache).

**Body:**
```json
{
  "action": "reload_db"
}
```

---

## 2. Accounts (`/accounts`)

### `GET /accounts`
Retrieves all managed bank and credit card accounts with current balances.

**Response (200 OK):**
```json
[
  {
    "id": "acc_chase_main",
    "name": "Chase Sapphire Reserve",
    "type": "credit_card",
    "institution": "Chase",
    "last4": "4812",
    "balance": 1240.50,
    "limit": 10000.00,
    "currency": "USD",
    "updated_at": "2026-11-19T14:30:00Z"
  }
]
```

---

## 3. Transactions (`/transactions`)

### `GET /transactions`
Queries filtered list of transactions. Supports pagination, date range, and category filters.

**Query Parameters:**
- `start_date` (ISO date, e.g., `2026-11-01`)
- `end_date` (ISO date, e.g., `2026-11-19`)
- `category` (e.g., `Dining Out`, `Subscriptions`)
- `account_id` (string)
- `is_waste` (boolean)

**Response (200 OK):**
```json
{
  "total": 142,
  "page": 1,
  "page_size": 20,
  "data": [
    {
      "id": "tx_981247",
      "account_id": "acc_chase_main",
      "date": "2026-11-18",
      "description": "DOORDASH*SUSHI",
      "amount": 42.50,
      "category": "Dining Out",
      "is_waste": true,
      "notes": "Late night order"
    }
  ]
}
```

### `POST /transactions/upload`
Uploads a CSV/TSV bank statement file for auto-parsing and categorization.

**Body:** `multipart/form-data` with key `file` (CSV/TSV).

---

## 4. Analytics & Optimization (`/analytics`)

### `GET /analytics/summary`
Returns spending total, category percentages, waste breakdown, and savings roadmap.

**Response (200 OK):**
```json
{
  "period": "2026-11-01_to_2026-11-19",
  "total_spent": 3420.15,
  "total_income": 6500.00,
  "waste_total": 510.40,
  "annual_waste_projection": 6124.80,
  "potential_investment_value_10yr": 88240.12,
  "categories": [
    {
      "name": "Dining Out",
      "amount": 380.20,
      "percentage": 11.1,
      "is_waste": true
    }
  ]
}
```

