import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import type { SceneContext } from '../src/schemas.js';
import { createSpy, operationsArb, outcomeFails, worldArb, type HandlerOutcome } from './arbitraries.js';
import {
  applyExecute,
  createModel,
  currentScene,
  expectedAvailable,
  modelAttach,
  modelSyncFocus,
  type Model,
} from './model.js';

/** SceneContext the model predicts, built from the definition and registered actions. */
function expectedContext(model: Model): SceneContext {
  const scene = currentScene(model);
  const available = new Set(expectedAvailable(model));
  const sceneRef: SceneContext['scene'] = { id: scene.id, name: scene.name };
  if (scene.description !== undefined) sceneRef.description = scene.description;
  return {
    scene: sceneRef,
    entities: scene.entities,
    focusedEntityId: model.focusedEntityId,
    reachableScenes: scene.reachableSceneIds.map((id) => {
      const target = model.definition.scenes.find((s) => s.id === id);
      return { id, name: target!.name };
    }),
    actions: model.actions
      .filter((a) => available.has(a.type))
      .map((a) => ({ type: a.type, description: a.description, parameters: a.parameterSummary })),
  };
}

describe('SceneContext matches the model', () => {
  // Feature: scenemind-core, Property 2: SceneContext matches the model
  // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.10, 6.1, 6.2, 6.3, 6.4, 6.5**
  it('Property 2: getContext() and getAvailableActions() equal the model after every step', async () => {
    await fc.assert(
      fc.asyncProperty(
        worldArb.chain((world) => operationsArb(world).map((ops) => ({ world, ops }))),
        async ({ world, ops }) => {
          const runtime = createRuntime({
            scenes: world.definition,
            initialSceneId: world.initialSceneId,
            actions: world.actions,
          });
          const model = createModel(world.definition, world.initialSceneId, world.actions);
          const outcomes = new Map<string, HandlerOutcome>();

          const check = (): void => {
            const ctx = runtime.getContext();
            const expected = expectedContext(model);
            expect(ctx.scene).toStrictEqual(expected.scene);
            expect(ctx.entities).toStrictEqual(expected.entities);
            expect(ctx.focusedEntityId).toBe(expected.focusedEntityId);
            expect(ctx.reachableScenes).toStrictEqual(expected.reachableScenes);
            expect(ctx.actions.map((a) => a.type)).toEqual(expectedAvailable(model));
            expect(ctx.actions).toStrictEqual(expected.actions);
            expect(runtime.getAvailableActions()).toEqual(expectedAvailable(model));
          };

          check();
          for (const op of ops) {
            if (op.kind === 'attach') {
              const spy = createSpy(op.outcome);
              (runtime.attachHandler as (t: string, h: unknown) => void)(op.type, spy.handler);
              modelAttach(model, op.type);
              outcomes.set(op.type, op.outcome);
            } else if (op.kind === 'execute') {
              await runtime.execute(op.request);
              const type = (() => {
                try {
                  return (op.request as { type?: unknown }).type;
                } catch {
                  return undefined;
                }
              })();
              const outcome = typeof type === 'string' ? outcomes.get(type) : undefined;
              applyExecute(model, op.request, outcome !== undefined && outcomeFails(outcome));
            } else {
              runtime.syncFocus(op.input);
              modelSyncFocus(model, op.input);
            }
            check();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
