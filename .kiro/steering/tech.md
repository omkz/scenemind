---
inclusion: always
---

# Technology

Core:
- TypeScript 5.5+ with strict mode
- Zod 4 for schema validation
- Vitest for testing
- fast-check for property-based testing

Example applications:
- React
- Vite

Living Museum:
- Marzipano for 360-degree panorama

Voice:
- LiveKit will be added after text interaction is stable
- Python may be used for the LiveKit agent

MVP constraints:
- No database
- No authentication
- No unnecessary backend infrastructure

## Common Commands

From `packages/scenemind/`:
- `pnpm build` - Compile TypeScript to dist/
- `pnpm typecheck` - Type check without emitting
- `pnpm test` - Run Vitest test suite
- `pnpm smoke` - Run smoke test script
