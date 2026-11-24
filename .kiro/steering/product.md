---
inclusion: always
---

# SceneMind

SceneMind is a reusable SDK that enables AI agents to understand and interact with virtual environments. The repository is also a Kiro starter kit: a developer clones it, opens it in Kiro, and creates a spec that describes an application idea.

SceneMind is the product. Applications built on it live in `apps/` and are examples of its use.

The core SDK must remain domain-agnostic and reusable across museums, heritage sites, tourism, education, games, and other interactive environments. It does not know about rendering, networking, or any LLM.

SceneMind provides structured scene context to AI agents and exposes typed, validated actions that agents may request.

AI agents must never directly manipulate application internals or execute arbitrary code.

## Core Concepts

- **Scene** - A named location/view in a virtual environment
- **Entity** - An object inside a Scene that AI can reference
- **SceneContext** - JSON-serializable snapshot for AI agents
- **SceneAction** - Typed action with Zod-validated parameters
- **ActionRegistry** - Stores and validates actions

## Built-in Actions

- `focus` - Bring an entity into focus
- `highlight` - Highlight an entity
- `navigate` - Transition to another scene
- `inspect` - Return entity data (handled by SceneMind, no handler needed)

## Key Principle

SceneMind validates all action requests before execution. AI output is treated as untrusted data.
