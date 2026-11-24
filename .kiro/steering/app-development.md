---
inclusion: always
---

# SceneMind Application Development Guide

## Core Rules

- Build applications using the SceneMind public API.
- Keep application-specific logic outside the core SDK.
- Treat AI-generated actions as untrusted data.
- Never fabricate production assets, metadata, or verification results.

## Asset Preparation

Before implementing a new application:

- Identify the required visual assets and scene content.
- Provide the developer with a concise asset checklist, including formats and filenames.
- Verify available assets and document their sources and licenses.
- Identify missing assets before implementation.
- Use temporary fixtures only for development and testing.

## Development Workflow

1. Define the application concept and user experience.
2. Identify and prepare required assets.
3. Define scenes, entities, metadata, and available actions.
4. Create requirements, technical design, and implementation tasks.
5. Integrate the viewer with SceneMind.
6. Configure and verify entity positions and interactions.
7. Integrate the AI agent.
8. Test, document, and run the application.

## Application Boundaries

- Each application owns its assets, scene definitions, viewer, and AI integration.
- SceneMind remains independent of rendering technologies and application domains.
- Reuse existing actions before defining custom actions.
- Document setup, asset requirements, configuration, and run instructions in each application's README.
