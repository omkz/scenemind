import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (name: string): any => JSON.parse(readFileSync(join(root, name), 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('package checks', () => {
  it('depends only on zod at runtime', () => {
    expect(Object.keys(readJson('package.json').dependencies)).toEqual(['zod']);
  });

  it('exposes a single "." export', () => {
    expect(Object.keys(readJson('package.json').exports)).toEqual(['.']);
  });

  it('enables strict TypeScript', () => {
    expect(readJson('tsconfig.json').compilerOptions.strict).toBe(true);
  });

  describe('src/', () => {
    const files = sourceFiles(join(root, 'src'));

    it('has source files to check', () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it('contains no eval( or new Function', () => {
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        expect(text, file).not.toMatch(/\beval\s*\(/);
        expect(text, file).not.toMatch(/new\s+Function\b/);
      }
    });

    it('imports only from zod or relative paths inside src/', () => {
      const specifier = /(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(specifier)) {
          const spec = match[1]!;
          if (spec === 'zod') continue;
          expect(spec, `${file}: ${spec}`).toMatch(/^\.\/[^/]+\.js$/);
        }
      }
    });
  });

  it('exports only generic runtime names', () => {
    expect(Object.keys(api).sort()).toMatchInlineSnapshot(`
      [
        "ActionRegistry",
        "ActionResultSchema",
        "EntityIdSchema",
        "EntitySchema",
        "ErrorCodeSchema",
        "FocusSyncRequestSchema",
        "FocusSyncResultSchema",
        "ParameterSummarySchema",
        "SceneContextSchema",
        "SceneGraphDefinitionSchema",
        "SceneIdSchema",
        "SceneMindError",
        "SceneSchema",
        "createRuntime",
        "defineAction",
        "focusAction",
        "highlightAction",
        "inspectAction",
        "navigateAction",
      ]
    `);
  });
});
