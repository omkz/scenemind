import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineAction } from '../src/actions.js';
import { createRuntime } from '../src/runtime.js';
import { SceneMindError, type SceneGraphDefinition } from '../src/schemas.js';

function graph(permittedActions?: string[]): SceneGraphDefinition {
  return {
    scenes: [
      {
        id: 's1',
        name: 'Scene One',
        entities: [{ id: 'e1', label: 'Entity One' }],
        reachableSceneIds: [],
        ...(permittedActions === undefined ? {} : { permittedActions }),
      },
    ],
  };
}

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof SceneMindError ? e.code : 'NOT_SCENEMIND_ERROR';
  }
  return undefined;
}

const noop = (): void => undefined;

describe('Runtime setup', () => {
  it('default Runtime lists exactly the four built-ins in order, regardless of handlers', () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    expect(runtime.listActions().map((a) => a.type)).toEqual([
      'focus',
      'highlight',
      'inspect',
      'navigate',
    ]);
  });

  it('listActions includes custom actions after the built-ins', () => {
    const wave = defineAction({
      type: 'wave',
      description: 'Wave.',
      params: z.object({}),
      parameterSummary: [],
    });
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1', actions: [wave] });
    expect(runtime.listActions().map((a) => a.type)).toEqual([
      'focus',
      'highlight',
      'inspect',
      'navigate',
      'wave',
    ]);
  });

  it("attachHandler('inspect', ...) throws HANDLER_NOT_ALLOWED", () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    // @ts-expect-error inspect is not handler-backed
    expect(codeOf(() => runtime.attachHandler('inspect', noop))).toBe('HANDLER_NOT_ALLOWED');
  });

  it('a non-function handler throws INVALID_DEFINITION', () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    expect(codeOf(() => runtime.attachHandler('focus', 'nope' as never))).toBe('INVALID_DEFINITION');
    expect(codeOf(() => runtime.attachHandler('focus', undefined as never))).toBe(
      'INVALID_DEFINITION',
    );
  });

  it('failed attachments leave Available_Actions unchanged', () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    const before = runtime.getAvailableActions();
    expect(before).toEqual(['inspect']);
    // @ts-expect-error inspect is not handler-backed
    expect(codeOf(() => runtime.attachHandler('inspect', noop))).toBe('HANDLER_NOT_ALLOWED');
    expect(codeOf(() => runtime.attachHandler('focus', 42 as never))).toBe('INVALID_DEFINITION');
    expect(runtime.getAvailableActions()).toEqual(before);
    expect(runtime.getContext().actions.map((a) => a.type)).toEqual(before);
  });

  it('a permittedActions entry naming an unregistered action is accepted and ignored', () => {
    const runtime = createRuntime({
      scenes: graph(['ghost', 'inspect']),
      initialSceneId: 's1',
    });
    expect(runtime.getAvailableActions()).toEqual(['inspect']);
    expect(runtime.listActions().map((a) => a.type)).not.toContain('ghost');
  });

  it('attaching a handler adds a permitted action to getContext().actions', () => {
    const runtime = createRuntime({ scenes: graph(['focus', 'inspect']), initialSceneId: 's1' });
    expect(runtime.getContext().actions.map((a) => a.type)).toEqual(['inspect']);
    runtime.attachHandler('focus', noop);
    expect(runtime.getContext().actions.map((a) => a.type)).toEqual(['focus', 'inspect']);
  });

  it('a permitted action without a handler is omitted', () => {
    const runtime = createRuntime({
      scenes: graph(['focus', 'highlight', 'inspect']),
      initialSceneId: 's1',
    });
    runtime.attachHandler('focus', noop);
    const types = runtime.getContext().actions.map((a) => a.type);
    expect(types).toEqual(['focus', 'inspect']);
    expect(types).not.toContain('highlight');
  });

  it('an attached handler for an action not permitted in the scene is omitted', () => {
    const runtime = createRuntime({ scenes: graph(['inspect']), initialSceneId: 's1' });
    runtime.attachHandler('navigate', noop);
    expect(runtime.getContext().actions.map((a) => a.type)).toEqual(['inspect']);
  });
});
