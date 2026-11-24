import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ActionRegistry,
  defineAction,
  focusAction,
  highlightAction,
  inspectAction,
  navigateAction,
} from '../src/actions.js';
import { SceneMindError } from '../src/schemas.js';

describe('built-in action schemas', () => {
  const cases = [
    { action: focusAction, field: 'entityId' },
    { action: highlightAction, field: 'entityId' },
    { action: inspectAction, field: 'entityId' },
    { action: navigateAction, field: 'sceneId' },
  ] as const;

  for (const { action, field } of cases) {
    describe(action.type, () => {
      it(`accepts ${field}`, () => {
        const result = action.params.safeParse({ [field]: 'abc' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toEqual({ [field]: 'abc' });
      });

      it('rejects {}', () => {
        expect(action.params.safeParse({}).success).toBe(false);
      });

      it('strips extra keys', () => {
        const result = action.params.safeParse({ [field]: 'abc', extra: 1 });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toEqual({ [field]: 'abc' });
      });
    });
  }
});

describe('defineAction', () => {
  it('copies the parameter summary', () => {
    const summary = [{ name: 'x', type: 'string', description: 'an x' }];
    const action = defineAction({
      type: 'custom',
      description: 'custom action',
      params: z.object({ x: z.string() }),
      parameterSummary: summary,
    });
    summary[0]!.name = 'mutated';
    summary.push({ name: 'y', type: 'string', description: 'a y' });
    expect(action.parameterSummary).toEqual([{ name: 'x', type: 'string', description: 'an x' }]);
  });
});

describe('ActionRegistry', () => {
  it('throws DUPLICATE_ACTION with the name as id', () => {
    const registry = new ActionRegistry();
    registry.register(focusAction);
    try {
      registry.register(focusAction);
      expect.unreachable('expected duplicate registration to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SceneMindError);
      expect((e as SceneMindError).code).toBe('DUPLICATE_ACTION');
      expect((e as SceneMindError).id).toBe('focus');
    }
  });
});
