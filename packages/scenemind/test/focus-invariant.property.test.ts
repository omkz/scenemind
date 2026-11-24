import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { createSpy, operationsArb, worldArb, type World } from './arbitraries.js';

function checkInvariant(
  world: World,
  runtime: { getCurrentSceneId(): string; getFocusedEntityId(): string | null },
): void {
  const sceneId = runtime.getCurrentSceneId();
  const scene = world.definition.scenes.find((s) => s.id === sceneId);
  expect(scene).toBeDefined();
  const focused = runtime.getFocusedEntityId();
  if (focused !== null) {
    expect(scene!.entities.map((e) => e.id)).toContain(focused);
  }
}

describe('focus invariant', () => {
  // Feature: scenemind-core, Property 12: Focus invariant holds under any interleaving
  // **Validates: Requirements 10.2**
  it('Property 12: focus is null or an Entity of the current Scene under any interleaving', async () => {
    await fc.assert(
      fc.asyncProperty(
        worldArb.chain((world) =>
          fc.record({
            world: fc.constant(world),
            ops: operationsArb(world, { concurrent: true, maxLength: 25 }),
            // Microtask ticks yielded after each operation, so pending handlers settle mid-sequence.
            yields: fc.array(fc.nat({ max: 3 }), { minLength: 25, maxLength: 25 }),
          }),
        ),
        async ({ world, ops, yields }) => {
          const runtime = createRuntime({
            scenes: world.definition,
            initialSceneId: world.initialSceneId,
            actions: world.actions,
          });
          checkInvariant(world, runtime);

          const pending: Promise<unknown>[] = [];
          for (const [i, op] of ops.entries()) {
            if (op.kind === 'attach') {
              const spy = createSpy(op.outcome);
              (runtime.attachHandler as (t: string, h: unknown) => void)(op.type, spy.handler);
            } else if (op.kind === 'execute') {
              const p = runtime.execute(op.request);
              if (op.awaited) await p;
              else pending.push(p);
            } else {
              runtime.syncFocus(op.input);
            }
            checkInvariant(world, runtime);

            for (let t = 0; t < (yields[i] ?? 0); t += 1) {
              await Promise.resolve();
              checkInvariant(world, runtime);
            }
          }

          await Promise.all(pending);
          checkInvariant(world, runtime);
        },
      ),
      { numRuns: 200 },
    );
  });
});
