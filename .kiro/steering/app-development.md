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

The developer may start with only a short idea. Kiro fills the gaps and asks only what it cannot decide.

1. **Concept.** Read the idea. Propose defaults for anything missing: audience, scenes, entities, what the AI guide may do, tone, viewer, and UI. Mark each as a default the developer can change.
2. **Assets.** Work out which assets and content the concept needs. Inspect the repository first (`apps/<app-name>/`, its assets directory, existing files) and reuse what is there. Follow the asset-checklist steering.
3. **Questions.** Ask only essential questions, a few at a time, in plain language. Skip anything already answered or inferable from existing files.
4. **Proposal.** Present one consolidated proposal for approval: concept, scenes and entities, AI behavior, technical choices, assets (present, missing, where to put them), and open questions. Do not start technical design until the developer approves or adjusts it.
5. **Spec.** Write requirements, design, and tasks. Requirements cover scene definitions, AI interaction, testing, and assets when the app needs any.
6. **Build.** Create scene definitions, integrate the viewer and the guide, and verify positions with the developer when position accuracy matters.
7. **Finish.** Test, write the app README, and run the app.

Spec rules:
- The developer supplies only an idea and, where needed, assets or facts. Kiro handles scene ids, entity ids, metadata structure, scene definitions, schemas, and SDK integration. Propose technical choices using the technology steering and let the developer adjust them.
- Preserve names, titles, and descriptions the developer gives. Do not rename or rewrite them. Derive ids from them and keep the original wording as display text.
- Factual apps use only developer-provided information or verified sources. Fictional apps may use generated creative content, marked as fictional.
- If the app needs external assets or content, keep `apps/<app-name>/ASSETS.md` as an internal checklist, created while preparing requirements. The developer does not fill it in. Otherwise, state in the requirements that no assets are needed and skip asset preparation.
- Developer-provided assets go in `apps/<app-name>/assets/` (intake). The app chooses its final layout during implementation and keeps the originals.
- Tasks that depend on assets not yet available use clearly marked fixtures.
- Ask when the concept leaves scenes, entities, or assets undefined and no sensible default exists.

## Scene Definitions

- JSON is the recommended default. Validate it at startup with a schema owned by the app. Code or generated definitions are fine too.
- Whatever the source, the result is a `SceneGraphDefinition` passed to `createRuntime`. Scene ids are unique. Entity ids are unique across all scenes.
- Use `Entity.metadata` (JSON values only) for facts the AI may use.
- Keep rendering data (positions, angles, file paths) in the app, not in the scene graph.
- Custom action schemas must output JSON data only (no `Date`, `Map`, `NaN`, class instances). Use strings and numbers.
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
- Run `execute` calls one at a time: await each before the next, and do not call `syncFocus` while one is pending. Queue visitor clicks and AI requests through the same serial path.
- Render model text as plain text, never as HTML.
- Instruct the model to state facts only from `SceneContext`, and to say so when a fact is missing.
- Call the LLM from a server endpoint. Keep keys in server environment variables, never in the browser, logs, or git. List the variable names in `.env.example` and the app README. Validate request size and shape, set a timeout, and return generic errors.
- An offline fallback guide is recommended so the app runs without a key. It is optional.

## Application Boundaries

- Each application owns its assets, scene definitions, viewer, and AI integration.
- SceneMind remains independent of rendering technologies and application domains.
- Document setup, configuration, run instructions, and asset requirements in each application's README.
- Avoid unnecessary infrastructure. Add a database, authentication, a backend, or an editor only when the application's spec requires it.
