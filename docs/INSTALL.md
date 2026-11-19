# Installation Guide

## Local
1. `npm install`
2. `npx prisma db push`
3. `npm run dev`

## Production (Docker)
1. Set `DATABASE_URL` to your PostgreSQL instance.
2. `docker-compose up -d`
