import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime, type Runtime } from '../src/runtime.js';
import { SceneContextSchema } from '../src/schemas.js';
import { createSpy, scenarioArb, type Operation } from './arbitraries.js';

type Container = Record<string, unknown> | unknown[];

interface Mutation {
  node: number;
  op: 'set' | 'delete' | 'clear';
  key: number;
  value: unknown;
}

const mutationArb: fc.Arbitrary<Mutation> = fc.record({
  node: fc.nat(),
  op: fc.constantFrom<Mutation['op']>('set', 'set', 'delete', 'clear'),
  key: fc.nat(),
  value: fc.oneof(fc.jsonValue(), fc.constant({ injected: [1, 2] })),
});

function collectContainers(value: unknown, out: Container[]): void {
  if (value !== null && typeof value === 'object') {
    out.push(value as Container);
    for (const child of Object.values(value)) collectContainers(child, out);
  }
}

/** Applies random in-place mutations anywhere in the object tree. */
function mutateDeep(root: unknown, mutations: Mutation[]): void {
  for (const m of mutations) {
    const nodes: Container[] = [];
    collectContainers(root, nodes);
    const target = nodes[m.node % nodes.length] as Container;
    const keys = Object.keys(target);
    const existing = keys.length > 0 ? (keys[m.key % keys.length] as string) : undefined;
    if (Array.isArray(target)) {
      if (m.op === 'clear') target.length = 0;
      else if (m.op === 'delete' && existing !== undefined) target.splice(Number(existing), 1);
      else if (existing !== undefined && m.key % 2 === 0) target[Number(existing)] = jsonClone(m.value);
      else target.push(jsonClone(m.value));
    } else {
      if (m.op === 'clear') for (const k of keys) delete target[k];
      else if (m.op === 'delete' && existing !== undefined) delete target[existing];
      else if (existing !== undefined && m.key % 2 === 0) {
        Object.defineProperty(target, existing, {
          value: jsonClone(m.value),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else target[`added${m.key}`] = jsonClone(m.value);
    }
  }
}

const jsonClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

async function apply(runtime: Runtime<any>, op: Operation): Promise<void> {
  const rt = runtime as unknown as {
    attachHandler(t: string, h: unknown): void;
  };
  if (op.kind === 'attach') {
    try {
      rt.attachHandler(op.type, createSpy(op.outcome).handler);
    } catch {
      // Invalid attach (e.g. unregistered) is part of the random sequence.
    }
  } else if (op.kind === 'execute') {
    await runtime.execute(op.request);
  } else {
    runtime.syncFocus(op.input);
  }
}

describe('SceneContext copy', () => {
  // Feature: scenemind-core, Property 3: SceneContext is a JSON-safe copy
  // **Validates: Requirements 3.8, 3.9**
  it('Property 3: SceneContext is a JSON-safe copy', async () => {
    await fc.assert(
      fc.asyncProperty(
        scenarioArb(),
        fc.array(mutationArb, { minLength: 1, maxLength: 12 }),
        async ({ world, ops }, mutations) => {
          const runtime = createRuntime({
            scenes: world.definition,
            initialSceneId: world.initialSceneId,
            actions: world.actions,
          });
          for (const op of ops) await apply(runtime, op);

          const ctx = runtime.getContext();
          expect(SceneContextSchema.parse(JSON.parse(JSON.stringify(ctx)))).toEqual(ctx);

          const snapshot = jsonClone(ctx);
          const sceneBefore = runtime.getCurrentSceneId();
          const focusBefore = runtime.getFocusedEntityId();
          const actionsBefore = runtime.getAvailableActions();

          mutateDeep(ctx, mutations);

          expect(runtime.getContext()).toEqual(snapshot);
          expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
          expect(runtime.getFocusedEntityId()).toBe(focusBefore);
          expect(runtime.getAvailableActions()).toEqual(actionsBefore);
        },
      ),
      { numRuns: 200 },
    );
  });
});
