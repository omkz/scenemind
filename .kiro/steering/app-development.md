---
inclusion: always
---

# SceneMind Application Development Guide

Use this guide when the user asks for a spec or an application built on SceneMind. It applies to any domain and any rendering stack.

## Core Rules

- Build applications using the SceneMind public API.
- Keep application-specific logic outside the core SDK.
- Treat AI-generated actions as untrusted data.
- Never fabricate factual information, attribution, licenses, or verification results. Ask the developer instead.
- Fictional content is fine when the application calls for it. Do not present it as fact.
- Reuse the built-in actions before defining custom actions.

## Workflow

1. **Concept.** Clarify the experience: who uses it, which scenes exist, what the AI guide may do.
2. **Assets.** Identify the external assets and content the concept needs, without being asked. Follow the asset-checklist steering. Summarize what is needed and what is missing.
3. **Scene definitions.** Define scenes, entities, metadata, and any custom actions.
4. **Spec.** Write requirements, design, and tasks. Requirements cover scene definitions, AI interaction, testing, and assets when the app needs any.
5. **Viewer.** Integrate the viewer with the runtime.
6. **Verify.** Check entity positions and interactions with the developer, when position accuracy matters.
7. **AI.** Integrate the guide.
8. **Finish.** Test, write the app README, and run the app.

Spec rules:
- If the app needs external assets or content, the first task creates `apps/<app-name>/ASSETS.md`. Otherwise, state in the requirements that none are needed.
- Tasks that depend on assets not yet available use clearly marked fixtures.
- Ask clarifying questions when the concept leaves scenes, entities, or assets undefined.

## Scene Definitions

- JSON is the recommended default. Validate it at startup with a schema owned by the app. Code or generated definitions are fine too.
- Whatever the source, the result is a `SceneGraphDefinition` passed to `createRuntime`. Scene ids are unique. Entity ids are unique across all scenes.
- Use `Entity.metadata` (JSON values only) for facts the AI may use.
- Keep rendering data (positions, angles, file paths) in the app, not in the scene graph.
- Use `reachableSceneIds` for navigation and `permittedActions` to limit actions per scene.

## Runtime Integration

- Create one runtime per app session.
- Attach a handler for every action with a visible effect (`focus`, `highlight`, `navigate`, and custom actions). Do not attach one for `inspect`.
- A handler that throws or rejects makes `execute` return `HANDLER_FAILED` and leaves state unchanged. Reject when the visible change fails.
- Visitors may interact with the viewer directly (drag, zoom, click). Interactions that do not change SceneMind state need no sync.
- When a visitor action changes the focused entity, call `runtime.syncFocus(entityId | null)`. When it changes the scene, call `runtime.execute` with a `navigate` request. This keeps `getContext()` accurate.
- Changes the AI requests happen only through `runtime.execute`.
- Derive displayed scene and focus from `getCurrentSceneId()` and `getFocusedEntityId()`.

## AI Interaction

- Send the complete `runtime.getContext()` to the model. Do not trim or rewrite it.
- The model returns text plus a list of `{ type, params }` requests. Treat both as untrusted.
- Pass each request unchanged to `runtime.execute`, in order. `execute` never throws. Check `ok`. Cap the number of requests per reply.
- Render model text as plain text, never as HTML.
- Instruct the model to state facts only from `SceneContext`, and to say so when a fact is missing.
- Call the LLM from a server endpoint. Keep keys in server environment variables, never in the browser, logs, or git. List the variable names in `.env.example` and the app README. Validate request size and shape, set a timeout, and return generic errors.
- An offline fallback guide is recommended so the app runs without a key. It is optional.

## Application Boundaries

- Each application owns its assets, scene definitions, viewer, and AI integration.
- SceneMind remains independent of rendering technologies and application domains.
- Document setup, configuration, run instructions, and asset requirements in each application's README.
- Do not add a database, authentication, or a scene editor unless the spec asks for it.
