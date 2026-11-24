import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { highlightAction, focusAction, inspectAction, navigateAction } from '../src/actions.js';
import { createRuntime } from '../src/runtime.js';
import { createSpy, worldArb, type World } from './arbitraries.js';

interface Candidate {
  type: string;
  params: Record<string, unknown>;
}

/** Valid (type, params) pairs for handler-backed actions permitted in the initial scene. */
function candidatesOf(world: World): Candidate[] {
  const scene = world.definition.scenes.find((s) => s.id === world.initialSceneId);
  if (scene === undefined) return [];
  const out: Candidate[] = [];
  for (const e of scene.entities) {
    out.push({ type: 'focus', params: { entityId: e.id } });
    out.push({ type: 'highlight', params: { entityId: e.id } });
  }
  for (const id of scene.reachableSceneIds) out.push({ type: 'navigate', params: { sceneId: id } });
  const customInputs: Record<string, unknown>[] = [{}, { n: 3 }, { label: 'a' }, { label: 'a', count: 2 }];
  for (const action of world.actions) {
    for (const input of customInputs) {
      const parsed = action.params.safeParse(input);
      if (!parsed.success) continue;
      try {
        JSON.stringify(parsed.data); // skips outputs that are not JSON (bigint)
      } catch {
        continue;
      }
      out.push({ type: action.type, params: input });
    }
  }
  return out.filter(
    (c) => scene.permittedActions === undefined || scene.permittedActions.includes(c.type),
  );
}

const extraKeysArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 4 }).filter((k) => k !== '__proto__'),
  fc.jsonValue().map((v) => JSON.parse(JSON.stringify(v), (k, val) => (k === '__proto__' ? undefined : val)) as unknown),
  { maxKeys: 4 },
);

describe('Property 8', () => {
  it('calls the handler once with parsed params and returns them', async () => {
    // Feature: scenemind-core, Property 8: Valid handler-backed requests call the handler once with parsed params
    // **Validates: Requirements 4.4, 5.6, 5.7, 7.12, 8.1, 8.2**
    let exercised = 0;
    await fc.assert(
      fc.asyncProperty(worldArb, fc.nat(), extraKeysArb, async (world, pick, extras) => {
        const candidates = candidatesOf(world);
        fc.pre(candidates.length > 0);
        const { type, params: base } = candidates[pick % candidates.length] as Candidate;

        const runtime = createRuntime({
          scenes: world.definition,
          initialSceneId: world.initialSceneId,
          actions: world.actions,
        });
        const spy = createSpy({ kind: 'resolve', ticks: 1 });
        (runtime.attachHandler as (t: string, h: unknown) => void)(type, spy.handler);

        const builtIns = [focusAction, highlightAction, inspectAction, navigateAction];
        const schema = [...builtIns, ...world.actions].find((a) => a.type === type)!.params;

        // Known keys win over random extras of the same name.
        const params = { ...extras, ...base };
        const expected = schema.parse(params) as Record<string, unknown>;
        for (const key of Object.keys(extras)) {
          if (!(key in schema.shape)) expect(expected).not.toHaveProperty([key]);
        }

        const result = await runtime.execute({ type, params });

        expect(spy.calls).toHaveLength(1);
        expect(spy.calls[0]).toEqual({ type, params: expected });
        expect(result).toEqual({ ok: true, type, params: expected });
        exercised += 1;
      }),
      { numRuns: 200 },
    );
    expect(exercised).toBeGreaterThanOrEqual(100);
  });
});
