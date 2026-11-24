---
inclusion: always
---

# Project Structure

```
packages/scenemind/
  src/
    index.ts      # Public entry point
    schemas.ts    # Zod schemas and types
    actions.ts    # SceneAction, ActionRegistry, built-ins
    runtime.ts    # createRuntime, Runtime interface
  test/           # Vitest tests
  scripts/        # Smoke test
  dist/           # Compiled output (build before apps import it)

apps/<app-name>/
  README.md       # Setup, assets, configuration, run instructions
  ASSETS.md       # Asset checklist, only if the app needs external assets
  ...             # Viewer, scene data, AI integration, tests

.kiro/specs/<feature>/   # requirements.md, design.md, tasks.md
.kiro/steering/          # Project guidance for Kiro
```

`apps/` does not exist until a spec creates the first application. Create `apps/<app-name>/` as a pnpm workspace package. `pnpm-workspace.yaml` already includes `apps/*`.

## Dependency Rules

- Apps depend on SceneMind with `"scenemind": "workspace:*"` and import only from the `scenemind` entry point
- SceneMind must never depend on apps
- SceneMind's only runtime dependency is Zod
- Do not modify `packages/scenemind` to suit one application

## Concept Placement

Generic concepts belong in SceneMind:
- Scene
- Entity
- SceneContext
- SceneAction
- ActionRegistry

Domain-specific concepts (for example gallery, exhibit, lesson, quest) and rendering data (positions, camera angles, image paths) belong inside applications.
