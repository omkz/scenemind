---
inclusion: always
---

# SceneMind

SceneMind is a reusable SDK that enables AI agents to understand and interact with virtual environments.

SceneMind is the product. Living Museum is the first example application.

The core SDK must remain domain-agnostic and reusable across museums, heritage sites, tourism, education, games, and other interactive environments.

SceneMind provides structured scene context to AI agents and exposes typed, validated actions that agents may request.

AI agents must never directly manipulate application internals or execute arbitrary code.

Core concepts:
- Scene
- Entity
- SceneContext
- SceneAction
- ActionRegistry