import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { createSpy, worldArb } from './arbitraries.js';

describe('Property 10', () => {
  it('inspect answers with the Entity, calls no handler, and changes no state', async () => {
    // Feature: scenemind-core, Property 10: inspect answers without handlers or state changes
    // **Validates: Requirements 5.11, 5.12, 8.3, 10.4**
    let exercised = 0;
    await fc.assert(
      fc.asyncProperty(worldArb, fc.nat(), fc.nat(), async (world, entityPick, focusPick) => {
        const scene = world.definition.scenes.find((s) => s.id === world.initialSceneId)!;
        fc.pre(scene.permittedActions === undefined || scene.permittedActions.includes('inspect'));
        fc.pre(scene.entities.length > 0);

        const runtime = createRuntime({
          scenes: world.definition,
          initialSceneId: world.initialSceneId,
          actions: world.actions,
        });

        // Attach a spy to every handler-backed action. inspect must never reach any of them.
        const spies = ['focus', 'highlight', 'navigate', ...world.actions.map((a) => a.type)].map((type) => {
          const spy = createSpy({ kind: 'resolve', ticks: 1 });
          (runtime.attachHandler as (t: string, h: unknown) => void)(type, spy.handler);
          return spy;
        });

        // Start from either no focus or some focused Entity of the Current_Scene.
        const focusIdx = focusPick % (scene.entities.length + 1);
        if (focusIdx < scene.entities.length) {
          expect(runtime.syncFocus(scene.entities[focusIdx]!.id).ok).toBe(true);
        }

        const target = scene.entities[entityPick % scene.entities.length]!;
        const sceneBefore = runtime.getCurrentSceneId();
        const focusBefore = runtime.getFocusedEntityId();
        const contextBefore = runtime.getContext();

        const result = await runtime.execute({ type: 'inspect', params: { entityId: target.id } });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect((result.data as { entity: unknown }).entity).toEqual(target);
        for (const spy of spies) expect(spy.calls).toHaveLength(0);
        expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
        expect(runtime.getFocusedEntityId()).toBe(focusBefore);
        expect(runtime.getContext()).toEqual(contextBefore);
        exercised += 1;
      }),
      { numRuns: 200 },
    );
    expect(exercised).toBeGreaterThanOrEqual(100);
  });
});
