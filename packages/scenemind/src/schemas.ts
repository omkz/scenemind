import { z } from 'zod';

export const SceneIdSchema = z.string().min(1);
export const EntityIdSchema = z.string().min(1);

export const EntitySchema = z.object({
  id: EntityIdSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.json()).optional(),
});

export const SceneSchema = z.object({
  id: SceneIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  entities: z.array(EntitySchema),
  reachableSceneIds: z.array(SceneIdSchema),
  permittedActions: z.array(z.string().min(1)).optional(),
});

export const SceneGraphDefinitionSchema = z.object({ scenes: z.array(SceneSchema) });

export const ParameterSummarySchema = z.array(
  z.object({ name: z.string(), type: z.string(), description: z.string() }),
);

export const SceneContextSchema = z.object({
  scene: z.object({ id: SceneIdSchema, name: z.string(), description: z.string().optional() }),
  entities: z.array(EntitySchema),
  focusedEntityId: EntityIdSchema.nullable(),
  reachableScenes: z.array(z.object({ id: SceneIdSchema, name: z.string() })),
  actions: z.array(
    z.object({ type: z.string(), description: z.string(), parameters: ParameterSummarySchema }),
  ),
});

export const ErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'UNKNOWN_ACTION',
  'ACTION_UNAVAILABLE',
  'INVALID_PARAMETERS',
  'INVALID_SCENE_ID',
  'INVALID_ENTITY_ID',
  'NO_HANDLER',
  'HANDLER_FAILED',
]);

const IssueSchema = z.object({ path: z.string(), message: z.string() });

export const ActionResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    type: z.string(),
    params: z.record(z.string(), z.json()),
    data: z.object({ entity: EntitySchema }).optional(), // inspect only
  }),
  z.object({
    ok: z.literal(false),
    type: z.string().optional(), // set once the request shape is valid
    error: z.object({
      code: ErrorCodeSchema,
      message: z.string(),
      issues: z.array(IssueSchema).optional(),
    }),
  }),
]);

export const FocusSyncRequestSchema = EntityIdSchema.nullable();

export const FocusSyncResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), focusedEntityId: EntityIdSchema.nullable() }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['INVALID_REQUEST', 'INVALID_ENTITY_ID']),
      message: z.string(),
    }),
  }),
]);

export type SceneId = z.infer<typeof SceneIdSchema>;
export type EntityId = z.infer<typeof EntityIdSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneGraphDefinition = z.infer<typeof SceneGraphDefinitionSchema>;
export type ParameterSummary = z.infer<typeof ParameterSummarySchema>;
export type SceneContext = z.infer<typeof SceneContextSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ActionResult = z.infer<typeof ActionResultSchema>;
export type FocusSyncResult = z.infer<typeof FocusSyncResultSchema>;

export type SceneMindErrorCode =
  | 'INVALID_DEFINITION'
  | 'DUPLICATE_SCENE_ID'
  | 'DUPLICATE_ENTITY_ID'
  | 'UNKNOWN_SCENE_ID'
  | 'DUPLICATE_ACTION'
  | 'UNKNOWN_ACTION'
  | 'HANDLER_NOT_ALLOWED';

export class SceneMindError extends Error {
  readonly code: SceneMindErrorCode;
  readonly id?: string;
  readonly issues?: readonly { path: string; message: string }[];

  constructor(
    code: SceneMindErrorCode,
    message: string,
    options?: { id?: string; issues?: readonly { path: string; message: string }[] },
  ) {
    super(message);
    this.name = 'SceneMindError';
    this.code = code;
    if (options?.id !== undefined) this.id = options.id;
    if (options?.issues !== undefined) this.issues = options.issues;
  }
}
