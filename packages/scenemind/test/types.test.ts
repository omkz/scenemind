import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  createRuntime,
  defineAction,
  type ActionResult,
  type Entity,
  type Scene,
} from '../src/index.js';

const tagAction = defineAction({
  type: 'tag',
  description: 'Tag something.',
  params: z.object({ count: z.number(), note: z.string().optional() }),
  parameterSummary: [{ name: 'count', type: 'number', description: 'How many.' }],
});

function makeRuntime() {
  return createRuntime({
    scenes: {
      scenes: [{ id: 'a', name: 'A', entities: [], reachableSceneIds: [] }],
    },
    initialSceneId: 'a',
    actions: [tagAction],
  });
}

describe('public types', () => {
  // Requirement 1.1
  it('infers Entity and Scene', () => {
    expectTypeOf<Entity['id']>().toEqualTypeOf<string>();
    expectTypeOf<Entity['label']>().toEqualTypeOf<string>();
    expectTypeOf<Entity['description']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Scene['id']>().toEqualTypeOf<string>();
    expectTypeOf<Scene['name']>().toEqualTypeOf<string>();
    expectTypeOf<Scene['entities']>().toEqualTypeOf<Entity[]>();
    expectTypeOf<Scene['reachableSceneIds']>().toEqualTypeOf<string[]>();
    expectTypeOf<Scene['permittedActions']>().toEqualTypeOf<string[] | undefined>();
    expect(true).toBe(true);
  });

  // Requirement 7.1
  it('execute accepts unknown and resolves to ActionResult', () => {
    const rt = makeRuntime();
    expectTypeOf(rt.execute).parameter(0).toBeUnknown();
    expectTypeOf(rt.execute).returns.toEqualTypeOf<Promise<ActionResult>>();
    expectTypeOf(rt.syncFocus).parameter(0).toBeUnknown();
    expect(true).toBe(true);
  });

  // Requirements 4.3, 9.3
  it('infers custom handler params from the action schema', () => {
    const rt = makeRuntime();
    rt.attachHandler('tag', (action) => {
      expectTypeOf(action.type).toEqualTypeOf<'tag'>();
      expectTypeOf(action.params.count).toEqualTypeOf<number>();
      expectTypeOf(action.params.note).toEqualTypeOf<string | undefined>();
    });
    rt.attachHandler('focus', (action) => {
      expectTypeOf(action.params).toEqualTypeOf<{ entityId: string }>();
    });
    rt.attachHandler('navigate', (action) => {
      expectTypeOf(action.params).toEqualTypeOf<{ sceneId: string }>();
    });
    expect(true).toBe(true);
  });

  // Requirements 4.3, 9.3
  it('rejects invalid attachHandler usage at compile time', () => {
    const rt = makeRuntime();
    // @ts-expect-error inspect is not handler-backed
    expect(() => rt.attachHandler('inspect', () => {})).toThrow();
    // @ts-expect-error unregistered action name
    expect(() => rt.attachHandler('missing', () => {})).toThrow();
    // @ts-expect-error count must be a number
    rt.attachHandler('tag', (action: { type: 'tag'; params: { count: string } }) => {
      void action;
    });
    // @ts-expect-error focus params need entityId, not sceneId
    rt.attachHandler('focus', (action: { type: 'focus'; params: { sceneId: string } }) => {
      void action;
    });
  });
});
