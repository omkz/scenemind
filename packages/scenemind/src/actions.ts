import { z } from 'zod';
import {
  EntityIdSchema,
  ParameterSummarySchema,
  SceneIdSchema,
  SceneMindError,
  type ParameterSummary,
} from './schemas.js';

export interface SceneAction<T extends string = string, S extends z.ZodObject = z.ZodObject> {
  readonly type: T;
  readonly description: string;
  readonly params: S;
  readonly parameterSummary: ParameterSummary;
}

export type ActionHandler<T extends string = string, P = unknown> = (action: {
  type: T;
  params: P;
}) => void | Promise<void>;

export interface ActionListEntry {
  type: string;
  description: string;
  parameters: ParameterSummary;
}

function copySummary(summary: ParameterSummary): ParameterSummary {
  return summary.map((p) => ({ name: p.name, type: p.type, description: p.description }));
}

export function defineAction<T extends string, S extends z.ZodObject>(def: {
  type: T;
  description: string;
  params: S;
  parameterSummary: ParameterSummary;
}): SceneAction<T, S> {
  const fail = (message: string, issues?: { path: string; message: string }[]): never => {
    throw new SceneMindError('INVALID_DEFINITION', message, issues ? { issues } : undefined);
  };
  if (typeof def !== 'object' || def === null) return fail('Action definition must be an object.');
  if (typeof def.type !== 'string' || def.type.length === 0) {
    return fail('Action type must be a non-empty string.');
  }
  if (typeof def.description !== 'string') return fail('Action description must be a string.');
  if (!(def.params instanceof z.ZodObject)) return fail('Action params must be a Zod object schema.');
  const parsed = ParameterSummarySchema.safeParse(def.parameterSummary);
  if (!parsed.success) {
    return fail(
      'Action parameterSummary is invalid.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const summary = copySummary(parsed.data).map((p) => Object.freeze(p));
  return Object.freeze({
    type: def.type,
    description: def.description,
    params: def.params,
    parameterSummary: Object.freeze(summary) as ParameterSummary,
  });
}

export class ActionRegistry {
  readonly #actions = new Map<string, SceneAction>();

  register(action: SceneAction): void {
    // Re-validate and copy, so an action that was not built by defineAction
    // cannot be edited by its author after registration.
    const safe = defineAction(action);
    if (this.#actions.has(safe.type)) {
      throw new SceneMindError('DUPLICATE_ACTION', `Action "${safe.type}" is already registered.`, {
        id: safe.type,
      });
    }
    this.#actions.set(safe.type, safe);
  }

  get(type: string): SceneAction | undefined {
    return this.#actions.get(type);
  }

  entries(): readonly SceneAction[] {
    return [...this.#actions.values()];
  }

  list(): ActionListEntry[] {
    return [...this.#actions.values()].map((a) => ({
      type: a.type,
      description: a.description,
      parameters: copySummary(a.parameterSummary),
    }));
  }
}

const entityIdParams = z.object({ entityId: EntityIdSchema });
const entityIdSummary: ParameterSummary = [
  { name: 'entityId', type: 'string', description: 'ID of an entity in the current scene.' },
];

export const focusAction: SceneAction<'focus', typeof entityIdParams> = defineAction({
  type: 'focus',
  description: 'Bring an entity in the current scene into focus.',
  params: entityIdParams,
  parameterSummary: entityIdSummary,
});

export const highlightAction: SceneAction<'highlight', typeof entityIdParams> = defineAction({
  type: 'highlight',
  description: 'Visually highlight an entity in the current scene.',
  params: entityIdParams,
  parameterSummary: entityIdSummary,
});

export const inspectAction: SceneAction<'inspect', typeof entityIdParams> = defineAction({
  type: 'inspect',
  description: 'Retrieve the details of an entity in the current scene.',
  params: entityIdParams,
  parameterSummary: entityIdSummary,
});

const navigateParams = z.object({ sceneId: SceneIdSchema });

export const navigateAction: SceneAction<'navigate', typeof navigateParams> = defineAction({
  type: 'navigate',
  description: 'Move to a scene reachable from the current scene.',
  params: navigateParams,
  parameterSummary: [
    { name: 'sceneId', type: 'string', description: 'ID of a scene reachable from the current scene.' },
  ],
});
