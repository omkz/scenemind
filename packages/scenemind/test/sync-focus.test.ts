import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import type { SceneGraphDefinition } from '../src/schemas.js';

function graph(permittedActions?: string[]): SceneGraphDefinition {
  return {
    scenes: [
      {
        id: 's1',
        name: 'Scene One',
        entities: [{ id: 'e1', label: 'Entity One' }],
        reachableSceneIds: ['s2'],
        ...(permittedActions === undefined ? {} : { permittedActions }),
      },
      {
        id: 's2',
        name: 'Scene Two',
        entities: [{ id: 'e2', label: 'Entity Two' }],
        reachableSceneIds: [],
      },
    ],
  };
}

describe('syncFocus', () => {
  it('null clears focus and succeeds', () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    runtime.syncFocus('e1');
    expect(runtime.syncFocus(null)).toEqual({ ok: true, focusedEntityId: null });
    expect(runtime.getFocusedEntityId()).toBeNull();
  });

  it('a valid Entity_ID in the Current_Scene sets focus', () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    expect(runtime.syncFocus('e1')).toEqual({ ok: true, focusedEntityId: 'e1' });
    expect(runtime.getFocusedEntityId()).toBe('e1');
    expect(runtime.getContext().focusedEntityId).toBe('e1');
  });

  it('an Entity_ID from another Scene fails with INVALID_ENTITY_ID and changes nothing', () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    runtime.syncFocus('e1');
    const result = runtime.syncFocus('e2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ENTITY_ID');
    expect(runtime.getFocusedEntityId()).toBe('e1');
  });

  it.each([['empty string', ''], ['number', 42]])(
    '%s fails with INVALID_REQUEST and changes nothing',
    (_name, input) => {
      const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
      runtime.syncFocus('e1');
      const result = runtime.syncFocus(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_REQUEST');
      expect(runtime.getFocusedEntityId()).toBe('e1');
    },
  );

  it('succeeds in a Scene whose permittedActions exclude focus', () => {
    const runtime = createRuntime({ scenes: graph(['inspect']), initialSceneId: 's1' });
    expect(runtime.getAvailableActions()).not.toContain('focus');
    expect(runtime.syncFocus('e1')).toEqual({ ok: true, focusedEntityId: 'e1' });
    expect(runtime.getFocusedEntityId()).toBe('e1');
  });

  it('focus is null after a successful navigate', async () => {
    const runtime = createRuntime({ scenes: graph(), initialSceneId: 's1' });
    runtime.attachHandler('navigate', () => undefined);
    runtime.syncFocus('e1');
    const result = await runtime.execute({ type: 'navigate', params: { sceneId: 's2' } });
    expect(result.ok).toBe(true);
    expect(runtime.getCurrentSceneId()).toBe('s2');
    expect(runtime.getFocusedEntityId()).toBeNull();
  });
});
