# Prisma local3 guide

Use this when you want to run the app and Prisma against your **local PostgreSQL** (user `local3`, port `5442`, database `local`).

## Prerequisites

- PostgreSQL running locally with:
  - User: `local3`
  - Password: `local3`
  - Port: `5442`
  - Database: `local`
- Env file: `.env.local.dev` already has `DATABASE_URL` for this.

## 1. Generate Prisma Client (once / after schema changes)

Uses `.env.local.dev` so no need to change `.env`:

```bash
pnpm prisma:generate:local
```

Or with env loaded manually:

```bash
dotenv -e .env.local.dev -- pnpm exec prisma generate
```

## 2. Apply migrations to local3 DB

Creates/updates tables in your local database:

```bash
pnpm prisma:migrate:local
```

Or:

```bash
dotenv -e .env.local.dev -- pnpm exec prisma migrate dev
```

When prompted for a migration name, use a short slug (e.g. `add_user_avatar`).

## 3. Run the Next app against local3

Existing scripts (no new setup needed):

- **`pnpm dev:local`** — app with `.env.local.dev` (local3 DB) on port **3001**  
  App: http://localhost:3001 | DB: `postgresql://local3:local3@localhost:5442/local`

- **`pnpm dev:both`** — runs **shared** (port 3000) and **local** (port 3001) at the same time

## 4. Other useful commands (with local3)

- **Prisma Studio** (browse/edit data):
  ```bash
  pnpm prisma:studio:local
  ```

- **Export table** (e.g. from shared DB, then import locally):
  ```bash
  dotenv -e .env.shared.dev -- pnpm exec tsx scripts/export-table.ts
  dotenv -e .env.local.dev -- pnpm exec tsx scripts/import-table.ts
  ```

- **Reset local DB** (drops DB and reapplies migrations):
  ```bash
  dotenv -e .env.local.dev -- pnpm exec prisma migrate reset
  ```

## Env files summary

| File             | Use case              | DATABASE_URL              |
|------------------|------------------------|---------------------------|
| `.env`           | Default (e.g. main)    | Render / main             |
| `.env.local.dev` | Local dev (local3)     | localhost:5442, DB `local`|
| `.env.shared.dev`| Shared dev (Render)    | Render / main             |

Always use `-e .env.local.dev` (or the `:local` scripts) when you want to target the local3 database.
