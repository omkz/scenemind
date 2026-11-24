import { describe, expect, it } from 'vitest';
import {
  ActionResultSchema,
  EntitySchema,
  FocusSyncResultSchema,
  SceneSchema,
} from '../src/schemas.js';

describe('EntitySchema metadata', () => {
  it('accepts JSON metadata', () => {
    const r = EntitySchema.safeParse({ id: 'e', label: 'E', metadata: { a: 1, b: ['x', null] } });
    expect(r.success).toBe(true);
  });

  it('rejects a function value', () => {
    const r = EntitySchema.safeParse({ id: 'e', label: 'E', metadata: { f: () => 1 } });
    expect(r.success).toBe(false);
  });

  it('rejects a bigint value', () => {
    const r = EntitySchema.safeParse({ id: 'e', label: 'E', metadata: { n: 10n } });
    expect(r.success).toBe(false);
  });
});

describe('SceneSchema', () => {
  const base = { id: 's', name: 'S', entities: [], reachableSceneIds: [] };

  it('parses without description and permittedActions', () => {
    const r = SceneSchema.parse(base);
    expect(r).toEqual(base);
    expect('description' in r).toBe(false);
    expect('permittedActions' in r).toBe(false);
  });

  it('parses with description and permittedActions', () => {
    const scene = { ...base, description: 'A scene', permittedActions: ['inspect'] };
    expect(SceneSchema.parse(scene)).toEqual(scene);
  });
});

describe('ActionResultSchema', () => {
  const entity = { id: 'box-1', label: 'Box', metadata: { color: 'red' } };

  it('accepts the design example results', () => {
    const results = [
      { ok: true, type: 'focus', params: { entityId: 'box-1' } },
      { ok: true, type: 'inspect', params: { entityId: 'box-1' }, data: { entity } },
      {
        ok: false,
        type: 'focus',
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Parameters do not match the action schema.',
          issues: [{ path: 'entityId', message: 'Invalid input: expected string, received number' }],
        },
      },
    ];
    for (const r of results) {
      expect(ActionResultSchema.parse(r)).toEqual(r);
    }
  });
});

describe('FocusSyncResultSchema', () => {
  it('accepts the design example results', () => {
    const results = [
      { ok: true, focusedEntityId: 'box-1' },
      { ok: true, focusedEntityId: null },
      { ok: false, error: { code: 'INVALID_ENTITY_ID', message: 'Entity is not in the current scene.' } },
    ];
    for (const r of results) {
      expect(FocusSyncResultSchema.parse(r)).toEqual(r);
    }
  });
});
