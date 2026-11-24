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
  dist/           # Compiled output

apps/living-museum/
  - First example application
  - May depend on SceneMind
```

## Dependency Rules

- Apps may depend on SceneMind
- SceneMind must never depend on apps
- SceneMind's only runtime dependency is Zod

## Concept Placement

Generic concepts belong in SceneMind:
- Scene
- Entity
- SceneContext
- SceneAction
- ActionRegistry

Domain-specific concepts belong inside applications.
