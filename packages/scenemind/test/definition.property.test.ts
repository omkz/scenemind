import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { SceneMindError } from '../src/schemas.js';
import { graphArb, invalidDefinitionArb } from './arbitraries.js';

describe('definition validation', () => {
  // Feature: scenemind-core, Property 1: Definition validation
  // **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 10.1**
  it('accepts every valid definition with the initial Scene current and no focus', () => {
    fc.assert(
      fc.property(graphArb, ({ definition, initialSceneId }) => {
        const runtime = createRuntime({ scenes: definition, initialSceneId });
        expect(runtime.getCurrentSceneId()).toBe(initialSceneId);
        expect(runtime.getFocusedEntityId()).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: scenemind-core, Property 1: Definition validation
  // **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 1.8, 10.1**
  it('rejects every single-mutation definition with the matching code and offending ID', () => {
    fc.assert(
      fc.property(invalidDefinitionArb, (invalid) => {
        let thrown: unknown;
        try {
          createRuntime({
            scenes: invalid.definition as never,
            initialSceneId: invalid.initialSceneId as never,
          });
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(SceneMindError);
        const error = thrown as SceneMindError;
        expect(error.code).toBe(invalid.code);
        if (invalid.code === 'INVALID_DEFINITION') {
          expect(error.issues?.length ?? 0).toBeGreaterThan(0);
        } else {
          expect(error.id).toBe(invalid.id);
        }
      }),
      { numRuns: 100 },
    );
  });
});
