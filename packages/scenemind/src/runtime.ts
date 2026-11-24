import type { z } from 'zod';
import {
  ActionRegistry,
  focusAction,
  highlightAction,
  inspectAction,
  navigateAction,
  type ActionHandler,
  type ActionListEntry,
  type SceneAction,
} from './actions.js';
import {
  FocusSyncRequestSchema,
  SceneGraphDefinitionSchema,
  SceneIdSchema,
  SceneMindError,
  type ActionResult,
  type Entity,
  type EntityId,
  type FocusSyncResult,
  type Scene,
  type SceneContext,
  type SceneGraphDefinition,
  type SceneId,
} from './schemas.js';

export interface RuntimeConfig<A extends readonly SceneAction[] = readonly []> {
  scenes: SceneGraphDefinition;
  initialSceneId: SceneId;
  /** Registered after the four built-ins. */
  actions?: A;
}

type BuiltInAction =
  | typeof focusAction
  | typeof highlightAction
  | typeof inspectAction
  | typeof navigateAction;

/** Every built-in and custom action type in a Runtime. */
export type AllActions<A extends readonly SceneAction[]> = BuiltInAction | A[number];

/** Every built-in and custom action name except `inspect`. */
export type HandlerBackedName<A extends readonly SceneAction[]> = Exclude<
  AllActions<A>['type'],
  'inspect'
>;

/** Parsed parameter type (`z.output`) of the action named `K`. */
export type ParamsOf<A extends readonly SceneAction[], K extends string> = z.output<
  Extract<AllActions<A>, { type: K }>['params']
>;

/**
 * Public Runtime surface.
 * `A` carries the custom action types for attachHandler.
 */
export interface Runtime<A extends readonly SceneAction[] = readonly []> {
  getCurrentSceneId(): SceneId;
  getFocusedEntityId(): EntityId | null;
  getContext(): SceneContext;
  getAvailableActions(): string[];
  listActions(): ActionListEntry[];
  attachHandler<K extends HandlerBackedName<A>>(
    type: K,
    handler: ActionHandler<K, ParamsOf<A, K>>,
  ): void;
  /**
   * Validates and runs an Action_Request. Never throws and never rejects.
   *
   * Calls are not queued. Each call validates against the state at its start and commits after
   * its handler resolves, so overlapping calls can validate against stale state. Applications
   * must wait for one `execute` to settle before starting the next, and must not call
   * `syncFocus` while an `execute` is pending.
   *
   * A custom action's parsed parameters must be JSON data (no Date, Map, NaN, and so on).
   * Otherwise the result is `INVALID_PARAMETERS` and no handler runs.
   */
  execute(request: unknown): Promise<ActionResult>;
  /** Synchronizes Focused_Entity_ID from the UI. Never throws; a failure changes nothing. */
  syncFocus(input: unknown): FocusSyncResult;
}

/** Immutable, indexed Scene_Graph built once by createRuntime. */
export interface SceneGraph {
  readonly scenes: ReadonlyMap<SceneId, Readonly<Scene>>;
  /** Entity_ID to the Scene_ID that owns it. Entity_IDs are globally unique. */
  readonly entityScene: ReadonlyMap<EntityId, SceneId>;
}

/** Mutable runtime state. Only commitAfterHandler and syncFocus change it. */
export interface RuntimeState {
  currentSceneId: SceneId;
  focusedEntityId: EntityId | null;
}

interface Issue {
  path: string;
  message: string;
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.map((p) => String(p)).join('.');
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/**
 * True when `value` is what JSON.parse(JSON.stringify(value)) would give back: null, booleans,
 * strings, finite numbers, dense arrays, and plain objects of such values. An object property
 * whose value is `undefined` counts as absent, as it does for an optional field. Anything else
 * (Date, Map, Set, class instances, NaN, Infinity, functions, symbols, sparse arrays, cycles)
 * would be changed or dropped by serialization.
 */
function isJsonSafe(value: unknown, ancestors: unknown[] = []): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.includes(value)) return false;
  const next = [...ancestors, value];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!(i in value) || !isJsonSafe(value[i], next)) return false;
    }
    return true;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).every((v) => v === undefined || isJsonSafe(v, next));
}

/** `Handler failed: <message>` for an Error with a readable string message, else `Handler failed.` */
function handlerFailureMessage(err: unknown): string {
  try {
    if (err instanceof Error) {
      const message: unknown = err.message;
      if (typeof message === 'string' && message.length > 0) return `Handler failed: ${message}`;
    }
  } catch {
    // A throwing getter falls through to the generic message.
  }
  return 'Handler failed.';
}

function invalidDefinition(issues: Issue[]): SceneMindError {
  return new SceneMindError('INVALID_DEFINITION', 'Scene graph definition is invalid.', { issues });
}

/** Steps 1-3: validate. Returns the parsed definition and throws on the first problem. */
function validateDefinition(scenes: unknown, initialSceneId: unknown): {
  definition: SceneGraphDefinition;
  initialSceneId: SceneId;
} {
  const issues: Issue[] = [];
  const parsedGraph = SceneGraphDefinitionSchema.safeParse(scenes);
  if (!parsedGraph.success) {
    for (const i of parsedGraph.error.issues) {
      issues.push({ path: `scenes${i.path.length ? '.' : ''}${formatPath(i.path)}`, message: i.message });
    }
  }
  const parsedInitial = SceneIdSchema.safeParse(initialSceneId);
  if (!parsedInitial.success) {
    for (const i of parsedInitial.error.issues) {
      issues.push({ path: 'initialSceneId', message: i.message });
    }
  }
  if (!parsedGraph.success || !parsedInitial.success) throw invalidDefinition(issues);

  const definition = parsedGraph.data;
  const initial = parsedInitial.data;

  const sceneIds = new Set<SceneId>();
  for (const scene of definition.scenes) {
    if (sceneIds.has(scene.id)) {
      throw new SceneMindError('DUPLICATE_SCENE_ID', `Duplicate scene ID: ${scene.id}`, { id: scene.id });
    }
    sceneIds.add(scene.id);
  }

  const entityIds = new Set<EntityId>();
  for (const scene of definition.scenes) {
    for (const entity of scene.entities) {
      if (entityIds.has(entity.id)) {
        throw new SceneMindError('DUPLICATE_ENTITY_ID', `Duplicate entity ID: ${entity.id}`, {
          id: entity.id,
        });
      }
      entityIds.add(entity.id);
    }
  }

  for (const scene of definition.scenes) {
    for (const reachable of scene.reachableSceneIds) {
      if (!sceneIds.has(reachable)) {
        throw new SceneMindError('UNKNOWN_SCENE_ID', `Unknown reachable scene ID: ${reachable}`, {
          id: reachable,
        });
      }
    }
  }
  if (!sceneIds.has(initial)) {
    throw new SceneMindError('UNKNOWN_SCENE_ID', `Unknown initial scene ID: ${initial}`, { id: initial });
  }

  return { definition, initialSceneId: initial };
}

/** Step 4: JSON-copy, deep-freeze, and index. */
function buildGraph(definition: SceneGraphDefinition): SceneGraph {
  const copy = deepFreeze(JSON.parse(JSON.stringify(definition)) as SceneGraphDefinition);
  const scenes = new Map<SceneId, Readonly<Scene>>();
  const entityScene = new Map<EntityId, SceneId>();
  for (const scene of copy.scenes) {
    scenes.set(scene.id, scene);
    for (const entity of scene.entities as readonly Entity[]) entityScene.set(entity.id, scene.id);
  }
  return { scenes, entityScene };
}

export function createRuntime<const A extends readonly SceneAction[] = readonly []>(
  config: RuntimeConfig<A>,
): Runtime<A> {
  if (config === null || typeof config !== 'object') {
    throw new SceneMindError('INVALID_DEFINITION', 'Runtime config must be an object.');
  }
  if (config.actions !== undefined && !Array.isArray(config.actions)) {
    throw new SceneMindError('INVALID_DEFINITION', 'Runtime config "actions" must be an array.');
  }
  const { definition, initialSceneId } = validateDefinition(config.scenes, config.initialSceneId);
  const graph: SceneGraph = buildGraph(definition);
  const state: RuntimeState = { currentSceneId: initialSceneId, focusedEntityId: null };

  const registry = new ActionRegistry();
  for (const builtIn of [focusAction, highlightAction, inspectAction, navigateAction]) {
    registry.register(builtIn);
  }
  for (const action of config.actions ?? []) registry.register(action);

  const handlers = new Map<string, ActionHandler<string, unknown>>();

  const currentScene = (): Readonly<Scene> => {
    const scene = graph.scenes.get(state.currentSceneId);
    if (scene === undefined) throw new Error('Current scene is missing from the scene graph.');
    return scene;
  };

  /** Available_Actions: permitted in the Current_Scene, and inspect or handler-backed. */
  const availableActions = (): readonly SceneAction[] => {
    const permitted = currentScene().permittedActions;
    return registry
      .entries()
      .filter((a) => permitted === undefined || permitted.includes(a.type))
      .filter((a) => a.type === 'inspect' || handlers.has(a.type));
  };

  const getAvailableActions = (): string[] => availableActions().map((a) => a.type);

  /** All registered actions in registration order, regardless of availability. */
  const listActions = (): ActionListEntry[] => registry.list();

  const getContext = (): SceneContext => {
    const scene = currentScene();
    const sceneInfo: SceneContext['scene'] = { id: scene.id, name: scene.name };
    if (scene.description !== undefined) sceneInfo.description = scene.description;
    const reachableScenes: SceneContext['reachableScenes'] = [];
    for (const id of scene.reachableSceneIds) {
      const target = graph.scenes.get(id);
      if (target !== undefined) reachableScenes.push({ id: target.id, name: target.name });
    }
    return {
      scene: sceneInfo,
      entities: scene.entities.map((e): Entity => JSON.parse(JSON.stringify(e)) as Entity),
      focusedEntityId: state.focusedEntityId,
      reachableScenes,
      actions: availableActions().map((a) => ({
        type: a.type,
        description: a.description,
        parameters: a.parameterSummary.map((p) => ({
          name: p.name,
          type: p.type,
          description: p.description,
        })),
      })),
    };
  };

  const attachHandler = <K extends HandlerBackedName<A>>(
    type: K,
    handler: ActionHandler<K, ParamsOf<A, K>>,
  ): void => {
    if ((type as string) === 'inspect') {
      throw new SceneMindError('HANDLER_NOT_ALLOWED', 'The inspect action cannot have a handler.', {
        id: 'inspect',
      });
    }
    if (registry.get(type) === undefined) {
      throw new SceneMindError('UNKNOWN_ACTION', `Action "${String(type)}" is not registered.`, {
        id: String(type),
      });
    }
    if (typeof handler !== 'function') {
      throw new SceneMindError('INVALID_DEFINITION', 'Handler must be a function.');
    }
    handlers.set(type, handler as unknown as ActionHandler<string, unknown>);
  };

  /**
   * The only place execute changes state. Runs synchronously after the handler resolves,
   * so the handler always sees pre-request state.
   */
  const commitAfterHandler = (type: string, params: Record<string, unknown>): void => {
    if (type === 'navigate') {
      const sceneId = params['sceneId'];
      if (typeof sceneId === 'string') {
        state.currentSceneId = sceneId;
        state.focusedEntityId = null;
      }
    } else if (type === 'focus') {
      const entityId = params['entityId'];
      // State Invariant 5 re-check: the Entity must still belong to the Current_Scene.
      if (typeof entityId === 'string' && graph.entityScene.get(entityId) === state.currentSceneId) {
        state.focusedEntityId = entityId;
      }
    }
  };

  const fail = (
    code: Extract<ActionResult, { ok: false }>['error']['code'],
    message: string,
    type?: string,
    issues?: Issue[],
  ): ActionResult => {
    const error: Extract<ActionResult, { ok: false }>['error'] = { code, message };
    if (issues !== undefined) error.issues = issues;
    return type === undefined ? { ok: false, error } : { ok: false, type, error };
  };

  const execute = async (request: unknown): Promise<ActionResult> => {
    try {
      // Step 1: request shape. type and params are each read once.
      if (request === null || typeof request !== 'object' || Array.isArray(request)) {
        return fail('INVALID_REQUEST', 'Request must be an object.');
      }
      const hasParams = 'params' in request;
      const rawType: unknown = (request as { type?: unknown }).type;
      const rawParams: unknown = (request as { params?: unknown }).params;
      if (typeof rawType !== 'string' || !hasParams) {
        return fail('INVALID_REQUEST', 'Request must have a string "type" and a "params" field.');
      }
      const type: string = rawType;

      // Step 2: registered action.
      const action = registry.get(type);
      if (action === undefined) return fail('UNKNOWN_ACTION', 'Unknown action.', type);

      // Step 3: permitted in the Current_Scene.
      const scene = currentScene();
      if (scene.permittedActions !== undefined && !scene.permittedActions.includes(type)) {
        return fail('ACTION_UNAVAILABLE', 'Action is not available in the current scene.', type);
      }

      // Step 4: handler attached (inspect is answered by the runtime).
      if (type !== 'inspect' && !handlers.has(type)) {
        return fail('NO_HANDLER', 'No handler is attached for this action.', type);
      }

      // Step 5: parameters.
      let params: Record<string, unknown>;
      try {
        const parsed = action.params.safeParse(rawParams);
        if (!parsed.success) {
          return fail(
            'INVALID_PARAMETERS',
            'Action parameters are invalid.',
            type,
            parsed.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })),
          );
        }
        // A schema output that serialization would change must not reach a handler.
        if (!isJsonSafe(parsed.data)) throw new Error('not JSON-safe');
        const json: string | undefined = JSON.stringify(parsed.data);
        const copy: unknown = json === undefined ? undefined : JSON.parse(json);
        if (copy === null || typeof copy !== 'object' || Array.isArray(copy)) throw new Error('not an object');
        params = copy as Record<string, unknown>;
      } catch {
        return fail('INVALID_PARAMETERS', 'Action parameters are invalid.', type, [
          { path: '', message: 'Parameters could not be validated as JSON data.' },
        ]);
      }

      // Step 6: reference checks for built-ins.
      let entity: Readonly<Entity> | undefined;
      if (type === 'navigate') {
        const sceneId = params['sceneId'];
        if (typeof sceneId !== 'string' || !scene.reachableSceneIds.includes(sceneId)) {
          return fail('INVALID_SCENE_ID', 'Scene is not reachable from the current scene.', type);
        }
      } else if (type === 'focus' || type === 'highlight' || type === 'inspect') {
        const entityId = params['entityId'];
        entity = scene.entities.find((e) => e.id === entityId);
        if (typeof entityId !== 'string' || entity === undefined) {
          return fail('INVALID_ENTITY_ID', 'Entity is not in the current scene.', type);
        }
      }

      const okParams = params as Extract<ActionResult, { ok: true }>['params'];

      if (type === 'inspect' && entity !== undefined) {
        return {
          ok: true,
          type,
          params: okParams,
          data: { entity: JSON.parse(JSON.stringify(entity)) as Entity },
        };
      }

      // Step 7: call the handler once (state is still pre-request), then commit.
      // The handler gets its own copy so it cannot alter the params we commit and return.
      const handler = handlers.get(type);
      if (handler === undefined) return fail('NO_HANDLER', 'No handler is attached for this action.', type);
      const handlerParams = JSON.parse(JSON.stringify(params)) as unknown;
      try {
        await handler({ type, params: handlerParams });
      } catch (err) {
        return fail('HANDLER_FAILED', handlerFailureMessage(err), type);
      }
      commitAfterHandler(type, params);
      return { ok: true, type, params: okParams };
    } catch {
      return fail('INVALID_REQUEST', 'Request could not be processed.');
    }
  };

  const syncFocus = (input: unknown): FocusSyncResult => {
    try {
      const parsed = FocusSyncRequestSchema.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: 'INVALID_REQUEST', message: 'Focus must be a non-empty entity ID or null.' },
        };
      }
      const entityId = parsed.data;
      if (entityId === null) {
        state.focusedEntityId = null;
        return { ok: true, focusedEntityId: null };
      }
      if (graph.entityScene.get(entityId) !== state.currentSceneId) {
        return {
          ok: false,
          error: { code: 'INVALID_ENTITY_ID', message: 'Entity is not in the current scene.' },
        };
      }
      state.focusedEntityId = entityId;
      return { ok: true, focusedEntityId: entityId };
    } catch {
      return {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Focus request could not be processed.' },
      };
    }
  };

  return {
    getCurrentSceneId: (): SceneId => state.currentSceneId,
    getFocusedEntityId: (): EntityId | null => state.focusedEntityId,
    getContext,
    getAvailableActions,
    listActions,
    attachHandler,
    execute,
    syncFocus,
  };
}
