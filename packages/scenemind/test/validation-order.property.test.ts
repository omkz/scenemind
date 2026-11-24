import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import {
  createSpy,
  operationsArb,
  outcomeFails,
  requestArb,
  requestContextOf,
  worldArb,
  type Operation,
  type World,
} from './arbitraries.js';
import { applyExecute, createModel, expectedOutcome, modelAttach, modelSyncFocus } from './model.js';

// World, a sequence of operations that builds Runtime state, and a final request.
const scenarioArb = worldArb.chain((world: World) =>
  fc.tuple(
    fc.constant(world),
    operationsArb(world, { maxLength: 12 }),
    requestArb(requestContextOf(world)),
  ),
);

describe('validation order property', () => {
  // Feature: scenemind-core, Property 5: Validation order matches the oracle
  // **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10**
  it('Property 5: Validation order matches the oracle', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ([world, ops, finalRequest]) => {
        const runtime = createRuntime({
          scenes: world.definition,
          initialSceneId: world.initialSceneId,
          actions: world.actions,
        });
        const model = createModel(world.definition, world.initialSceneId, world.actions);

        const check = async (request: unknown): Promise<void> => {
          const expected = expectedOutcome(model, request);
          const result = await runtime.execute(request);
          if (expected === 'OK') {
            expect(result.ok).toBe(true);
          } else {
            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error.code).toBe(expected);
              if (expected === 'INVALID_PARAMETERS') {
                expect(result.error.issues?.length ?? 0).toBeGreaterThan(0);
              }
            }
          }
        };

        for (const op of ops as Operation[]) {
          if (op.kind === 'attach') {
            // Handlers that always succeed, so an OK outcome stays ok: true.
            const outcome = outcomeFails(op.outcome) ? { ...op.outcome, kind: 'return' as const } : op.outcome;
            (runtime.attachHandler as (t: string, h: unknown) => void)(op.type, createSpy(outcome).handler);
            modelAttach(model, op.type);
          } else if (op.kind === 'execute') {
            await check(op.request);
            // Mirror the state change of a successful request.
            applyExecute(model, op.request, false);
          } else {
            runtime.syncFocus(op.input);
            modelSyncFocus(model, op.input);
          }
        }
        await check(finalRequest);
      }),
      { numRuns: 200 },
    );
  });
});
