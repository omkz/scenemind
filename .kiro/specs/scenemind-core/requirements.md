# Requirements Document

## Introduction

SceneMind core is a reusable, domain-agnostic TypeScript SDK located in `packages/scenemind/`. It lets an application describe a virtual environment as Scenes and Entities, gives AI agents a structured SceneContext describing that environment, and accepts action requests from AI agents only through a typed, validated ActionRegistry.

AI output is treated as untrusted data. SceneMind validates every action request against Zod schemas and against the current scene state before any application-provided handler runs. SceneMind never evaluates AI output as code and never gives AI agents direct access to application internals.

The first version is intentionally small. It supports four built-in actions: `focus`, `highlight`, `navigate`, and `inspect`. SceneMind validates all four. The application performs the effects of `focus`, `highlight`, and `navigate` through Action_Handlers, and SceneMind handles `inspect` entirely by returning the inspected Entity data. It runs in memory only and is usable and testable without any application, UI framework, panorama viewer, voice stack, LLM provider, database, or authentication.

## Glossary

- **SceneMind**: The core SDK package in `packages/scenemind/`, including all components listed in this glossary.
- **Scene**: A generic, named location or view in a virtual environment, identified by a Scene_ID and containing zero or more Entities.
- **Scene_ID**: A non-empty string that uniquely identifies a Scene within a Scene_Graph.
- **Entity**: A generic object inside a Scene that an AI agent may refer to, identified by an Entity_ID and carrying a label, an optional description, and optional application-defined metadata.
- **Entity_ID**: A non-empty string that uniquely identifies an Entity within a Scene_Graph.
- **Scene_Graph**: The validated collection of all Scenes and Entities registered with a Runtime.
- **Runtime**: The SceneMind component that holds the Scene_Graph, the Current_Scene, the Focused_Entity_ID, and the ActionRegistry, and that processes Action_Requests and Focus_Sync_Requests.
- **Current_Scene**: The Scene that the Runtime currently treats as active.
- **Focused_Entity_ID**: The Entity_ID of the Entity that the Runtime currently treats as focused in the Current_Scene, or `null` when no Entity is focused.
- **Focus_Sync_API**: The Runtime method `syncFocus` that an application calls to report a focus change initiated by the user rather than by an AI agent.
- **Focus_Sync_Request**: An untrusted input value of type `unknown` passed to the Focus_Sync_API, which is valid only when the value is an Entity_ID string or `null`.
- **Focus_Sync_Result**: A typed value returned by the Focus_Sync_API, which is either a success result containing the resulting Focused_Entity_ID or a failure result containing an Error_Code and a message, with the two variants distinguished by a boolean `ok` field.
- **SceneContext**: A read-only, JSON-serializable snapshot produced by the Runtime that describes the Current_Scene, its Entities, the Focused_Entity_ID, the Scenes reachable by `navigate`, and the Available_Actions.
- **SceneAction**: A typed action definition consisting of an action type name, a Zod schema for its parameters, a description for AI agents, and a Parameter_Summary.
- **Parameter_Summary**: A JSON-serializable list supplied by the author of a SceneAction when the SceneAction is defined, where each entry contains a parameter name string, a short type label string (for example `"string"`), and a short description string. A Parameter_Summary is plain data and is not generated from the Zod schema.
- **Action_Request**: An untrusted input value, typically produced by an AI agent, that names an action type and supplies parameters.
- **Validated_Action**: An Action_Request that has passed all SceneMind validation checks and carries typed parameters.
- **ActionRegistry**: The SceneMind component that stores SceneActions by action type name and validates Action_Requests against them.
- **Action_Handler**: An application-provided function that SceneMind invokes with a Validated_Action of a Handler_Backed_Action to carry out the action's effect in the application.
- **Handler_Backed_Action**: A registered SceneAction whose effect is performed by an application Action_Handler. Every registered SceneAction other than `inspect` is a Handler_Backed_Action, including `focus`, `highlight`, `navigate`, and all application-registered SceneActions.
- **SceneMind_Handled_Action**: A Built_In_Action that SceneMind executes entirely without an Action_Handler. In this version, `inspect` is the only SceneMind_Handled_Action.
- **Permitted_Action**: A registered action type name that the Current_Scene allows. WHERE the Current_Scene defines a list of permitted action type names, only registered names in that list are Permitted_Actions. WHERE the Current_Scene defines no such list, every registered action type name is a Permitted_Action.
- **Available_Actions**: The set of action type names that are currently executable. An action type name is in the Available_Actions when all three conditions hold: (1) the action type name is registered in the ActionRegistry, (2) the action type name is a Permitted_Action, and (3) the action is either a SceneMind_Handled_Action or a Handler_Backed_Action with an attached Action_Handler.
- **Action_Result**: A typed value returned by the Runtime after processing an Action_Request, which is either a success result or a failure result containing an Error_Code and a message.
- **Error_Code**: One of the following fixed string values: `INVALID_REQUEST`, `UNKNOWN_ACTION`, `ACTION_UNAVAILABLE`, `INVALID_PARAMETERS`, `INVALID_SCENE_ID`, `INVALID_ENTITY_ID`, `NO_HANDLER`, `HANDLER_FAILED`.
- **Built_In_Actions**: The four SceneActions provided by SceneMind: `focus`, `highlight`, `navigate`, and `inspect`. `focus`, `highlight`, and `navigate` are Handler_Backed_Actions. `inspect` is a SceneMind_Handled_Action.

## Requirements

### Requirement 1: Define Scenes and Entities

**User Story:** As an application developer, I want to describe my virtual environment as Scenes and Entities, so that SceneMind can reason about the environment without knowing its domain.

#### Acceptance Criteria

1. THE SceneMind SHALL provide Zod schemas and inferred TypeScript types for Scene, Entity, Scene_ID, and Entity_ID.
2. THE SceneMind SHALL define an Entity with an Entity_ID, a label, an optional description, and an optional metadata record whose values are JSON-serializable.
3. THE SceneMind SHALL define a Scene with a Scene_ID, a name, an optional description, a list of Entities, a list of Scene_IDs reachable by `navigate`, and an optional list of permitted action type names.
4. WHEN an application creates a Runtime with a Scene_Graph definition and an initial Scene_ID, THE Runtime SHALL validate the definition against the SceneMind schemas before accepting the definition.
5. IF a Scene_Graph definition contains two Scenes with the same Scene_ID, THEN THE Runtime SHALL reject the definition with an error identifying the duplicated Scene_ID.
6. IF a Scene_Graph definition contains two Entities with the same Entity_ID, THEN THE Runtime SHALL reject the definition with an error identifying the duplicated Entity_ID.
7. IF a Scene lists a reachable Scene_ID that does not exist in the Scene_Graph definition, THEN THE Runtime SHALL reject the definition with an error identifying the unknown Scene_ID.
8. IF the initial Scene_ID does not exist in the Scene_Graph definition, THEN THE Runtime SHALL reject the definition with an error identifying the unknown Scene_ID.
9. WHEN the Runtime accepts a Scene_Graph definition, THE Runtime SHALL set the Current_Scene to the Scene identified by the initial Scene_ID.

### Requirement 2: Domain-Agnostic Core

**User Story:** As a SceneMind maintainer, I want the core SDK to remain free of domain and infrastructure dependencies, so that SceneMind is reusable across museums, heritage sites, tourism, education, games, and other environments.

#### Acceptance Criteria

1. THE SceneMind SHALL limit runtime dependencies to the `zod` package.
2. THE SceneMind SHALL expose only generic concept names (Scene, Entity, SceneContext, SceneAction, ActionRegistry, Runtime) in the public API.
3. THE SceneMind SHALL store application-specific Entity data only inside the Entity metadata record.
4. THE SceneMind SHALL run in memory without network access, persistent storage, or authentication.
5. THE SceneMind SHALL be buildable and testable from `packages/scenemind/` without any file from `apps/`.

### Requirement 3: Provide SceneContext to AI Agents

**User Story:** As an AI agent integrator, I want a structured description of the current scene and the allowed actions, so that the AI agent can reason about the environment and request valid actions.

#### Acceptance Criteria

1. WHEN an application requests a SceneContext, THE Runtime SHALL return a SceneContext containing the Current_Scene ID, name, and description.
2. WHEN an application requests a SceneContext, THE Runtime SHALL include every Entity of the Current_Scene with its Entity_ID, label, description, and metadata.
3. WHEN an application requests a SceneContext, THE Runtime SHALL include the Scene_ID and name of every Scene reachable from the Current_Scene by `navigate`.
4. WHEN an application requests a SceneContext, THE Runtime SHALL include the action type name, description, and Parameter_Summary of every Available_Action and of no other action.
5. WHEN an application requests a SceneContext while a Permitted_Action is a Handler_Backed_Action without an attached Action_Handler, THE Runtime SHALL omit that Permitted_Action from the SceneContext.
6. WHEN the Runtime includes a Parameter_Summary in a SceneContext, THE Runtime SHALL use the Parameter_Summary exactly as supplied in the SceneAction definition.
7. THE SceneMind SHALL provide a Zod schema for SceneContext.
8. FOR ALL SceneContext values produced by the Runtime, serializing the SceneContext to JSON and parsing the JSON with the SceneContext schema SHALL produce a value equal to the original SceneContext (round-trip property).
9. WHEN the Runtime returns a SceneContext, THE Runtime SHALL return a value whose modification leaves the Scene_Graph, the Current_Scene, and the Focused_Entity_ID unchanged.
10. WHEN an application requests a SceneContext, THE Runtime SHALL include a `focusedEntityId` field containing the current Focused_Entity_ID, which is an Entity_ID or `null`.

### Requirement 4: Register Actions in the ActionRegistry

**User Story:** As an application developer, I want to register typed actions with schemas and handlers, so that AI agents can only request actions that I have explicitly allowed.

#### Acceptance Criteria

1. THE ActionRegistry SHALL register a SceneAction under a unique action type name with a Zod parameter schema, a description, and a Parameter_Summary.
2. IF an application registers a SceneAction with an action type name that is already registered, THEN THE ActionRegistry SHALL reject the registration with an error identifying the duplicated name.
3. THE ActionRegistry SHALL infer the parameter type of each registered SceneAction from the SceneAction's Zod schema, so that Action_Handlers receive statically typed parameters.
4. WHEN an application attaches an Action_Handler to the action type name of a Handler_Backed_Action, THE Runtime SHALL store the Action_Handler for that action type name.
5. IF an application attaches an Action_Handler to an action type name that is not registered, THEN THE Runtime SHALL reject the attachment with an error identifying the unknown action type name.
6. IF an application attaches an Action_Handler to the action type name `inspect`, THEN THE Runtime SHALL reject the attachment with an error stating that `inspect` is a SceneMind_Handled_Action.
7. WHEN an application lists registered actions, THE ActionRegistry SHALL return the action type name, description, and Parameter_Summary of every registered SceneAction.

### Requirement 5: Built-In Actions

**User Story:** As an application developer, I want common interaction actions provided out of the box, so that I can let AI agents focus, highlight, navigate, and inspect without defining these actions myself.

#### Acceptance Criteria

1. THE SceneMind SHALL provide a `focus` SceneAction whose parameters consist of exactly one required Entity_ID field named `entityId`.
2. THE SceneMind SHALL provide a `highlight` SceneAction whose parameters consist of exactly one required Entity_ID field named `entityId`.
3. THE SceneMind SHALL provide an `inspect` SceneAction whose parameters consist of exactly one required Entity_ID field named `entityId`.
4. THE SceneMind SHALL provide a `navigate` SceneAction whose parameters consist of exactly one required Scene_ID field named `sceneId`.
5. WHEN an application creates a Runtime with the default configuration, THE Runtime SHALL register all Built_In_Actions in the ActionRegistry.
6. WHEN the Runtime executes a Validated_Action of type `focus`, THE Runtime SHALL delegate the focus effect to the Action_Handler attached to `focus`.
7. WHEN the Runtime executes a Validated_Action of type `highlight`, THE Runtime SHALL delegate the highlight effect to the Action_Handler attached to `highlight`.
8. WHEN the Runtime executes a Validated_Action of type `navigate`, THE Runtime SHALL delegate the environment transition to the Action_Handler attached to `navigate` before changing the Current_Scene.
9. WHEN the Action_Handler attached to `navigate` completes successfully, THE Runtime SHALL set the Current_Scene to the Scene identified by the `sceneId` parameter.
10. IF the Action_Handler attached to `navigate` throws an error or returns a rejected promise, THEN THE Runtime SHALL keep the Current_Scene unchanged.
11. WHEN the Runtime executes a Validated_Action of type `inspect`, THE Runtime SHALL return a success Action_Result containing the Entity_ID, label, description, and metadata of the inspected Entity without invoking any Action_Handler.
12. WHEN the Runtime executes a Validated_Action of type `inspect`, THE Runtime SHALL keep the Scene_Graph and the Current_Scene unchanged.
13. WHEN the Action_Handler attached to `focus` completes successfully, THE Runtime SHALL set the Focused_Entity_ID to the `entityId` parameter.
14. WHEN the Runtime sets the Current_Scene after the Action_Handler attached to `navigate` completes successfully, THE Runtime SHALL set the Focused_Entity_ID to `null`.

### Requirement 6: Determine Available Actions

**User Story:** As an application developer, I want AI agents to see only the actions that are allowed in the current scene and can actually run, so that AI agents cannot request actions that make no sense or cannot be executed.

#### Acceptance Criteria

1. THE Runtime SHALL treat an action type name as an Available_Action only when the action type name is registered, is a Permitted_Action, and belongs to either a SceneMind_Handled_Action or a Handler_Backed_Action with an attached Action_Handler.
2. WHERE the Current_Scene defines a list of permitted action type names, THE Runtime SHALL treat as Permitted_Actions only the registered action type names that appear in that list.
3. WHERE the Current_Scene does not define a list of permitted action type names, THE Runtime SHALL treat every registered action type name as a Permitted_Action.
4. WHEN an application attaches an Action_Handler to a Handler_Backed_Action that is a Permitted_Action, THE Runtime SHALL include that action type name in the Available_Actions for every subsequent SceneContext and Action_Request.
5. WHEN the Current_Scene changes or an application attaches an Action_Handler, THE Runtime SHALL recompute the Available_Actions before producing the next SceneContext or processing the next Action_Request.

### Requirement 7: Validate Action Requests Before Execution

**User Story:** As an application developer, I want every AI-produced action request validated before anything runs, so that malformed or malicious AI output cannot affect my application.

#### Acceptance Criteria

1. THE Runtime SHALL accept an Action_Request as a value of type `unknown`.
2. THE Runtime SHALL complete all validation checks in this requirement before invoking any Action_Handler.
3. THE Runtime SHALL perform the validation checks in the following order and return the failure Action_Result of the first failed check: request shape (`INVALID_REQUEST`), registration (`UNKNOWN_ACTION`), scene permission (`ACTION_UNAVAILABLE`), handler attachment (`NO_HANDLER`), parameter schema (`INVALID_PARAMETERS`), and Scene or Entity reference (`INVALID_SCENE_ID` or `INVALID_ENTITY_ID`).
4. IF an Action_Request is not an object with a string action type field and a parameters field, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `INVALID_REQUEST`.
5. IF an Action_Request names an action type that is not registered in the ActionRegistry, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `UNKNOWN_ACTION`.
6. IF an Action_Request names a registered action type that is not a Permitted_Action, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `ACTION_UNAVAILABLE`.
7. IF an Action_Request names a Handler_Backed_Action that is a Permitted_Action and has no attached Action_Handler, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `NO_HANDLER` before validating the parameters.
8. IF the parameters of an Action_Request fail the Zod schema of the named SceneAction, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `INVALID_PARAMETERS` and the schema validation messages.
9. IF an Action_Request of type `navigate` contains a Scene_ID that does not exist in the Scene_Graph or is not reachable from the Current_Scene, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `INVALID_SCENE_ID`.
10. IF an Action_Request of type `focus`, `highlight`, or `inspect` contains an Entity_ID that does not belong to an Entity of the Current_Scene, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `INVALID_ENTITY_ID`.
11. IF an Action_Request fails any validation check, THEN THE Runtime SHALL leave the Scene_Graph, the Current_Scene, and the Focused_Entity_ID unchanged and invoke no Action_Handler.
12. THE Runtime SHALL pass to the Action_Handler only the parameter values produced by the Zod schema parse, excluding any fields absent from the SceneAction schema.
13. THE SceneMind SHALL process Action_Request values only as data, without evaluating any part of an Action_Request as code.
14. FOR ALL Action_Request values, THE Runtime SHALL return an Action_Result instead of throwing an exception (total function property).

### Requirement 8: Execute Validated Actions

**User Story:** As an application developer, I want validated actions delivered to my handlers with clear results, so that my application performs the effect and the AI agent receives feedback.

#### Acceptance Criteria

1. WHEN an Action_Request for a Handler_Backed_Action passes validation, THE Runtime SHALL invoke the attached Action_Handler exactly once with the Validated_Action.
2. WHEN an Action_Handler completes successfully, THE Runtime SHALL return a success Action_Result containing the action type name and the validated parameters.
3. WHEN an Action_Request of type `inspect` passes validation, THE Runtime SHALL produce the success Action_Result directly, containing the action type name, the validated parameters, and the inspected Entity data defined in Requirement 5.
4. IF an Action_Handler throws an error or returns a rejected promise, THEN THE Runtime SHALL return a failure Action_Result with Error_Code `HANDLER_FAILED` and leave the Current_Scene unchanged.
5. THE SceneMind SHALL provide a Zod schema and a TypeScript type for Action_Result, with the success and failure variants distinguished by a boolean `ok` field.
6. FOR ALL Action_Result values returned by the Runtime, serializing the Action_Result to JSON and parsing the JSON with the Action_Result schema SHALL produce a value equal to the original Action_Result (round-trip property).

### Requirement 9: Strongly Typed Public API and Testing

**User Story:** As an application developer, I want a strongly typed and well-tested public API, so that I can integrate SceneMind with confidence.

#### Acceptance Criteria

1. THE SceneMind SHALL be written in TypeScript with the compiler `strict` option enabled.
2. THE SceneMind SHALL export every public type, schema, and function from a single package entry point.
3. THE SceneMind SHALL declare explicit TypeScript types for every exported function parameter and return value.
4. THE SceneMind SHALL include a Vitest test suite that runs from `packages/scenemind/` in single-run mode.
5. THE SceneMind SHALL include tests that cover each Error_Code defined in the Glossary.
6. THE SceneMind SHALL include a test that produces Error_Code `NO_HANDLER` by submitting a direct Action_Request for a Permitted_Action that is a Handler_Backed_Action without an attached Action_Handler.

### Requirement 10: Track Focused Entity

**User Story:** As an application developer, I want SceneMind to track which Entity is focused and to accept validated reports of user-driven focus changes, so that the AI agent sees the same focus as the user.

#### Acceptance Criteria

1. WHEN an application creates a Runtime, THE Runtime SHALL set the Focused_Entity_ID to `null`.
2. THE Runtime SHALL keep the Focused_Entity_ID equal to `null` or to the Entity_ID of an Entity in the Current_Scene (state invariant).
3. IF the Action_Handler attached to `focus` throws an error or returns a rejected promise, THEN THE Runtime SHALL keep the Focused_Entity_ID unchanged.
4. WHEN the Runtime executes a Validated_Action of type `highlight` or `inspect`, THE Runtime SHALL keep the Focused_Entity_ID unchanged.
5. THE Focus_Sync_API SHALL accept a Focus_Sync_Request as a value of type `unknown` and validate the Focus_Sync_Request with a Zod schema.
6. WHEN the Focus_Sync_API receives `null`, THE Runtime SHALL set the Focused_Entity_ID to `null` and return a success Focus_Sync_Result.
7. WHEN the Focus_Sync_API receives an Entity_ID that belongs to an Entity of the Current_Scene, THE Runtime SHALL set the Focused_Entity_ID to that Entity_ID and return a success Focus_Sync_Result.
8. IF the Focus_Sync_API receives a value that is neither a non-empty string nor `null`, THEN THE Focus_Sync_API SHALL return a failure Focus_Sync_Result with Error_Code `INVALID_REQUEST` and keep the Focused_Entity_ID unchanged.
9. IF the Focus_Sync_API receives an Entity_ID that does not belong to an Entity of the Current_Scene, THEN THE Focus_Sync_API SHALL return a failure Focus_Sync_Result with Error_Code `INVALID_ENTITY_ID` and keep the Focused_Entity_ID unchanged.
10. WHEN the Focus_Sync_API processes a Focus_Sync_Request, THE Runtime SHALL keep the Scene_Graph and the Current_Scene unchanged and invoke no Action_Handler.
11. THE Focus_Sync_API SHALL process a Focus_Sync_Request independently of the Current_Scene's permitted action type names and of the Available_Actions.
12. FOR ALL Focus_Sync_Request values, THE Focus_Sync_API SHALL return a Focus_Sync_Result instead of throwing an exception (total function property).
13. THE SceneMind SHALL provide a Zod schema and a TypeScript type for Focus_Sync_Result.
14. THE SceneMind SHALL include tests that cover each success and failure case of the Focus_Sync_API and the state invariant for the Focused_Entity_ID.
