// ESM smoke test: imports the built package through its exports map.
import * as sdk from 'scenemind';

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const expectedExports = [
  'createRuntime',
  'defineAction',
  'ActionRegistry',
  'SceneMindError',
  'focusAction',
  'highlightAction',
  'inspectAction',
  'navigateAction',
  'ActionResultSchema',
  'EntityIdSchema',
  'EntitySchema',
  'ErrorCodeSchema',
  'FocusSyncRequestSchema',
  'FocusSyncResultSchema',
  'ParameterSummarySchema',
  'SceneContextSchema',
  'SceneGraphDefinitionSchema',
  'SceneIdSchema',
  'SceneSchema',
];

for (const name of expectedExports) {
  check(name in sdk && sdk[name] !== undefined, `missing export: ${name}`);
}

if (failures.length === 0) {
  try {
    const runtime = sdk.createRuntime({
      scenes: {
        scenes: [
          {
            id: 'a',
            name: 'Scene A',
            entities: [{ id: 'e1', label: 'Entity 1' }],
            reachableSceneIds: ['b'],
          },
          { id: 'b', name: 'Scene B', entities: [], reachableSceneIds: ['a'] },
        ],
      },
      initialSceneId: 'a',
    });
    const context = runtime.getContext();
    check(context.scene.id === 'a', `expected scene id "a", got "${context.scene?.id}"`);
    check(Array.isArray(context.actions), 'context.actions is not an array');
  } catch (err) {
    failures.push(`runtime check threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failures.length > 0) {
  console.error('smoke test FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('smoke test passed');
