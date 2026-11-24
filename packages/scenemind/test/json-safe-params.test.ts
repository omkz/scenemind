import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRuntime, defineAction } from '../src/index.js';

const scenes = {
  scenes: [{ id: 'a', name: 'A', entities: [{ id: 'e1', label: 'E1' }], reachableSceneIds: [] }],
};

class Point {
  constructor(public x: number) {}
}

/** One action per non-JSON-safe output a custom schema can produce. */
const unsafeOutputs: Record<string, () => unknown> = {
  date: () => new Date(0),
  nan: () => Number.NaN,
  infinity: () => Number.POSITIVE_INFINITY,
  map: () => new Map([['k', 1]]),
  set: () => new Set([1]),
  classInstance: () => new Point(1),
  undefinedInArray: () => [1, undefined, 3],
  sparseArray: () => [1, , 3], // eslint-disable-line no-sparse-arrays
  nestedDate: () => ({ when: new Date(0) }),
  fn: () => (): number => 1,
  symbol: () => Symbol('s'),
};

function setup() {
  const calls: unknown[] = [];
  const actions = Object.entries(unsafeOutputs).map(([name, make]) =>
    defineAction({
      type: `unsafe_${name}`,
      description: name,
      params: z.object({ v: z.string().transform(() => make() as never) }),
      parameterSummary: [{ name: 'v', type: 'string', description: 'v' }],
    }),
  );
  const ok = defineAction({
    type: 'safe',
    description: 'Safe.',
    params: z.object({
      n: z.string().transform((s) => Number(s)),
      tags: z.array(z.string()).default([]),
      note: z.string().optional(),
      nested: z.object({ flag: z.boolean() }).optional(),
      nothing: z.null().optional(),
    }),
    parameterSummary: [{ name: 'n', type: 'string', description: 'n' }],
  });
  const runtime = createRuntime({ scenes, initialSceneId: 'a', actions: [...actions, ok] });
  for (const type of [...actions.map((a) => a.type), 'safe']) {
    (runtime.attachHandler as (t: string, h: (a: unknown) => void) => void)(type, (a) =>
      calls.push(a),
    );
  }
  return { runtime, calls };
}

describe('custom action params must survive JSON serialization unchanged', () => {
  for (const name of Object.keys(unsafeOutputs)) {
    it(`rejects a schema output containing ${name}`, async () => {
      const { runtime, calls } = setup();
      const result = await runtime.execute({ type: `unsafe_${name}`, params: { v: 'x' } });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_PARAMETERS');
        expect(result.error.issues?.length).toBeGreaterThan(0);
      }
      expect(calls).toEqual([]);
      expect(runtime.getCurrentSceneId()).toBe('a');
      expect(runtime.getFocusedEntityId()).toBeNull();
    });
  }

  it('hands the handler exactly the transformed output when it is JSON-safe', async () => {
    const { runtime, calls } = setup();
    const result = await runtime.execute({
      type: 'safe',
      params: { n: '42', nested: { flag: true }, nothing: null },
    });
    const expected = { n: 42, tags: [], nested: { flag: true }, nothing: null };
    expect(result).toEqual({ ok: true, type: 'safe', params: expected });
    expect(calls).toEqual([{ type: 'safe', params: expected }]);
  });
});
