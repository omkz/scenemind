import { afterEach, describe, expect, it } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import type { ActionResult, SceneGraphDefinition } from '../src/schemas.js';

// Requirement 7.13: request content is never evaluated or executed.

const definition: SceneGraphDefinition = {
  scenes: [
    {
      id: 's1',
      name: 'Scene One',
      entities: [{ id: 'e1', label: 'Entity One' }],
      reachableSceneIds: ['s2'],
    },
    { id: 's2', name: 'Scene Two', entities: [], reachableSceneIds: ['s1'] },
  ],
};

const PAYLOADS = [
  'globalThis.pwned = true',
  'globalThis.pwned = true;',
  '(() => { globalThis.pwned = true })()',
  'process.exit(1)',
  'require("fs").writeFileSync("/tmp/pwned", "x")',
  '${globalThis.pwned = true}',
  '`${globalThis.pwned = true}`',
];

const g = globalThis as Record<string, unknown>;

afterEach(() => {
  delete g['pwned'];
});

function snapshot(runtime: ReturnType<typeof makeRuntime>): string {
  return JSON.stringify({
    scene: runtime.getCurrentSceneId(),
    focus: runtime.getFocusedEntityId(),
    context: runtime.getContext(),
    available: runtime.getAvailableActions(),
    listed: runtime.listActions(),
  });
}

function makeRuntime() {
  return createRuntime({ scenes: definition, initialSceneId: 's1' });
}

function expectNormalFailure(result: ActionResult, payload: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(typeof result.error.code).toBe('string');
  expect(JSON.stringify(result.error)).not.toContain(payload);
  expect(result.error.message).not.toContain(payload);
  for (const issue of result.error.issues ?? []) {
    expect(issue.message).not.toContain(payload);
    expect(issue.path).not.toContain(payload);
  }
}

describe('code-like strings in requests are inert (Requirement 7.13)', () => {
  for (const payload of PAYLOADS) {
    it(`type = ${JSON.stringify(payload)}`, async () => {
      const runtime = makeRuntime();
      const before = snapshot(runtime);
      const result = await runtime.execute({ type: payload, params: {} });
      expect(g['pwned']).toBeUndefined();
      expect(snapshot(runtime)).toBe(before);
      expectNormalFailure(result, payload);
      if (!result.ok) expect(result.error.code).toBe('UNKNOWN_ACTION');
    });

    it(`params values = ${JSON.stringify(payload)}`, async () => {
      const runtime = makeRuntime();
      const before = snapshot(runtime);
      const results = await Promise.all([
        runtime.execute({ type: 'focus', params: { entityId: payload } }),
        runtime.execute({ type: 'highlight', params: { entityId: payload } }),
        runtime.execute({ type: 'inspect', params: { entityId: payload } }),
        runtime.execute({ type: 'navigate', params: { sceneId: payload } }),
        runtime.execute({ type: 'focus', params: payload }),
        runtime.execute({ type: 'focus', params: { [payload]: payload } }),
        runtime.execute({ type: 'focus', params: { entityId: 'e1', extra: payload } }),
      ]);
      expect(g['pwned']).toBeUndefined();
      for (const r of results.slice(0, 5)) expectNormalFailure(r, payload);
      // Unrecognized keys are either rejected or stripped; neither may evaluate anything.
      for (const r of results.slice(5)) {
        if (!r.ok) expectNormalFailure(r, payload);
      }
      const after = JSON.parse(snapshot(runtime)) as { scene: string };
      expect(after.scene).toBe('s1');
    });

    it(`code-like type with code-like params leaves state unchanged: ${JSON.stringify(payload)}`, async () => {
      const runtime = makeRuntime();
      const before = snapshot(runtime);
      const result = await runtime.execute({ type: payload, params: { entityId: payload, sceneId: payload } });
      expect(g['pwned']).toBeUndefined();
      expect(snapshot(runtime)).toBe(before);
      expectNormalFailure(result, payload);
    });
  }

  it('code-like string in an unexpected request field is not evaluated', async () => {
    const runtime = makeRuntime();
    const before = snapshot(runtime);
    const result = await runtime.execute({ type: 'inspect', params: { entityId: 'e1' }, extra: PAYLOADS[0] });
    expect(g['pwned']).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(snapshot(runtime)).toBe(before);
  });
});
