# SceneMind

SceneMind is a TypeScript SDK that lets AI agents understand and interact with virtual spaces. This repository is also a starter kit for [Kiro](https://kiro.dev): clone it, open it in Kiro, and describe your application in a spec.

## Features

- **Scene model.** Scenes, entities, and a JSON-serializable `SceneContext` that you give to an AI agent.
- **Validated actions.** The built-in actions `focus`, `highlight`, `navigate`, and `inspect`, plus custom actions with Zod-validated parameters.
- **AI output is untrusted.** `runtime.execute` validates every request and never throws. The AI cannot run code or reach app internals.
- **Framework-agnostic.** The SDK has no rendering, network, or LLM code. Its only runtime dependency is Zod.
- **Kiro steering.** Project guidance in `.kiro/steering/` makes Kiro identify the assets an app needs, write an asset checklist when one is needed, and follow one workflow for each app.

## Installation

Requires Node.js 22.12 or newer and [pnpm](https://pnpm.io) 11.

```bash
git clone https://github.com/omkz/scenemind.git
cd scenemind
pnpm install
pnpm --filter scenemind build
```

## Kiro setup

1. Open the repository folder in Kiro.
2. Keep the files in `.kiro/steering/` enabled. Kiro reads them in every session. They set the rules (public API only, untrusted AI output, no fabricated content) and the application workflow.
3. Optional: `.kiro/settings/mcp.json` adds the Context7 documentation server. Remove it if you do not want it.

No Kiro hooks are needed.

## Start a new project and create a spec

1. In Kiro, create a new spec, choose **Requirements**, and describe your application idea.
2. Answer Kiro's questions. Kiro proposes the technical choices, such as the viewer and UI framework, for you to adjust. If Kiro creates `apps/<app-name>/ASSETS.md`, provide the assets it lists.
3. Review the requirements, design, and tasks, then run the tasks.

Kiro creates your app in `apps/<app-name>/` as a pnpm workspace package that uses the SDK (`"scenemind": "workspace:*"`).

### Example spec prompt

```text
A virtual campus tour. Visitors look around the library, the lab, and
the courtyard in 360 degrees and click points of interest. A text guide
answers questions about what they see, takes them to another location
when asked, points things out, and can compare two places. It only
uses the descriptions we provide, and says so when it does not know.
```

## Asset preparation

Kiro works out which assets your idea needs while it writes the spec. If the app needs external assets or content (images, models, audio, factual text, measured positions), it creates `apps/<app-name>/ASSETS.md` during requirements preparation. Apps built only from generated or text content get no checklist.

- Assets can be your own, procedurally generated, AI-generated, or licensed for your use (public domain, CC0, CC BY, CC BY-SA, or similar). The checklist records the origin of each. Licensed items record credit, source, and license.
- Fictional content is fine when your app is fictional. Factual content needs a source.
- Kiro never invents facts, attribution, licenses, or verification results. Anything you have not provided stays `missing`.
- Only a `required` item that is `missing` blocks release. Fixtures are for development and tests only.
- You verify entity positions yourself only when they must match something real.
- API keys are configuration, not assets. They go in `.env` (git-ignored), and `.env.example` lists the names.

## Build and run

After installation, from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm --filter scenemind typecheck` | Type check without emitting |
| `pnpm --filter scenemind test` | Run the Vitest suite once |
| `pnpm --filter scenemind smoke` | Import the built package and create a runtime (build first) |

Each app documents its own setup and run commands in `apps/<app-name>/README.md`.

## SceneMind public API overview

Everything is exported from `scenemind`.

| Export | Purpose |
| --- | --- |
| `createRuntime({ scenes, initialSceneId, actions? })` | Validates the scene graph and returns a `Runtime`. Throws `SceneMindError` for an invalid definition. |
| `runtime.getContext()` | Returns the current `SceneContext`: scene, entities, focused entity, reachable scenes, available actions. |
| `runtime.attachHandler(type, handler)` | Connects an action to your app. Not allowed for `inspect`. |
| `runtime.execute(request)` | Validates and runs `{ type, params }`. Returns `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`. Never throws. |
| `runtime.syncFocus(entityId \| null)` | Tells the runtime what the user focused in the UI. |
| `runtime.getCurrentSceneId()`, `getFocusedEntityId()` | Read the current state. |
| `runtime.getAvailableActions()`, `listActions()` | Action names usable now, and all registered actions with descriptions. |
| `defineAction({ type, description, params, parameterSummary })` | Defines a custom action with a Zod object schema. |
| `focusAction`, `highlightAction`, `inspectAction`, `navigateAction` | The built-in actions. |
| `ActionRegistry` | Action store used by the runtime. Most apps do not need it. |
| `SceneGraphDefinitionSchema`, `SceneContextSchema`, `EntitySchema`, `ActionResultSchema`, ... | Zod schemas, with matching TypeScript types such as `SceneContext` and `ActionResult`. |
| `SceneMindError` | Error thrown for invalid definitions, with a `code`. |

Result error codes: `INVALID_REQUEST`, `UNKNOWN_ACTION`, `ACTION_UNAVAILABLE`, `INVALID_PARAMETERS`, `INVALID_SCENE_ID`, `INVALID_ENTITY_ID`, `NO_HANDLER`, `HANDLER_FAILED`.

### Example

```ts
import { createRuntime, defineAction } from 'scenemind';
import { z } from 'zod'; // add zod to your app's dependencies

const scenes = {
  scenes: [
    {
      id: 'lobby',
      name: 'Lobby',
      entities: [{ id: 'statue', label: 'Bronze statue', metadata: { period: '3rd century BC' } }],
      reachableSceneIds: ['gallery'],
    },
    { id: 'gallery', name: 'Main gallery', entities: [], reachableSceneIds: ['lobby'] },
  ],
};

// Optional custom action.
const playSound = defineAction({
  type: 'playSound',
  description: 'Play a named sound effect.',
  params: z.object({ name: z.string() }),
  parameterSummary: [{ name: 'name', type: 'string', description: 'Sound name.' }],
});

const runtime = createRuntime({ scenes, initialSceneId: 'lobby', actions: [playSound] });

// Your app makes the visible change. `inspect` needs no handler.
runtime.attachHandler('focus', ({ params }) => viewer.lookAt(params.entityId));
runtime.attachHandler('highlight', ({ params }) => viewer.highlight(params.entityId));
runtime.attachHandler('navigate', async ({ params }) => viewer.load(params.sceneId));
runtime.attachHandler('playSound', ({ params }) => audio.play(params.name));

// Send this to your LLM (from a server endpoint, never with the API key in the browser).
const context = runtime.getContext();

// Treat the model's requested actions as untrusted. execute validates them.
const result = await runtime.execute({ type: 'focus', params: { entityId: 'statue' } });
// { ok: true, type: 'focus', params: { entityId: 'statue' } }

await runtime.execute({ type: 'navigate', params: { sceneId: 'nowhere' } });
// { ok: false, type: 'navigate', error: { code: 'INVALID_SCENE_ID', ... } }

runtime.syncFocus('statue'); // the user clicked the statue
```

`viewer` and `audio` stand for your own code.

## Repository layout

```
packages/scenemind/   SDK source, tests, smoke script
apps/<app-name>/      Your applications (created by specs)
.kiro/steering/       Guidance Kiro follows in every session
.kiro/specs/          Specs for your applications
```

## License

SceneMind is released under the [MIT License](LICENSE).
