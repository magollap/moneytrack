#!/usr/bin/env python3
"""MoneyTrack local spend skill.

Deterministic, offline question answering over the user's transactions.
Invoked by the Node API with a JSON payload on stdin; returns JSON on stdout.

Payload:
  {
    "question": "...",
    "today": "YYYY-MM-DD",
    "transactions": [{"date","description","amount","category","flow","direction","is_waste"}],
    "budgets": [{"category","limit","spent","status","kind"}]
  }

Output:
  {"engine": "python-skill", "intent": "...", "answer": "..."}
"""

import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta


CATEGORY_PATTERNS = [
    ("Dining Out", r"dining|eating out|restaurant|takeaway|takeout|delivery|doordash|uber eats|coffee"),
    ("Groceries", r"grocer|supermarket|food shop|food at home"),
    ("Subscriptions", r"subscription|streaming|netflix|spotify"),
    ("Transport", r"transport|fuel|petrol|\bgas\b|uber|lyft|transit|parking"),
    ("Utilities", r"utilit|electric|water|internet|phone bill"),
    ("Housing", r"housing|rent|mortgage"),
    ("Clothing", r"clothing|clothes|apparel|shoes"),
    ("Health & Fitness", r"health|fitness|gym|pharmacy|medical"),
    ("Entertainment", r"entertainment|games|cinema|movies|events"),
    ("Fees", r"\bfees?\b|charges?|overdraft"),
    ("Miscellaneous", r"misc|household|amazon|target"),
    ("Savings", r"savings?|save"),
]

MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def money(value):
    return f"${value:,.2f}"


def detect_category(question):
    lowered = question.lower()
    for name, pattern in CATEGORY_PATTERNS:
        if re.search(pattern, lowered):
            return name
    return None


def month_start(day, offset=0):
    year = day.year
    month = day.month + offset
    while month < 1:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    return date(year, month, 1)


def period_for(question, today):
    q = question.lower()
    if re.search(r"(last|previous) month", q):
        start = month_start(today, -1)
        return "last month", start, month_start(today, 0)
    if re.search(r"this month", q):
        return "this month", month_start(today, 0), month_start(today, 1)
    if re.search(r"(last|past) week", q):
        return "the last 7 days", today - timedelta(days=7), today + timedelta(days=1)
    if re.search(r"this year", q):
        return "this year", date(today.year, 1, 1), date(today.year + 1, 1, 1)
    if re.search(r"(last|past) year", q):
        return "last year", date(today.year - 1, 1, 1), date(today.year, 1, 1)
    if re.search(r"(last|past) 90|three months|3 months", q):
        return "the last 90 days", today - timedelta(days=90), today + timedelta(days=1)
    if re.search(r"(last|past) 30|a month", q):
        return "the last 30 days", today - timedelta(days=30), today + timedelta(days=1)

    named = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december"
        r"|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?:\s+(\d{4}))?",
        q,
    )
    if named:
        month = MONTH_NAMES[named.group(1)[:3]]
        year = int(named.group(2)) if named.group(2) else today.year
        # Without an explicit year, use the most recent occurrence of that month.
        if not named.group(2) and month > today.month:
            year -= 1
        start = date(year, month, 1)
        end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        label = f"{start.strftime('%B %Y')}"
        return label, start, end

    return "this month", month_start(today, 0), month_start(today, 1)


def parse_date(value):
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def filter_rows(rows, start, end, category=None):
    selected = []
    for row in rows:
        day = parse_date(row.get("date"))
        if day is None or not (start <= day < end):
            continue
        if category and row.get("category") != category:
            continue
        selected.append(row)
    return selected


def total(rows):
    return sum(abs(float(row.get("amount") or 0)) for row in rows)


def flow_of(row):
    flow = row.get("flow")
    if flow:
        return flow
    category = row.get("category")
    if category in ("Income", "Salary", "Deposits"):
        return "income"
    if category == "Refunds":
        return "refund"
    if category == "Transfers":
        return "transfer"
    if category == "Credit Card Payment":
        return "card_payment"
    if category == "Fees":
        return "fee"
    return "expense"


def direction_of(row):
    direction = row.get("direction")
    if direction in ("in", "out"):
        return direction
    return "in" if flow_of(row) in ("income", "refund") else "out"


def is_spending(row):
    return flow_of(row) in ("expense", "fee") and direction_of(row) == "out"


def is_income(row):
    return flow_of(row) in ("income", "refund") and direction_of(row) == "in"


def answer(question, payload):
    today = parse_date(payload.get("today")) or date.today()
    rows = payload.get("transactions") or []
    budgets = payload.get("budgets") or []
    category = detect_category(question)
    label, start, end = period_for(question, today)
    period_rows = filter_rows(rows, start, end)
    spend_rows = [row for row in period_rows if is_spending(row)]
    income_rows = [row for row in period_rows if is_income(row)]
    scoped = [row for row in spend_rows if not category or row.get("category") == category]

    if re.search(r"budget|limit|left|remaining|over", question, re.I):
        item = next((b for b in budgets if b.get("category") == category), None)
        if item:
            spent = float(item.get("spent") or 0)
            limit = float(item.get("limit") or 0)
            remaining = limit - spent
            if remaining < 0:
                return "budget", (
                    f"{category} is over budget: {money(spent)} spent against a "
                    f"{money(limit)} limit ({money(abs(remaining))} over)."
                )
            return "budget", (
                f"{category} sits at {money(spent)} of its {money(limit)} limit — "
                f"{money(remaining)} left this month."
            )
        spend_items = [b for b in budgets if b.get("kind") != "goal"]
        spent = sum(float(b.get("spent") or 0) for b in spend_items)
        limit = sum(float(b.get("limit") or 0) for b in spend_items)
        if limit:
            remaining = limit - spent
            if remaining < 0:
                return "budget", (
                    f"You are {money(abs(remaining))} over the {money(limit)} monthly plan."
                )
            return "budget", f"You have {money(remaining)} left of the {money(limit)} monthly plan."
        return "budget", "No budgets are configured yet. Set them on the Plan & Budget page."

    if re.search(r"cash\s*flow|money in|money out|inflow|outflow|\bnet\b", question, re.I):
        in_rows = [row for row in period_rows if direction_of(row) == "in"]
        out_rows = [row for row in period_rows if direction_of(row) == "out"]
        in_total = total(in_rows)
        out_total = total(out_rows)
        net = in_total - out_total
        salary = total([row for row in income_rows if row.get("category") == "Salary"])
        deposits = total([row for row in income_rows if row.get("category") == "Deposits"])
        return "cashflow", (
            f"In {label}, money in was {money(in_total)} (salary {money(salary)}, "
            f"deposits {money(deposits)}) and money out was {money(out_total)}. "
            f"Net cash flow: {'+' if net >= 0 else '-'}{money(abs(net))}."
        )

    if re.search(r"income|salary|paycheck|payroll|deposit|money in|earned|got paid", question, re.I):
        scoped_income = [
            row for row in income_rows if not category or row.get("category") == category
        ]
        income = total(scoped_income)
        if not scoped_income:
            scope = f" for {category}" if category else ""
            return "income", f"No income or deposits were recorded in {label}{scope}."
        amounts = defaultdict(float)
        for row in scoped_income:
            amounts[row.get("category", "Deposits")] += abs(float(row.get("amount") or 0))
        breakdown = ", ".join(
            f"{name} {money(amount)}"
            for name, amount in sorted(amounts.items(), key=lambda item: item[1], reverse=True)
        )
        return "income", (
            f"Money in for {label} was {money(income)} across "
            f"{len(scoped_income)} transaction{'s' if len(scoped_income) != 1 else ''} "
            f"({breakdown})."
        )

    if re.search(r"credit card payment|card payment|paid.*card|card.*paid", question, re.I):
        card_rows = [row for row in period_rows if flow_of(row) == "card_payment"]
        card_out = total([row for row in card_rows if direction_of(row) == "out"])
        card_in = total([row for row in card_rows if direction_of(row) == "in"])
        return "card_payment", (
            f"Card payments in {label}: {money(card_out)} paid from bank accounts and "
            f"{money(card_in)} received by cards across {len(card_rows)} "
            f"transaction{'s' if len(card_rows) != 1 else ''}."
        )

    if re.search(r"waste|leak|wasting", question, re.I):
        waste_rows = [row for row in spend_rows if row.get("is_waste")]
        return "waste", (
            f"Waste in {label} was {money(total(waste_rows))} across "
            f"{len(waste_rows)} transactions."
        )

    if re.search(r"top|most|where|merchant|biggest", question, re.I):
        merchants = defaultdict(float)
        for row in scoped:
            merchants[row.get("description", "Unknown")] += abs(float(row.get("amount") or 0))
        ranked = sorted(merchants.items(), key=lambda item: item[1], reverse=True)[:3]
        if not ranked:
            scope = f" for {category}" if category else ""
            return "merchants", f"No spending found in {label}{scope}."
        join = ", ".join(f"{name} ({money(amount)})" for name, amount in ranked)
        return "merchants", f"Top {category or 'spending'} merchants in {label}: {join}."

    if re.search(r"how many|count|number of", question, re.I):
        return "count", (
            f"{len(scoped)} spending transaction{'s' if len(scoped) != 1 else ''}"
            f"{f' for {category}' if category else ''} in {label}."
        )

    if re.search(r"compare|versus|vs\.?|more than|less than|change", question, re.I):
        prev_label, prev_start, prev_end = period_for("last month", today)
        prev_rows = [
            row
            for row in filter_rows(rows, prev_start, prev_end)
            if is_spending(row) and (not category or row.get("category") == category)
        ]
        prev_total = total(prev_rows)
        current = total(scoped)
        if not prev_total:
            return "compare", (
                f"{category or 'Spending'} was {money(current)} in {label}; "
                "there is no previous-month baseline to compare against."
            )
        delta = current - prev_total
        pct = abs(delta / prev_total * 100)
        direction = "up" if delta >= 0 else "down"
        return "compare", (
            f"{category or 'Spending'} in {label} was {money(current)}, "
            f"{direction} {money(abs(delta))} ({pct:.1f}%) versus {prev_label}."
        )

    spent = total(scoped)
    if category:
        return "total", (
            f"You spent {money(spent)} on {category} in {label} across "
            f"{len(scoped)} transaction{'s' if len(scoped) != 1 else ''}."
        )
    return "total", (
        f"You spent {money(spent)} in {label} across "
        f"{len(scoped)} transaction{'s' if len(scoped) != 1 else ''}."
    )


def main():
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(json.dumps({"engine": "python-skill", "intent": "error", "answer": "Invalid input."}))
        return 1

    question = str(payload.get("question", "")).strip()
    if not question:
        print(json.dumps({"engine": "python-skill", "intent": "error", "answer": "Ask a question about your spending."}))
        return 0

    try:
        intent, text = answer(question, payload)
    except Exception as exc:  # keep the API alive even if a rule misbehaves
        intent, text = "error", f"Could not analyse that question ({exc})."

    print(json.dumps({"engine": "python-skill", "intent": intent, "answer": text}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
