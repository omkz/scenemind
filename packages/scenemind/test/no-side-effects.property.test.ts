import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import {
  createSpy,
  handlerOutcomeArb,
  requestArb,
  requestContextOf,
  syncFocusInputArb,
  worldArb,
  type SpyHandler,
} from './arbitraries.js';

describe('no side effects on failed requests', () => {
  // Feature: scenemind-core, Property 6: Failed requests have no side effects
  // **Validates: Requirements 7.2, 7.11**
  it('Property 6: a request failing with a code other than HANDLER_FAILED calls no handler and changes no state', async () => {
    let failures = 0;
    await fc.assert(
      fc.asyncProperty(
        worldArb.chain((world) => {
          const ctx = requestContextOf(world);
          const handlerBacked = ctx.actionTypes.filter((t) => t !== 'inspect');
          return fc.record({
            world: fc.constant(world),
            attached: fc.subarray(handlerBacked),
            outcomes: fc.array(handlerOutcomeArb, { minLength: 8, maxLength: 8 }),
            // Pre-state: optionally navigate to a reachable scene, then sync focus.
            navigateFirst: fc.boolean(),
            focusInput: syncFocusInputArb(ctx),
            request: requestArb(ctx),
          });
        }),
        async ({ world, attached, outcomes, navigateFirst, focusInput, request }) => {
          const runtime = createRuntime({
            scenes: world.definition,
            initialSceneId: world.initialSceneId,
            actions: world.actions,
          });
          const spies: SpyHandler[] = [];
          attached.forEach((type, i) => {
            // Setup handlers succeed so the pre-state can be built; failing ones are exercised below.
            const spy = createSpy({ kind: 'return', ticks: outcomes[i % outcomes.length]!.ticks });
            spies.push(spy);
            (runtime.attachHandler as (t: string, h: unknown) => void)(type, spy.handler);
          });

          if (navigateFirst) {
            const target = world.definition.scenes.find((s) => s.id === runtime.getCurrentSceneId())
              ?.reachableSceneIds[0];
            if (target !== undefined) {
              await runtime.execute({ type: 'navigate', params: { sceneId: target } });
            }
          }
          runtime.syncFocus(focusInput);

          const callsBefore = spies.map((s) => s.calls.length);
          const sceneBefore = runtime.getCurrentSceneId();
          const focusBefore = runtime.getFocusedEntityId();
          const contextBefore = structuredClone(runtime.getContext());

          const result = await runtime.execute(request);

          if (!result.ok && result.error.code !== 'HANDLER_FAILED') {
            failures += 1;
            expect(spies.map((s) => s.calls.length)).toEqual(callsBefore);
            expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
            expect(runtime.getFocusedEntityId()).toBe(focusBefore);
            expect(runtime.getContext()).toEqual(contextBefore);
          }
        },
      ),
      { numRuns: 200 },
    );
    expect(failures).toBeGreaterThan(0);
  });
});
