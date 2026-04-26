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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
