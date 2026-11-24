import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ActionResultSchema } from '../src/schemas.js';
import { createRuntime } from '../src/runtime.js';
import {
  createSpy,
  hostileValueArb,
  requestArb,
  requestContextOf,
  worldArb,
  type World,
} from './arbitraries.js';

// Feature: scenemind-core, Property 7: execute is total and its results round-trip
// Validates: Requirements 7.1, 7.13, 7.14, 8.5, 8.6

function buildRuntime(world: World) {
  const runtime = createRuntime({
    scenes: world.definition,
    initialSceneId: world.initialSceneId,
    actions: world.actions,
  });
  // Attach succeeding handlers so valid requests reach the later pipeline steps.
  const ctx = requestContextOf(world);
  for (const type of ctx.actionTypes) {
    if (type === 'inspect') continue;
    const spy = createSpy({ kind: 'resolve', ticks: 1 });
    (runtime.attachHandler as (t: string, h: unknown) => void)(type, spy.handler);
  }
  return { runtime, ctx };
}

const throwingGetter = (): never => {
  throw new Error('hostile nested');
};

/** A request whose params contain a throwing getter, optionally wrapping an arbitrary value. */
function nestedHostileArb(types: string[]): fc.Arbitrary<unknown> {
  return fc.tuple(fc.constantFrom(...types), fc.anything(), fc.constantFrom('entityId', 'sceneId', 'n', 'x')).map(
    ([type, extra, key]) => {
      const inner: Record<string, unknown> = { inner: extra };
      Object.defineProperty(inner, key, { get: throwingGetter, enumerable: true });
      // Hostile getter both directly in params and nested one level down.
      const params: Record<string, unknown> = { nested: inner };
      Object.defineProperty(params, key, { get: throwingGetter, enumerable: true });
      return { type, params };
    },
  );
}

const anythingRequestArb = (types: string[]): fc.Arbitrary<unknown> =>
  fc.oneof(
    fc.anything(),
    fc.tuple(fc.constantFrom(...types), fc.anything()).map(([type, params]) => ({ type, params })),
    fc.tuple(fc.constantFrom(...types), fc.object()).map(([type, params]) => ({ type, params })),
  );

describe('Property 7: execute is total and its results round-trip', () => {
  it('resolves and returns a JSON round-trip-stable ActionResult for any input', async () => {
    await fc.assert(
      fc.asyncProperty(
        worldArb.chain((world) => {
          const ctx = requestContextOf(world);
          return fc
            .oneof(
              { weight: 3, arbitrary: anythingRequestArb(ctx.actionTypes) },
              { weight: 3, arbitrary: hostileValueArb },
              { weight: 2, arbitrary: nestedHostileArb(ctx.actionTypes) },
              { weight: 3, arbitrary: requestArb(ctx) },
            )
            .map((request) => ({ world, request }));
        }),
        async ({ world, request }) => {
          const { runtime } = buildRuntime(world);
          const result = await runtime.execute(request); // must not reject
          const roundTrip = ActionResultSchema.parse(JSON.parse(JSON.stringify(result)));
          expect(roundTrip).toEqual(result);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('resolves for hostile values with no handlers attached', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, hostileValueArb, async (world, request) => {
        const runtime = createRuntime({
          scenes: world.definition,
          initialSceneId: world.initialSceneId,
          actions: world.actions,
        });
        const result = await runtime.execute(request);
        expect(ActionResultSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
      }),
      { numRuns: 100 },
    );
  });
});
