# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js App Router pages and API routes (e.g., `src/app/api/.../route.js`).
- `src/components/`: Shared React components (PascalCase file names).
- `src/lib/`: Server utilities (DB access, auth helpers, PDF, roll number logic).
- `public/`: Static assets.
- `screenshots/`: README assets.
- Root scripts/data: SQL files and helper scripts (`*.sql`, `update_enum.js`, `generate_syllabus_csv.js`).

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start local dev server on `http://localhost:3000`.
- `npm run build`: Production build.
- `npm run start`: Run production server from `.next`.
- `npm run lint`: Run ESLint.

No dedicated automated test command is defined currently.

## Coding Style & Naming Conventions
- JavaScript, Next.js App Router.
- Indentation: 2 spaces. Semicolons are used.
- Files: `page.js` for routes, `route.js` for API endpoints, components in PascalCase.
- Prefer server-side redirects and auth enforcement via `src/proxy.js` and JWT cookies.

## Testing Guidelines
- No first-party test suite detected. Use manual verification plus `npm run lint`.
- When adding tests, place them under a project-level `tests/` or `__tests__/` folder and document the command in `package.json`.

## Commit & Pull Request Guidelines
- Recent commits use short, sentence-style messages (e.g., “Fixed marks fetching…”). Keep messages concise and descriptive.
- PRs should include:
  - Summary of changes and motivation.
  - Steps to test (local commands or manual flow).
  - Screenshots for UI changes.

## Security & Configuration Tips
- Secrets live in `.env.local` (DB credentials, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_URL`).
- Never commit real secrets; keep `.env.local` out of git.
- Auth relies on HTTP-only cookies (`admin_auth`, `clerk_auth`, `student_auth`) verified in `src/proxy.js`. Ensure any new auth flow sets the correct cookie.
