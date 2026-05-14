# KUCET CMS — Repository Guidelines

Last updated: May 15, 2026

## Project Structure

| Path | Purpose |
|---|---|
| `src/app/` | Next.js App Router pages + API routes (`src/app/api/.../route.js`) |
| `src/components/` | React components (PascalCase files) |
| `src/context/` | Global state providers (`ClerkContext`, `StudentContext`, `AdminContext`, `AcademicsContext`, `FacultyAttendanceContext`, `AssetContext`, `ScholarshipDashboardContext`) |
| `src/lib/` | Server utilities: DB, auth, PDF, encryption, roll number parsing, rate limiting, clock, email, menu config, validations |
| `src/services/` | Business logic static classes (`StudentService`, `FacultyService`, `HealthService`) — API routes delegate here |
| `src/db/` | DB connection (`index.js`), Drizzle schema (`schema.js`), maintenance scripts |
| `src/proxy.js` | Edge middleware — JWT auth, silent refresh, role-based redirects |
| `src/lib/menu-config.js` | Sidebar/nav menu definitions per role |
| `public/` | Static assets (local images preferred over Cloudinary for speed) |
| `drizzle/` | Drizzle Kit migration SQL files |
| `tests/` | Playwright E2E (`tests/**/*.spec.js`) + Vitest unit (`tests/unit/**/*.test.js`) |

## Commands

```bash
npm run dev          # Local dev on :3000
npm run build        # Production build (Sentry + PWA)
npm run lint         # ESLint (next/core-web-vitals)
npm run test:unit    # Vitest unit tests
npm run test:coverage# Vitest with V8 (80% threshold)
npx playwright test  # E2E (Chromium only, 2 retries on CI)
```

**Database:**
```bash
npm run db:generate  # drizzle-kit generate
npm run db:push      # drizzle-kit push (interactive — avoid in CI)
npm run db:migrate   # tsx src/db/migrate.js (non-interactive — use this in CI)
npm run db:backup    # Backup to Cloudinary
npm run db:prune     # Expired OTPs/tokens cleanup
npm run db:rotate-keys # Rotate AES encryption keys
```

**Pre-commit:** Husky runs `npx lint-staged` → `eslint --fix` on staged `*.{js,jsx,ts,tsx}`. Commit fails if ESLint errors remain.

## Architecture

- **Language:** JavaScript (no TypeScript). 2-space indent, semicolons, `@/` path alias maps to `./src/`.
- **Auth:** JWT (HS256 via `jose`), HTTP-only cookies (`admin_auth`, `clerk_auth`, `student_auth`). Companion non-HTTP-only: `clerk_logged_in`, `clerk_role`, `student_logged_in`. Verified in Edge middleware (`src/proxy.js`). Silent refresh at `/api/auth/refresh`.
- **Roles:** `student`, `admin`, clerk sub-roles (`scholarship`, `admission`, `faculty`). HOD = boolean `is_hod` on faculty clerks.
- **DB:** MySQL via `mysql2/promise` + Drizzle ORM. SSL/TLS when `DB_SSL=true` or host includes `tidbcloud.com`. Serverless pool: connectionLimit 15, idleTimeout 30s.
- **Google OAuth:** NextAuth (`[...nextauth]/route.js`). Clerk table check + developer email allowlist (`src/lib/developers.js`). Developers with Gmail-only accounts can also login (go to `/developers` after Google auth).
- **Real-time:** Supabase Realtime Broadcast via `src/lib/sse.js`, channel `kucet-updates`. No local SSE. `RealtimeListener` component on clients.
- **Time:** All logic uses `getNow()` from `src/lib/clock.js` (IST, UTC+5:30). Mock with `dev_mock_date` cookie when `NEXT_PUBLIC_WORKING_ENV=testing`.
- **Roll Numbers:** Parsed by `src/lib/rollNumber.js`. Format: `YY567TBBSS` (Regular) / `YY567BBSSL` (Lateral). Branch codes: 09=CSE, 30=CSD, 15=ECE, 12=EEE, 00=CIVIL, 18=IT, 03=MECH.
- **Encryption:** AES-256-GCM for mobile/Aadhaar (`src/lib/encryption.js`). Blind indexing via HMAC-SHA256. `ENCRYPTION_KEY` = 64-char hex.
- **Rate limiting:** Upstash Redis (primary) + MySQL fallback (`src/lib/rate-limit.js`).
- **Env validation:** Zod schema in `src/lib/env.js`. Hard crash in production if invalid.
- **Logging:** `pino` with `pino-pretty` dev transport. Redacts secrets.
- **CSP:** Strict policy in `next.config.mjs`. `connect-src` includes `*.supabase.co` + `wss://*.supabase.co`.
- **PWA:** `@ducanh2912/next-pwa`, disabled in dev. API routes excluded from SW cache (denylist: `/^\/api\/.*$/`).
- **Overrides** in package.json (don't downgrade): `mysql2@^3.16.0`, `postcss@^8.5.14`, `esbuild@^0.25.0`, `serialize-javascript@^7.0.5`.

## Key Conventions

- **"Thin Route, Fat Service"** — API routes do auth + parse, delegate to `src/services/`.
- **Academic year** is computed, not stored. Fee amounts auto-calculated centrally.
- **Roll number** is the single source of truth — branch, year, academic type derived from it.
- **Context caching:** Providers skip `setLoading(true)` if valid data exists in memory for fast page transitions.
- **Sensitive fields** (mobile, aadhaar) encrypted at rest. Decrypted on-the-fly for authorized views.
- **`bug_reports` table** supports `type` (BUG/FEATURE_REQUEST), `severity`, `submitted_by`, `fixed_by`. GET is public. POST requires auth. PATCH restricted to developer emails in `src/lib/developers.js`.
- **PWA icons** served from `/public/assets/` (not Cloudinary — Cloudinary URLs return 404).

## Testing Quirks

- Vitest mocks Drizzle + external integrations (Redis, Email). Service layer only, not API routes.
- Playwright E2E needs `npm run build` + `npm run start` or uses auto webServer. Inject mock auth cookies directly.
- CI provides dummy env vars (build-only, no real DB). `db:push` is interactive — use `db:migrate` in CI instead.
- Unit test pattern: `tests/unit/**/*.test.js`. E2E: `tests/**/*.spec.js` (Chromium only).

## Dev Gotchas

- On Windows, use `Get-Content file.txt | opencode` to pipe input (PowerShell doesn't support `<` redirect).
- `db:push` is interactive (TTY required). Use `db:migrate` for scripted/CI migrations.
- Turbopack dev can be slow on cold start due to menu-config import chain — this is known.
- Foreign browser extensions (Grammarly, translators) can cause React hydration noise — there's a suppressor in `RealtimeListener.js`.
- `.env.local` is gitignored. Required vars documented in `src/lib/env.js`.
