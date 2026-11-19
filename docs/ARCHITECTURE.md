# MoneyTrack Architecture

MoneyTrack is a cross-platform personal finance manager designed for portability and performance.

## Tech Stack
- **Frontend:** React + Vite
- **Language:** TypeScript
- **State Management:** React Query (for data fetching)
- **Database:** Prisma ORM (SQLite for local, PostgreSQL for production)
- **Styling:** Tailwind CSS

## Database Schema
- **User:** Auth credentials, preferences
- **Account:** Bank/Card accounts
- **Transaction:** Date, amount, category, description, account_id
- **Budget:** Category-based limits

## Deployment Strategy
- **Local:** SQLite DB file in the data folder.
- **Production:** PostgreSQL on a remote server or container.
- **Cross-platform:** Docker container or simple binary execution (using Prisma's cross-platform capabilities).
