# ADR-005 — Production database: Turso (libSQL) via Prisma driver adapter; serverless jobs and CV storage

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** the PostgreSQL target in `architecture.md` and TODO (never implemented: no server, Docker not installed)
- **Aligned with:** Club ADR-007 (Turso), PFC-App ADR-010 (central libSQL DB)

## Context
- **Deploy target.** PFC Digital Hub deploys to Vercel (serverless).
- **No persistent disk on serverless.** Opportunity Hub ran on a local SQLite file (`DATABASE_URL=file:./dev.db`), stored CVs under `data/private-cv`, and ran jobs from a long-lived `npm run worker` loop. None of these survive or run there.
- **Rest of the platform.** PFC App and Club already use Turso.

## Decision
1. **Database.**
   - Keep Prisma with `provider = "sqlite"` (same schema).
   - When `TURSO_DATABASE_URL` is set, `src/lib/prisma.ts` builds the client with `@prisma/adapter-libsql`.
   - Without it, local development uses the SQLite file exactly as before.
2. **Schema changes.**
   - `prisma db push` cannot reach `libsql://`. Schema SQL lives in `prisma/turso-migrations/NNNN_name/migration.sql`.
   - `npm run db:turso:migrate` applies pending files in a transaction and records them in `_pfc_migrations`.
   - `0001_init` is the full baseline.
3. **CV storage.** `OPP_FILE_STORAGE=db` stores CV bytes in `OppFileBlob` (in Turso). Reads fall back to the other store, so files already on disk stay readable. Download still goes only through the signed, owner-checked `/api/cv/file`.
4. **Jobs (ADR-004 unchanged in intent).**
   - `GET /api/jobs/tick` runs expire → remind → dispatch.
   - It accepts `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) or `x-cron-secret`, with a constant-time compare and a secret of at least 16 characters.
   - `vercel.json` schedules it daily (the Hobby plan limit). On Pro, use `*/15 * * * *` to match the worker interval.
   - `npm run worker` remains for non-serverless hosts.
5. **Seed safety.** `prisma/seed.ts` wipes all tables. Against a remote Turso URL it refuses unless `OPP_SEED_CONFIRM=wipe:<host>`.

## Consequences
- **Gains:**
  - One database technology across the platform.
  - No Postgres server to run.
  - Local development is unchanged.
- **Costs:**
  - CVs in the database grow its size; the 5 MB cap per file stays.
  - A move to object storage is possible later behind the same `private-files.ts` interface.
  - With a daily cron, reminders and expiry run once a day, not every 15 minutes, unless the plan allows more.
  - Schema changes need a new migration file. Prisma Migrate history is not used for Turso.
- **Verified locally:** migrate (run twice), seed, reads, CV write/read in the database and the jobs, all through the adapter against a libSQL file URL. The production build passes with `serverExternalPackages` for the native driver.
