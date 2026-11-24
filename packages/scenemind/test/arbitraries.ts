// fast-check generators for SceneMind core property tests.
import fc from 'fast-check';
import { z } from 'zod';
import { defineAction, type ActionHandler, type SceneAction } from '../src/actions.js';
import type { Entity, Scene, SceneGraphDefinition } from '../src/schemas.js';

// ---------------------------------------------------------------------------
// Valid graphs
// ---------------------------------------------------------------------------

const SCENE_POOL = ['s0', 's1', 's2', 's3', 's4', 's5', '__proto__', 'constructor'];
const ENTITY_POOL = [
  ...Array.from({ length: 28 }, (_, i) => `e${i}`),
  'toString',
  '__proto__',
];
const ACTION_NAMES = ['focus', 'highlight', 'inspect', 'navigate', 'zoom', 'pan', 'rotate', 'ghost'];

/** JSON values that survive a JSON round trip unchanged (no -0). */
const metadataArb: fc.Arbitrary<Record<string, unknown>> = fc
  .dictionary(fc.string({ maxLength: 3 }).filter((k) => k !== '__proto__'), fc.jsonValue(), {
    maxKeys: 4,
  })
  .map((m) => JSON.parse(JSON.stringify(m), (k, v) => (k === '__proto__' ? undefined : v)) as Record<string, unknown>);

function entityArb(id: string): fc.Arbitrary<Entity> {
  return fc
    .record({
      label: fc.constantFrom('Box', 'Lamp', 'Door', 'X'),
      description: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
      metadata: fc.option(metadataArb, { nil: undefined }),
    })
    .map(({ label, description, metadata }) => {
      const e: Record<string, unknown> = { id, label };
      if (description !== undefined) e.description = description;
      if (metadata !== undefined) e.metadata = metadata;
      return e as Entity;
    });
}

/** Absent, empty, or a mixed list (may name unregistered actions). */
const permittedActionsArb: fc.Arbitrary<string[] | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant([] as string[]),
  fc.subarray(ACTION_NAMES),
);

function sceneArb(id: string, sceneIds: string[], entityIds: string[]): fc.Arbitrary<Scene> {
  return fc
    .record({
      name: fc.constantFrom('Room A', 'Hall', 'Yard'),
      description: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
      entities: fc.tuple(...entityIds.map(entityArb)) as fc.Arbitrary<Entity[]>,
      reachableSceneIds: fc.subarray(sceneIds),
      permittedActions: permittedActionsArb,
    })
    .map(({ name, description, entities, reachableSceneIds, permittedActions }) => {
      const s: Record<string, unknown> = { id, name };
      if (description !== undefined) s.description = description;
      s.entities = entities;
      s.reachableSceneIds = reachableSceneIds;
      if (permittedActions !== undefined) s.permittedActions = permittedActions;
      return s as Scene;
    });
}

export interface GraphInput {
  definition: SceneGraphDefinition;
  initialSceneId: string;
}

/** 1-6 Scenes, 0-5 Entities each, Entity_IDs unique across the whole graph. */
export const graphArb: fc.Arbitrary<GraphInput> = fc
  .uniqueArray(fc.constantFrom(...SCENE_POOL), { minLength: 1, maxLength: 6 })
  .chain((sceneIds) =>
    fc
      .array(fc.nat({ max: 5 }), { minLength: sceneIds.length, maxLength: sceneIds.length })
      .chain((counts) => {
        const total = counts.reduce((a, b) => a + b, 0);
        return fc
          .shuffledSubarray(ENTITY_POOL, { minLength: total, maxLength: total })
          .chain((entityIds) => {
            let offset = 0;
            const scenes = sceneIds.map((id, i) => {
              const ids = entityIds.slice(offset, offset + (counts[i] as number));
              offset += counts[i] as number;
              return sceneArb(id, sceneIds, ids);
            });
            return fc.tuple(fc.tuple(...scenes), fc.constantFrom(...sceneIds));
          });
      }),
  )
  .map(([scenes, initialSceneId]) => ({
    definition: { scenes: scenes as Scene[] },
    initialSceneId,
  }));

// ---------------------------------------------------------------------------
// Custom actions (0-3, unique names, none colliding with built-ins)
// ---------------------------------------------------------------------------

const PARAM_VARIANTS: readonly { schema: z.ZodObject; summary: { name: string; type: string; description: string }[] }[] = [
  { schema: z.object({}), summary: [] },
  {
    schema: z.object({ n: z.number() }),
    summary: [{ name: 'n', type: 'number', description: 'A number.' }],
  },
  {
    schema: z.object({ label: z.string().optional(), count: z.number().int().default(1) }),
    summary: [
      { name: 'label', type: 'string', description: 'Optional label.' },
      { name: 'count', type: 'number', description: 'Defaults to 1.' },
    ],
  },
  // Parses fine but produces a bigint, which is not JSON (pipeline step 5).
  {
    schema: z.object({ n: z.number().transform((v) => BigInt(Math.trunc(v))) }),
    summary: [{ name: 'n', type: 'number', description: 'Becomes a bigint.' }],
  },
];

const CUSTOM_NAMES = ['zoom', 'pan', 'rotate'];

export const customActionsArb: fc.Arbitrary<SceneAction[]> = fc
  .uniqueArray(fc.constantFrom(...CUSTOM_NAMES), { minLength: 0, maxLength: 3 })
  .chain((names) =>
    fc.tuple(
      ...names.map((name) =>
        fc.tuple(fc.constantFrom(...PARAM_VARIANTS), fc.string({ maxLength: 10 })).map(([v, description]) =>
          defineAction({
            type: name,
            description,
            params: v.schema,
            parameterSummary: v.summary.map((p) => ({ ...p })),
          }),
        ),
      ),
    ),
  ) as fc.Arbitrary<SceneAction[]>;

export interface World extends GraphInput {
  actions: SceneAction[];
}

export const worldArb: fc.Arbitrary<World> = fc
  .tuple(graphArb, customActionsArb)
  .map(([g, actions]) => ({ ...g, actions }));

// ---------------------------------------------------------------------------
// Single-mutation invalid definitions
// ---------------------------------------------------------------------------

export type MutationKind =
  | 'duplicate-scene'
  | 'duplicate-entity'
  | 'undefined-reachable'
  | 'undefined-initial'
  | 'schema-invalid';

export interface InvalidDefinition {
  kind: MutationKind;
  /** Deliberately typed loosely: it may violate the schema. */
  definition: unknown;
  initialSceneId: unknown;
  code: 'INVALID_DEFINITION' | 'DUPLICATE_SCENE_ID' | 'DUPLICATE_ENTITY_ID' | 'UNKNOWN_SCENE_ID';
  /** Offending ID, absent for schema failures. */
  id?: string;
}

const SCHEMA_BREAKS = [
  'scene-name-empty',
  'scene-id-number',
  'entities-not-array',
  'reachable-empty-string',
  'entity-label-empty',
  'metadata-function',
  'metadata-bigint',
  'scenes-not-array',
  'initial-not-string',
  'permitted-not-array',
] as const;

export const invalidDefinitionArb: fc.Arbitrary<InvalidDefinition> = fc
  .tuple(
    graphArb,
    fc.constantFrom<MutationKind>(
      'duplicate-scene',
      'duplicate-entity',
      'undefined-reachable',
      'undefined-initial',
      'schema-invalid',
    ),
    fc.nat(),
    fc.constantFrom(...SCHEMA_BREAKS),
  )
  .map(([graph, kind, pick, brk]): InvalidDefinition => {
    const def = JSON.parse(JSON.stringify(graph.definition)) as { scenes: Record<string, any>[] };
    const scenes = def.scenes;
    const target = scenes[pick % scenes.length] as Record<string, any>;
    let initialSceneId: unknown = graph.initialSceneId;
    switch (kind) {
      case 'duplicate-scene': {
        // The copy has no entities, so no other rule fires first.
        scenes.push({ ...target, entities: [], reachableSceneIds: [] });
        return { kind, definition: def, initialSceneId, code: 'DUPLICATE_SCENE_ID', id: target.id };
      }
      case 'duplicate-entity': {
        const all = scenes.flatMap((s) => s.entities as { id: string }[]);
        let id: string;
        if (all.length === 0) {
          id = 'dup';
          target.entities.push({ id, label: 'A' }, { id, label: 'B' });
        } else {
          id = (all[pick % all.length] as { id: string }).id;
          target.entities.push({ id, label: 'Copy' });
        }
        return { kind, definition: def, initialSceneId, code: 'DUPLICATE_ENTITY_ID', id };
      }
      case 'undefined-reachable': {
        target.reachableSceneIds.push('missing-scene');
        return { kind, definition: def, initialSceneId, code: 'UNKNOWN_SCENE_ID', id: 'missing-scene' };
      }
      case 'undefined-initial': {
        initialSceneId = 'missing-initial';
        return { kind, definition: def, initialSceneId, code: 'UNKNOWN_SCENE_ID', id: 'missing-initial' };
      }
      case 'schema-invalid': {
        let definition: unknown = def;
        switch (brk) {
          case 'scene-name-empty':
            target.name = '';
            break;
          case 'scene-id-number':
            target.id = 7;
            break;
          case 'entities-not-array':
            target.entities = 'nope';
            break;
          case 'reachable-empty-string':
            target.reachableSceneIds.push('');
            break;
          case 'entity-label-empty':
            target.entities.push({ id: 'bad-label', label: '' });
            break;
          case 'metadata-function':
            target.entities.push({ id: 'bad-meta', label: 'M', metadata: { f: () => 1 } });
            break;
          case 'metadata-bigint':
            target.entities.push({ id: 'bad-meta', label: 'M', metadata: { b: 1n } });
            break;
          case 'scenes-not-array':
            definition = { scenes: 'nope' };
            break;
          case 'initial-not-string':
            initialSceneId = 42;
            break;
          case 'permitted-not-array':
            target.permittedActions = 'focus';
            break;
        }
        return { kind, definition, initialSceneId, code: 'INVALID_DEFINITION' };
      }
    }
  });

// ---------------------------------------------------------------------------
// Hostile values
// ---------------------------------------------------------------------------

const boom = (): never => {
  throw new Error('hostile');
};

// Traps ignore symbol keys so fast-check can probe its own clone symbol on generated values.
const throwingProxy = (target: object): object =>
  new Proxy(target, {
    get: (t, key, receiver) => (typeof key === 'symbol' ? Reflect.get(t, key, receiver) : boom()),
    has: (t, key) => (typeof key === 'symbol' ? Reflect.has(t, key) : boom()),
    ownKeys: boom,
    getOwnPropertyDescriptor: boom,
    getPrototypeOf: boom,
  });

const HOSTILE_FACTORIES: readonly (() => unknown)[] = [
  () => ({
    get type(): string {
      return boom();
    },
    params: {},
  }),
  () => ({
    type: 'focus',
    get params(): unknown {
      return boom();
    },
  }),
  () => ({
    type: 'focus',
    params: {
      get entityId(): unknown {
        return boom();
      },
    },
  }),
  () => ({
    type: 'navigate',
    params: {
      get sceneId(): unknown {
        return boom();
      },
    },
  }),
  () => throwingProxy({}),
  () => throwingProxy([]),
  () => throwingProxy({ type: 'focus', params: {} }),
  () => ({ type: 'focus', params: throwingProxy({}) }),
  () => ({ type: 'inspect', params: throwingProxy({ entityId: 'e0' }) }),
  () => ({ type: 'zoom', params: { get n(): unknown { return boom(); } } }),
];

/** Fresh hostile object per generated value (they are mutable and stateful in no way). */
export const hostileValueArb: fc.Arbitrary<unknown> = fc
  .constantFrom(...HOSTILE_FACTORIES)
  .map((make) => make());

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface RequestContext {
  sceneIds: string[];
  entityIds: string[];
  actionTypes: string[];
}

export function requestContextOf(world: World): RequestContext {
  return {
    sceneIds: world.definition.scenes.map((s) => s.id),
    entityIds: world.definition.scenes.flatMap((s) => s.entities.map((e) => e.id)),
    actionTypes: ['focus', 'highlight', 'inspect', 'navigate', ...world.actions.map((a) => a.type)],
  };
}

const UNREGISTERED = ['nope', '__proto__', 'toString', 'constructor', '', 'hasOwnProperty'];

/** Mostly known IDs, sometimes unknown, empty, or the wrong type. */
function idArb(known: string[], unknownId: string): fc.Arbitrary<unknown> {
  const options: { weight: number; arbitrary: fc.Arbitrary<unknown> }[] = [
    { weight: 2, arbitrary: fc.constant(unknownId) },
    { weight: 1, arbitrary: fc.constantFrom('', 1, null, undefined, {}, ['x']) },
  ];
  if (known.length > 0) options.unshift({ weight: 6, arbitrary: fc.constantFrom(...known) });
  return fc.oneof(...options);
}

const extraKeysArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  { weight: 3, arbitrary: fc.constant({}) },
  { weight: 1, arbitrary: fc.constant({ extra: 1, junk: 'x' }) },
);

function paramsArb(type: string, ctx: RequestContext): fc.Arbitrary<unknown> {
  const bad = fc.constantFrom<unknown>(null, 'x', 1, [], undefined, true);
  let good: fc.Arbitrary<unknown>;
  if (type === 'navigate') {
    good = fc.tuple(idArb(ctx.sceneIds, 'no-scene'), extraKeysArb).map(([sceneId, x]) => ({ sceneId, ...x }));
  } else if (type === 'focus' || type === 'highlight' || type === 'inspect') {
    good = fc.tuple(idArb(ctx.entityIds, 'no-entity'), extraKeysArb).map(([entityId, x]) => ({ entityId, ...x }));
  } else {
    good = fc.oneof(
      fc.constant({}),
      fc.integer().map((n) => ({ n })),
      fc.constant({ n: 'x' }),
      fc.constant({ label: 'a', count: 2 }),
      fc.constant({ label: 5 }),
      fc.constant({ extra: 1 }),
    );
  }
  return fc.oneof({ weight: 9, arbitrary: good }, { weight: 1, arbitrary: bad });
}

/**
 * Requests biased to reach every pipeline step: well-formed requests for registered
 * actions with known/unknown IDs, unregistered names, and malformed shapes.
 */
export function requestArb(ctx: RequestContext): fc.Arbitrary<unknown> {
  const typeArb = fc.oneof(
    { weight: 8, arbitrary: fc.constantFrom(...ctx.actionTypes) },
    { weight: 1, arbitrary: fc.constantFrom(...UNREGISTERED) },
  );
  const wellFormed = typeArb.chain((type) => paramsArb(type, ctx).map((params) => ({ type, params })));
  return fc.oneof(
    { weight: 14, arbitrary: wellFormed },
    {
      weight: 1,
      arbitrary: typeArb.map((type) => ({ type })), // params key missing
    },
    {
      weight: 1,
      arbitrary: fc.constantFrom<unknown>(
        null,
        undefined,
        'focus',
        42,
        [],
        [{ type: 'focus', params: {} }],
        { params: {} },
        { type: 1, params: {} },
        { type: null, params: {} },
        {},
      ),
    },
    { weight: 1, arbitrary: hostileValueArb },
    { weight: 1, arbitrary: fc.anything() },
  );
}

/** Inputs for `syncFocus`: null, known and unknown IDs, empty string, non-strings, hostile values. */
export function syncFocusInputArb(ctx: RequestContext): fc.Arbitrary<unknown> {
  const options: { weight: number; arbitrary: fc.Arbitrary<unknown> }[] = [
    { weight: 2, arbitrary: fc.constant(null) },
    { weight: 1, arbitrary: fc.constant('') },
    { weight: 2, arbitrary: fc.constantFrom('no-entity', 'toString') },
    { weight: 1, arbitrary: fc.constantFrom<unknown>(1, undefined, {}, [], true, ['e0']) },
    { weight: 1, arbitrary: hostileValueArb },
    { weight: 1, arbitrary: fc.anything() },
  ];
  if (ctx.entityIds.length > 0) {
    options.unshift({ weight: 6, arbitrary: fc.constantFrom(...ctx.entityIds) });
  }
  return fc.oneof(...options);
}

// ---------------------------------------------------------------------------
// Spy handlers and operation sequences
// ---------------------------------------------------------------------------

export type HandlerOutcomeKind =
  | 'return' // synchronous return
  | 'resolve' // async, resolves after `ticks` microtasks
  | 'throwError'
  | 'throwNonError'
  | 'throwHostile' // throws an object whose `message` getter throws
  | 'reject' // rejects with an Error after `ticks`
  | 'rejectNonError';

export interface HandlerOutcome {
  kind: HandlerOutcomeKind;
  /** Microtask ticks before an async outcome settles. Differing ticks reorder concurrent calls. */
  ticks: number;
}

export const handlerOutcomeArb: fc.Arbitrary<HandlerOutcome> = fc.record({
  kind: fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom<HandlerOutcomeKind>('return', 'resolve') },
    {
      weight: 3,
      arbitrary: fc.constantFrom<HandlerOutcomeKind>(
        'throwError',
        'throwNonError',
        'throwHostile',
        'reject',
        'rejectNonError',
      ),
    },
  ),
  ticks: fc.nat({ max: 4 }),
});

export function outcomeFails(outcome: HandlerOutcome): boolean {
  return outcome.kind !== 'return' && outcome.kind !== 'resolve';
}

export interface SpyHandler {
  handler: ActionHandler;
  calls: { type: string; params: unknown }[];
}

async function waitTicks(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
}

/** Spy handler with a fixed outcome. `onCall` runs first, e.g. to snapshot Runtime state. */
export function createSpy(
  outcome: HandlerOutcome,
  onCall?: (action: { type: string; params: unknown }) => void,
): SpyHandler {
  const calls: SpyHandler['calls'] = [];
  const handler: ActionHandler = (action) => {
    calls.push(action);
    onCall?.(action);
    switch (outcome.kind) {
      case 'return':
        return;
      case 'resolve':
        return waitTicks(outcome.ticks);
      case 'throwError':
        throw new Error('handler boom');
      case 'throwNonError':
        throw 'handler boom';
      case 'throwHostile':
        throw {
          get message(): string {
            return boom();
          },
        };
      case 'reject':
        return waitTicks(outcome.ticks).then(() => Promise.reject(new Error('handler boom')));
      case 'rejectNonError':
        return waitTicks(outcome.ticks).then(() => Promise.reject(42));
    }
  };
  return { handler, calls };
}

export type Operation =
  | { kind: 'attach'; type: string; outcome: HandlerOutcome }
  | { kind: 'execute'; request: unknown; awaited: boolean }
  | { kind: 'syncFocus'; input: unknown };

export interface SequenceOptions {
  maxLength?: number;
  /** When true, `execute` operations may be left un-awaited. Default false (all awaited). */
  concurrent?: boolean;
}

/** Random interleaving of attachHandler, execute (valid and invalid) and syncFocus. */
export function operationsArb(world: World, options: SequenceOptions = {}): fc.Arbitrary<Operation[]> {
  const { maxLength = 20, concurrent = false } = options;
  const ctx = requestContextOf(world);
  const handlerBacked = ctx.actionTypes.filter((t) => t !== 'inspect');
  const awaitedArb = concurrent ? fc.boolean() : fc.constant(true);
  const op: fc.Arbitrary<Operation> = fc.oneof(
    {
      weight: 3,
      arbitrary: fc
        .tuple(fc.constantFrom(...handlerBacked), handlerOutcomeArb)
        .map(([type, outcome]): Operation => ({ kind: 'attach', type, outcome })),
    },
    {
      weight: 8,
      arbitrary: fc
        .tuple(requestArb(ctx), awaitedArb)
        .map(([request, awaited]): Operation => ({ kind: 'execute', request, awaited })),
    },
    {
      weight: 3,
      arbitrary: syncFocusInputArb(ctx).map((input): Operation => ({ kind: 'syncFocus', input })),
    },
  );
  return fc.array(op, { minLength: 0, maxLength });
}

/** A world together with an operation sequence over it. */
export function scenarioArb(options: SequenceOptions = {}): fc.Arbitrary<{ world: World; ops: Operation[] }> {
  return worldArb.chain((world) => operationsArb(world, options).map((ops) => ({ world, ops })));
}
