import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ActionRegistry, defineAction } from '../src/actions.js';
import { createRuntime } from '../src/runtime.js';
import { SceneMindError } from '../src/schemas.js';

const HOSTILE = ['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'valueOf'];
const BUILT_INS = ['focus', 'highlight', 'inspect', 'navigate'];

// Small alphabet so repeated names are likely; hostile names are included.
const nameArb = fc.oneof(
  fc.constantFrom(...HOSTILE),
  fc.constantFrom('a', 'b', 'c', 'd', 'e'),
  fc.string({ minLength: 1, maxLength: 3 }),
);

const defArb = fc.record({
  type: nameArb,
  description: fc.string(),
  parameterSummary: fc.array(
    fc.record({ name: fc.string(), type: fc.string(), description: fc.string() }),
    { maxLength: 3 },
  ),
});

const make = (d: { type: string; description: string; parameterSummary: any[] }) =>
  defineAction({ ...d, params: z.object({}) });

const baseScenes = {
  scenes: [{ id: 's', name: 'S', entities: [], reachableSceneIds: [] }],
};

describe('registry property', () => {
  // Feature: scenemind-core, Property 4: Registry names are unique and checked
  // **Validates: Requirements 4.1, 4.2, 4.5, 4.7**
  it('Property 4: Registry names are unique and checked', () => {
    fc.assert(
      fc.property(
        fc.array(defArb, { maxLength: 12 }),
        fc.oneof(fc.constantFrom(...HOSTILE), fc.string()),
        (defs, candidate) => {
          const registry = new ActionRegistry();
          const firsts = new Map<string, (typeof defs)[number]>();
          for (const d of defs) {
            const action = make(d);
            if (firsts.has(d.type)) {
              let err: unknown;
              try {
                registry.register(action);
              } catch (e) {
                err = e;
              }
              expect(err).toBeInstanceOf(SceneMindError);
              expect((err as SceneMindError).code).toBe('DUPLICATE_ACTION');
              expect((err as SceneMindError).id).toBe(d.type);
            } else {
              registry.register(action);
              firsts.set(d.type, d);
            }
          }
          expect(registry.list()).toEqual(
            [...firsts.values()].map((d) => ({
              type: d.type,
              description: d.description,
              parameters: d.parameterSummary,
            })),
          );

          // attachHandler on a Runtime whose custom actions are the unique definitions.
          const custom = [...firsts.values()]
            .filter((d) => !BUILT_INS.includes(d.type))
            .map(make);
          const runtime = createRuntime({
            scenes: baseScenes,
            initialSceneId: 's',
            actions: custom,
          });
          const registered = new Set([...BUILT_INS, ...custom.map((a) => a.type)]);
          const unregistered = [...HOSTILE, candidate].filter((n) => !registered.has(n));
          for (const name of unregistered) {
            const before = runtime.getAvailableActions();
            const beforeList = runtime.listActions();
            let err: unknown;
            try {
              (runtime as any).attachHandler(name, () => {});
            } catch (e) {
              err = e;
            }
            expect(err).toBeInstanceOf(SceneMindError);
            expect((err as SceneMindError).code).toBe('UNKNOWN_ACTION');
            expect((err as SceneMindError).id).toBe(name);
            expect(runtime.getAvailableActions()).toEqual(before);
            expect(runtime.listActions()).toEqual(beforeList);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
