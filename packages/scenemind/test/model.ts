// Reference model for the SceneMind Runtime. Written from the Glossary and the
// Requirement 7.3 validation order. It must NOT import src/runtime.ts.
import {
  focusAction,
  highlightAction,
  inspectAction,
  navigateAction,
  type SceneAction,
} from '../src/actions.js';
import type { ErrorCode, Scene, SceneGraphDefinition } from '../src/schemas.js';

export interface Model {
  definition: SceneGraphDefinition;
  currentSceneId: string;
  focusedEntityId: string | null;
  /** Registered actions in registration order: built-ins first, then custom. */
  actions: SceneAction[];
  /** Names of actions that have a handler attached. */
  handlers: Set<string>;
}

export type Outcome = ErrorCode | 'OK';

export function createModel(
  definition: SceneGraphDefinition,
  initialSceneId: string,
  customActions: readonly SceneAction[] = [],
): Model {
  return {
    definition,
    currentSceneId: initialSceneId,
    focusedEntityId: null,
    actions: [focusAction, highlightAction, inspectAction, navigateAction, ...customActions],
    handlers: new Set(),
  };
}

export function currentScene(model: Model): Scene {
  const scene = model.definition.scenes.find((s) => s.id === model.currentSceneId);
  if (!scene) throw new Error(`Model: scene ${model.currentSceneId} is not defined`);
  return scene;
}

export function modelAttach(model: Model, type: string): void {
  model.handlers.add(type);
}

function isPermitted(scene: Scene, type: string): boolean {
  return scene.permittedActions === undefined || scene.permittedActions.includes(type);
}

/** Available_Actions: registered, permitted by the current Scene, and (except inspect) handled. */
export function expectedAvailable(model: Model): string[] {
  const scene = currentScene(model);
  return model.actions
    .filter((a) => isPermitted(scene, a.type))
    .filter((a) => a.type === 'inspect' || model.handlers.has(a.type))
    .map((a) => a.type);
}

function hasEntity(scene: Scene, id: unknown): boolean {
  return typeof id === 'string' && scene.entities.some((e) => e.id === id);
}

/**
 * Parse params with the action's own schema, as pipeline step 5 requires.
 * Returns undefined when parsing throws, fails, or yields non-JSON output.
 */
function parseParams(action: SceneAction, params: unknown): Record<string, unknown> | undefined {
  try {
    const result = action.params.safeParse(params);
    if (!result.success) return undefined;
    const json = JSON.stringify(result.data);
    if (typeof json !== 'string') return undefined;
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** The Error_Code `execute(request)` should produce, or 'OK' when validation passes. */
export function expectedOutcome(model: Model, request: unknown): Outcome {
  // Step 1: INVALID_REQUEST. type and params are read once; a throw is INVALID_REQUEST.
  let type: unknown;
  let params: unknown;
  try {
    if (typeof request !== 'object' || request === null || Array.isArray(request)) {
      return 'INVALID_REQUEST';
    }
    type = (request as { type?: unknown }).type;
    if (typeof type !== 'string') return 'INVALID_REQUEST';
    if (!('params' in request)) return 'INVALID_REQUEST';
    params = (request as { params?: unknown }).params;
  } catch {
    return 'INVALID_REQUEST';
  }

  // Step 2: UNKNOWN_ACTION.
  const action = model.actions.find((a) => a.type === type);
  if (!action) return 'UNKNOWN_ACTION';

  // Step 3: ACTION_UNAVAILABLE (not a Permitted_Action of the Current_Scene).
  const scene = currentScene(model);
  if (!isPermitted(scene, type)) return 'ACTION_UNAVAILABLE';

  // Step 4: NO_HANDLER (inspect is answered by the Runtime itself).
  if (type !== 'inspect' && !model.handlers.has(type)) return 'NO_HANDLER';

  // Step 5: INVALID_PARAMETERS.
  const parsed = parseParams(action, params);
  if (parsed === undefined) return 'INVALID_PARAMETERS';

  // Step 6: reference checks, built-ins only.
  if (type === 'navigate') {
    const sceneId = parsed.sceneId;
    if (typeof sceneId !== 'string' || !scene.reachableSceneIds.includes(sceneId)) {
      return 'INVALID_SCENE_ID';
    }
  } else if (type === 'focus' || type === 'highlight' || type === 'inspect') {
    if (!hasEntity(scene, parsed.entityId)) return 'INVALID_ENTITY_ID';
  }
  return 'OK';
}

/**
 * Apply a request to the model the way the Runtime should, given whether the handler fails.
 * Returns the Error_Code or 'OK'. Only a request that validated is run; state changes only
 * when the handler succeeds (navigate: scene change and focus cleared; focus: focus set).
 */
export function applyExecute(model: Model, request: unknown, handlerFails: boolean): Outcome {
  const outcome = expectedOutcome(model, request);
  if (outcome !== 'OK') return outcome;
  const { type, params } = request as { type: string; params: unknown };
  if (type === 'inspect') return 'OK';
  if (handlerFails) return 'HANDLER_FAILED';
  const action = model.actions.find((a) => a.type === type) as SceneAction;
  const parsed = parseParams(action, params) as Record<string, unknown>;
  if (type === 'navigate') {
    model.currentSceneId = parsed.sceneId as string;
    model.focusedEntityId = null;
  } else if (type === 'focus') {
    model.focusedEntityId = parsed.entityId as string;
  }
  return 'OK';
}

/** Expected Focus_Sync_Result code, applying the change to the model on success. */
export function modelSyncFocus(model: Model, input: unknown): 'OK' | 'INVALID_REQUEST' | 'INVALID_ENTITY_ID' {
  if (input === null) {
    model.focusedEntityId = null;
    return 'OK';
  }
  if (typeof input !== 'string' || input.length === 0) return 'INVALID_REQUEST';
  if (!hasEntity(currentScene(model), input)) return 'INVALID_ENTITY_ID';
  model.focusedEntityId = input;
  return 'OK';
}
