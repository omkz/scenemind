import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import type { Scene } from '../src/schemas.js';
import { createSpy, graphArb, handlerOutcomeArb, outcomeFails } from './arbitraries.js';

type Kind = 'focus' | 'highlight' | 'navigate';

// The initial Scene must permit every action and have at least one Entity,
// so each generated request is valid.
const scenarioArb = graphArb
  .map((g) => {
    const scenes = g.definition.scenes.map((s) => {
      if (s.id !== g.initialSceneId) return s;
      const { permittedActions: _dropped, ...rest } = s;
      return rest as Scene;
    });
    return { definition: { scenes }, initialSceneId: g.initialSceneId };
  })
  .filter((g) => g.definition.scenes.find((s) => s.id === g.initialSceneId)!.entities.length > 0)
  .chain((g) =>
    fc.record({
      graph: fc.constant(g),
      kind: fc.constantFrom<Kind>('focus', 'highlight', 'navigate'),
      outcome: handlerOutcomeArb,
      pick: fc.nat(),
      preFocus: fc.boolean(),
    }),
  )
  .filter(({ graph, kind }) => {
    const scene = graph.definition.scenes.find((s) => s.id === graph.initialSceneId)!;
    return kind !== 'navigate' || scene.reachableSceneIds.length > 0;
  });

describe('Property 9: Handler outcome decides state changes', () => {
  // Feature: scenemind-core, Property 9: Handler outcome decides state changes
  it('commits state only when the handler succeeds, and the handler sees pre-request state', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ graph, kind, outcome, pick, preFocus }) => {
        const runtime = createRuntime({
          scenes: graph.definition,
          initialSceneId: graph.initialSceneId,
        });
        const scene = graph.definition.scenes.find((s) => s.id === graph.initialSceneId)!;

        if (preFocus) {
          const pre = scene.entities[pick % scene.entities.length]!.id;
          expect(runtime.syncFocus(pre).ok).toBe(true);
        }
        const sceneBefore = runtime.getCurrentSceneId();
        const focusBefore = runtime.getFocusedEntityId();

        let params: Record<string, string>;
        if (kind === 'navigate') {
          params = { sceneId: scene.reachableSceneIds[pick % scene.reachableSceneIds.length]! };
        } else {
          params = { entityId: scene.entities[(pick + 1) % scene.entities.length]!.id };
        }

        let seen: { scene: string; focus: string | null } | undefined;
        const spy = createSpy(outcome, () => {
          seen = { scene: runtime.getCurrentSceneId(), focus: runtime.getFocusedEntityId() };
        });
        runtime.attachHandler(kind, spy.handler);

        const result = await runtime.execute({ type: kind, params });

        expect(spy.calls).toHaveLength(1);
        expect(seen).toEqual({ scene: sceneBefore, focus: focusBefore });

        if (outcomeFails(outcome)) {
          expect(result.ok).toBe(false);
          if (!result.ok) expect(result.error.code).toBe('HANDLER_FAILED');
          expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
          expect(runtime.getFocusedEntityId()).toBe(focusBefore);
        } else {
          expect(result.ok).toBe(true);
          if (kind === 'navigate') {
            expect(runtime.getCurrentSceneId()).toBe(params.sceneId);
            expect(runtime.getFocusedEntityId()).toBeNull();
          } else if (kind === 'focus') {
            expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
            expect(runtime.getFocusedEntityId()).toBe(params.entityId);
          } else {
            expect(runtime.getCurrentSceneId()).toBe(sceneBefore);
            expect(runtime.getFocusedEntityId()).toBe(focusBefore);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
