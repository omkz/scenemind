import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { FocusSyncResultSchema } from '../src/schemas.js';
import {
  createSpy,
  hostileValueArb,
  requestContextOf,
  syncFocusInputArb,
  worldArb,
  type SpyHandler,
} from './arbitraries.js';

describe('syncFocus rule', () => {
  // Feature: scenemind-core, Property 11: syncFocus follows its rule
  // **Validates: Requirements 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13**
  it('Property 11: syncFocus follows its rule', async () => {
    const seen = { null: 0, current: 0, otherScene: 0, unknown: 0, invalidRequest: 0 };
    await fc.assert(
      fc.asyncProperty(
        worldArb.chain((world) => {
          const ctx = requestContextOf(world);
          return fc.record({
            world: fc.constant(world),
            navigateFirst: fc.boolean(),
            preFocus: syncFocusInputArb(ctx),
            inputs: fc.array(
              fc.oneof(
                { weight: 8, arbitrary: syncFocusInputArb(ctx) },
                { weight: 1, arbitrary: fc.anything() },
                { weight: 1, arbitrary: hostileValueArb },
              ),
              { minLength: 1, maxLength: 6 },
            ),
          });
        }),
        async ({ world, navigateFirst, preFocus, inputs }) => {
          const runtime = createRuntime({
            scenes: world.definition,
            initialSceneId: world.initialSceneId,
            actions: world.actions,
          });
          const spies: SpyHandler[] = [];
          const ctx = requestContextOf(world);
          for (const type of ctx.actionTypes.filter((t) => t !== 'inspect')) {
            const spy = createSpy({ kind: 'return', ticks: 0 });
            spies.push(spy);
            (runtime.attachHandler as (t: string, h: unknown) => void)(type, spy.handler);
          }

          if (navigateFirst) {
            const here = world.definition.scenes.find((s) => s.id === runtime.getCurrentSceneId());
            const target = here?.reachableSceneIds[0];
            if (target !== undefined) {
              await runtime.execute({ type: 'navigate', params: { sceneId: target } });
            }
          }
          runtime.syncFocus(preFocus);
          const callsBefore = spies.map((s) => s.calls.length); // handlers ran only for navigate

          for (const input of inputs) {
            const sceneBefore = runtime.getCurrentSceneId();
            const focusBefore = runtime.getFocusedEntityId();
            const contextBefore = structuredClone({ ...runtime.getContext(), focusedEntityId: null });
            const actionsBefore = runtime.listActions();
            const currentScene = world.definition.scenes.find((s) => s.id === sceneBefore)!;
            const currentIds = new Set(currentScene.entities.map((e) => e.id));
            const allIds = new Set(ctx.entityIds);

            let result: unknown;
            expect(() => {
              result = runtime.syncFocus(input);
            }).not.toThrow();
            const parsed = FocusSyncResultSchema.safeParse(result);
            expect(parsed.success).toBe(true);
            const r = parsed.data!;

            if (input === null) {
              seen.null += 1;
              expect(r).toEqual({ ok: true, focusedEntityId: null });
              expect(runtime.getFocusedEntityId()).toBeNull();
            } else if (typeof input === 'string' && currentIds.has(input)) {
              seen.current += 1;
              expect(r).toEqual({ ok: true, focusedEntityId: input });
              expect(runtime.getFocusedEntityId()).toBe(input);
            } else {
              if (typeof input === 'string' && input !== '') {
                if (allIds.has(input)) seen.otherScene += 1;
                else seen.unknown += 1;
                expect(r.ok).toBe(false);
                if (!r.ok) expect(r.error.code).toBe('INVALID_ENTITY_ID');
              } else {
                seen.invalidRequest += 1;
                expect(r.ok).toBe(false);
                if (!r.ok) expect(r.error.code).toBe('INVALID_REQUEST');
              }
              expect(runtime.getFocusedEntityId()).toBe(focusBefore);
            }

            expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
            expect({ ...runtime.getContext(), focusedEntityId: null }).toEqual(contextBefore);
            expect(runtime.listActions()).toEqual(actionsBefore);
            expect(spies.map((s) => s.calls.length)).toEqual(callsBefore);
          }
        },
      ),
      { numRuns: 200 },
    );
    expect(seen.null).toBeGreaterThan(0);
    expect(seen.current).toBeGreaterThan(0);
    expect(seen.otherScene).toBeGreaterThan(0);
    expect(seen.unknown).toBeGreaterThan(0);
    expect(seen.invalidRequest).toBeGreaterThan(0);
  });
});
