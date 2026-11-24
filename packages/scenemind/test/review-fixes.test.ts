import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRuntime, SceneMindError, type SceneAction } from '../src/index.js';

const scenes = {
  scenes: [{ id: 'a', name: 'A', entities: [{ id: 'e1', label: 'E1' }], reachableSceneIds: [] }],
};

describe('final review fixes', () => {
  it('copies actions that were not built by defineAction', () => {
    const plain = {
      type: 'wave',
      description: 'Wave.',
      params: z.object({ n: z.number() }),
      parameterSummary: [{ name: 'n', type: 'number', description: 'Count.' }],
    } satisfies SceneAction;
    const runtime = createRuntime({ scenes, initialSceneId: 'a', actions: [plain] });
    runtime.attachHandler('wave', () => {});
    plain.description = 'HACK';
    plain.parameterSummary[0]!.name = 'HACK';
    const wave = runtime.getContext().actions.find((x) => x.type === 'wave');
    expect(wave).toEqual({
      type: 'wave',
      description: 'Wave.',
      parameters: [{ name: 'n', type: 'number', description: 'Count.' }],
    });
  });

  it('throws SceneMindError for a non-object config or non-array actions', () => {
    for (const bad of [undefined, null, 5]) {
      expect(() => createRuntime(bad as never)).toThrow(SceneMindError);
    }
    expect(() => createRuntime({ scenes, initialSceneId: 'a', actions: 5 as never })).toThrow(
      expect.objectContaining({ code: 'INVALID_DEFINITION' }),
    );
  });
});
