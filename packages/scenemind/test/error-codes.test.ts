import { describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import type { ActionResult } from '../src/schemas.js';

// Validates: Requirements 9.5, 9.6

function makeRuntime(permittedActions?: string[]) {
  return createRuntime({
    scenes: {
      scenes: [
        {
          id: 'hall',
          name: 'Hall',
          entities: [{ id: 'statue', label: 'Statue' }],
          reachableSceneIds: ['garden'],
          ...(permittedActions === undefined ? {} : { permittedActions }),
        },
        { id: 'garden', name: 'Garden', entities: [], reachableSceneIds: ['hall'] },
      ],
    },
    initialSceneId: 'hall',
  });
}

function errorOf(result: ActionResult) {
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('Error_Codes', () => {
  it('INVALID_REQUEST: request is not an object', async () => {
    const rt = makeRuntime();
    expect(errorOf(await rt.execute('focus')).code).toBe('INVALID_REQUEST');
  });

  it('UNKNOWN_ACTION: action is not registered', async () => {
    const rt = makeRuntime();
    expect(errorOf(await rt.execute({ type: 'teleport', params: {} })).code).toBe('UNKNOWN_ACTION');
  });

  it('ACTION_UNAVAILABLE: scene does not permit the action', async () => {
    const rt = makeRuntime(['inspect']);
    rt.attachHandler('focus', () => {});
    const result = await rt.execute({ type: 'focus', params: { entityId: 'statue' } });
    expect(errorOf(result).code).toBe('ACTION_UNAVAILABLE');
  });

  it('NO_HANDLER: default Runtime, no handlers, focus with a valid entity', async () => {
    const rt = makeRuntime();
    const result = await rt.execute({ type: 'focus', params: { entityId: 'statue' } });
    expect(result.ok).toBe(false);
    expect(errorOf(result).code).toBe('NO_HANDLER');
    expect(rt.getFocusedEntityId()).toBeNull();
  });

  it('INVALID_PARAMETERS: includes non-empty issues', async () => {
    const rt = makeRuntime();
    rt.attachHandler('focus', () => {});
    const error = errorOf(await rt.execute({ type: 'focus', params: {} }));
    expect(error.code).toBe('INVALID_PARAMETERS');
    expect(error.issues?.length ?? 0).toBeGreaterThan(0);
  });

  it('INVALID_SCENE_ID: navigate target is not reachable', async () => {
    const rt = makeRuntime();
    rt.attachHandler('navigate', () => {});
    const result = await rt.execute({ type: 'navigate', params: { sceneId: 'nowhere' } });
    expect(errorOf(result).code).toBe('INVALID_SCENE_ID');
  });

  it('INVALID_ENTITY_ID: entity is not in the current scene', async () => {
    const rt = makeRuntime();
    rt.attachHandler('focus', () => {});
    const result = await rt.execute({ type: 'focus', params: { entityId: 'ghost' } });
    expect(errorOf(result).code).toBe('INVALID_ENTITY_ID');
  });

  it('HANDLER_FAILED: handler throws', async () => {
    const rt = makeRuntime();
    rt.attachHandler('focus', () => {
      throw new Error('boom');
    });
    const result = await rt.execute({ type: 'focus', params: { entityId: 'statue' } });
    const error = errorOf(result);
    expect(error.code).toBe('HANDLER_FAILED');
    expect(rt.getFocusedEntityId()).toBeNull();
  });
});
