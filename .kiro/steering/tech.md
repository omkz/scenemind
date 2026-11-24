---
inclusion: always
---

# Technology

Core SDK:
- TypeScript 5.5+ with strict mode
- Zod 4 for schema validation
- Vitest for testing
- fast-check for property-based testing

Tooling:
- Node.js 22.12 or newer
- pnpm 11 (pinned in `packages/scenemind/package.json`)

Applications:
- The spec chooses the rendering and UI stack. SceneMind works with any of them.
- When the spec is silent, default to TypeScript (strict), Vite, Vitest, and fast-check.
- Name the chosen viewer library (for example Marzipano, three.js, Phaser) in the spec and in the app README.

AI integration:
- LLM calls run on a server-side endpoint. API keys come from server environment variables and never reach the browser, logs, or git.
- List the variable names in `.env.example`. `.env` stays git-ignored.

Infrastructure:
- Each application's spec decides what it needs (backend, database, authentication, editor, voice).
- Avoid unnecessary infrastructure by default. Prefer the simplest approach, client-only when it suffices.
- Voice is optional. If a spec asks for it, LiveKit is one option.

## Common Commands

From the repository root:
- `pnpm install` - Install dependencies
- `pnpm --filter scenemind build` - Compile TypeScript to dist/
- `pnpm --filter scenemind typecheck` - Type check without emitting
- `pnpm --filter scenemind test` - Run the Vitest suite once
- `pnpm --filter scenemind smoke` - Run the smoke test (needs a build first)

The same scripts run from `packages/scenemind/` without `--filter`.
