---
inclusion: always
---

# Project Structure

packages/scenemind/
- reusable SceneMind SDK
- must contain no museum-specific logic

apps/living-museum/
- first example application
- may depend on SceneMind

Dependency rules:
- apps may depend on SceneMind
- SceneMind must never depend on apps

Generic concepts belong in SceneMind:
- Scene
- Entity
- SceneContext
- SceneAction
- ActionRegistry

Domain-specific concepts belong inside applications.
