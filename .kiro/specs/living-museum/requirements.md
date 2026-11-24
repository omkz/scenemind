# Requirements Document

## Introduction

Living Museum is the first reference application of the SceneMind SDK. It lives in `apps/living-museum/` and is built with React, Vite, TypeScript, and Marzipano. The 360-degree panorama fills the viewport. Visitors look around, click exhibit hotspots, and optionally open a collapsible chat drawer to talk with a museum guide. The guide receives the SceneContext and may propose actions (focus, highlight, navigate, inspect). These proposals are untrusted and run only through the SceneMind Runtime, which validates them.

Museum content is a JSON file validated by an app-owned Zod schema. It uses real, redistributable panoramas and factual exhibit metadata, each with recorded attribution. Museum concepts (Gallery, Exhibit, Exhibit_Details, panoramas, view angles) stay in the app and map onto the generic SceneMind Scene, Entity, and `metadata`. The SceneContext already carries entity `metadata` and `focusedEntityId`, so the guide gets all catalog facts and the current focus without any change to `packages/scenemind`.

A minimal server-side endpoint inside the app package lets the guide use an LLM, with the API key kept on the server. A bundled Scripted_Guide works offline and is the default and fallback.

Assets, exhibit facts, and verification results are never fabricated. An Asset_Checklist is completed before catalog content is written, a dev-only Calibration_Mode helps the developer read View_Positions, a human records each Position_Verification, and a Release_Check blocks a release that lacks real, verified content.

Out of scope: voice, LiveKit, authentication, database, chat history persistence, a content management interface, separate backend infrastructure, and changes to `packages/scenemind`.

## Glossary

- **Living_Museum_App**: The React and Vite application in `apps/living-museum/`, including its Guide_Endpoint.
- **SceneMind_Runtime**: The Runtime returned by `createRuntime` from the `scenemind` package.
- **Museum_Catalog**: The JSON file that describes all Galleries, Exhibits, and attributions.
- **Catalog_Schema**: The Zod schema, defined in the Living_Museum_App, that validates the Museum_Catalog.
- **Gallery**: A museum room with one Panorama. It maps to one SceneMind Scene.
- **Exhibit**: An item visible in a Gallery's Panorama. It maps to one SceneMind Entity.
- **Exhibit_Details**: Factual Exhibit fields (title, period, origin, curator note, and similar), stored in `Entity.metadata`. A fact exists only if the Museum_Catalog contains it.
- **Panorama**: An equirectangular 360-degree image of a Gallery, served as a static asset.
- **View_Position**: A yaw in [-π, π] and a pitch in [-π/2, π/2], in radians, locating a point in a Panorama.
- **Attribution**: A record with source, author or credit, license name, license URL, source URL, and an optional `changes` note describing modifications made to the work.
- **Redistributable_License**: One of public domain, CC0, CC BY (any version), or CC BY-SA (any version).
- **Position_Verification**: A catalog field per Exhibit with the verifier name, a date, and a status (`visible` or `pending`), recording a check by a human that the Exhibit appears at its View_Position. Only a human enters this record.
- **Calibration_Mode**: A development-only mode of the Panorama_Viewer that reports the yaw and pitch of a point chosen by the developer.
- **Screen_Projection**: The pure function that converts a screen coordinate and a view (as an interface) into a View_Position.
- **Fixture_Catalog**: A Museum_Catalog or Panorama used only for development and tests, marked with `"fixture": true` and stored under a fixtures path.
- **Release_Catalog**: The Museum_Catalog shipped in production builds, located outside the fixtures path.
- **Release_Check**: The script run by `pnpm release:check` and as part of `pnpm build` in production mode.
- **Asset_Checklist**: The file `apps/living-museum/ASSETS.md` that lists required assets and their status.
- **Fabricated_Content**: Any panorama, exhibit fact, attribution, or Position_Verification not taken from a real, cited source or entered by a real human.
- **Full_Context**: The complete SceneContext as returned by `getContext()`, with no field removed or summarized.
- **Panorama_Viewer**: The component that renders the current Gallery's Panorama with Marzipano.
- **Hotspot**: A clickable marker on the Panorama, either at an Exhibit or at a link to another Gallery.
- **Chat_Drawer**: The collapsible overlay containing the text input, send control, and message list.
- **Details_Panel**: The unobtrusive overlay that shows Exhibit_Details of the focused Exhibit.
- **Credits_Panel**: The overlay that lists all Attributions.
- **Visitor**: The person using the Living_Museum_App.
- **Developer**: The person running the Living_Museum_App in a development build.
- **Guide_Provider**: An interface that accepts a Visitor message and a SceneContext and returns a Promise of an unknown value.
- **Scripted_Guide**: The bundled, deterministic, offline Guide_Provider.
- **Http_Guide**: The browser Guide_Provider that sends the message and SceneContext to the Guide_Endpoint.
- **Guide_Endpoint**: The server-side handler for `POST /api/guide`, implemented as Vite dev and preview middleware plus a small Node handler inside `apps/living-museum/`.
- **LLM_Client**: The server-side interface the Guide_Endpoint calls to get an LLM completion.
- **Guide_Reply**: A value with a text message and an optional list of Action_Requests.
- **Action_Request**: An untrusted `{ type, params }` value proposed by a guide.
- **SceneContext**: The JSON-serializable snapshot from `getContext()` of the SceneMind_Runtime.
- **Catalog_Mapper**: The app function that converts the Museum_Catalog into a SceneMind `SceneGraphDefinition`.
- **Action_Bridge**: The app code that attaches handlers for focus, highlight, and navigate to the SceneMind_Runtime and connects them to the Panorama_Viewer.
- **LLM_API_Key**: The secret credential for the LLM service, read from a server-side environment variable.
- **Narrow_Viewport**: A viewport width from 360 px up to 767 px.

## Requirements

### Requirement 1: Project setup and boundaries

**User Story:** As a developer, I want the app to use SceneMind only through its public API, so that SceneMind stays reusable and domain-agnostic.

#### Acceptance Criteria

1. THE Living_Museum_App SHALL reside in `apps/living-museum/` as a pnpm workspace package built with React, Vite, and TypeScript in strict mode.
2. THE Living_Museum_App SHALL declare `scenemind` and `marzipano` as dependencies and SHALL import SceneMind symbols only from the `scenemind` package entry point.
3. THE Living_Museum_App SHALL provide the scripts `dev`, `build`, `typecheck`, `release:check`, and `test`, where `test` runs Vitest once without watch mode.
4. THE Living_Museum_App SHALL contain no database, authentication, or voice code, and no server code other than the Guide_Endpoint.
5. THE `packages/scenemind` package SHALL contain no import of, and no reference to, the Living_Museum_App or museum-specific terms.
6. WHEN `pnpm build` is run in `apps/living-museum/`, THE Living_Museum_App SHALL produce a static client bundle that works with the Scripted_Guide on static file hosting alone.

### Requirement 2: Museum catalog and attribution

**User Story:** As a content author, I want real, attributed museum content in a JSON file, so that the demo is legally redistributable and changes without code changes.

#### Acceptance Criteria

1. THE Museum_Catalog SHALL define at least 2 Galleries, each with an id, a name, a description, a Panorama asset path, an initial View_Position, at least 2 Exhibits, and the reachable Gallery ids with a View_Position per navigation Hotspot.
2. THE Museum_Catalog SHALL define for each Exhibit an id, a label, a description, a View_Position, Exhibit_Details, a Position_Verification, and a source Attribution for the Exhibit_Details.
3. THE Museum_Catalog SHALL define for each Gallery an Attribution for its Panorama.
4. THE Catalog_Schema SHALL reject a Museum_Catalog in which any Attribution lacks credit, source, license name, license URL, or source URL, or in which any View_Position is outside the yaw and pitch ranges.
5. THE Catalog_Schema SHALL accept the licenses public domain, CC0, CC BY, and CC BY-SA, and SHALL reject a Museum_Catalog in which any license is not a Redistributable_License, in which an Exhibit lacks a Position_Verification, in which Gallery ids or Exhibit ids (across all Galleries) are duplicated, or in which a reachable Gallery id matches no Gallery.
6. THE Museum_Catalog shipped with the Living_Museum_App SHALL contain only real Panoramas and factual Exhibit_Details taken from the cited sources, with no placeholder or fabricated content.
7. WHEN the Living_Museum_App starts, THE Living_Museum_App SHALL validate the Museum_Catalog with the Catalog_Schema.
8. IF the Museum_Catalog fails validation, THEN THE Living_Museum_App SHALL display an error screen that lists the failing paths and SHALL NOT create the SceneMind_Runtime.
9. THE Release_Catalog SHALL contain for each Exhibit a Position_Verification with a verifier name, a date, and the status `visible`, entered by a human after viewing the Exhibit at its View_Position in its Panorama.
10. WHEN the Visitor opens the Credits_Panel, THE Credits_Panel SHALL list every Panorama Attribution and every Exhibit_Details source Attribution, showing credit, source, license name, and the `changes` note where present, with the source URL and license URL as links.
11. THE Living_Museum_App SHALL show a control labeled "Credits" that opens the Credits_Panel on every screen.
12. THE Museum_Catalog SHALL define for each Attribution the credit, source, license name, license URL, and source URL, and WHERE the work was modified, a `changes` note.

### Requirement 3: Catalog-to-SceneMind mapping

**User Story:** As a developer, I want the catalog converted into a SceneMind scene graph, so that the AI sees museum content through generic SceneMind concepts.

#### Acceptance Criteria

1. THE Catalog_Mapper SHALL map each Gallery to one Scene with the same id, name, and description, and with the reachable Gallery ids as `reachableSceneIds`.
2. THE Catalog_Mapper SHALL map each Exhibit to one Entity of its Gallery's Scene, with the Exhibit id, label, description, and Exhibit_Details as Entity id, label, description, and `metadata`.
3. THE Catalog_Mapper SHALL omit View_Positions, Panorama paths, Position_Verifications, and Attributions from its output.
4. FOR ALL Museum_Catalogs that pass the Catalog_Schema, THE Catalog_Mapper output SHALL be accepted by `SceneGraphDefinitionSchema`.
5. FOR ALL Catalog_Mapper outputs, serializing to JSON and parsing again SHALL produce an equal value (round-trip property).
6. WHEN the Museum_Catalog passes validation, THE Living_Museum_App SHALL create one SceneMind_Runtime with the first Gallery as the initial scene.

### Requirement 4: Panorama viewing and hotspots

**User Story:** As a visitor, I want to look around a 360-degree panorama and click exhibits and doors, so that I can explore without typing.

#### Acceptance Criteria

1. WHILE the SceneMind_Runtime has a current scene, THE Panorama_Viewer SHALL render the Panorama of the Gallery whose id equals `getCurrentSceneId()`.
2. WHEN a Gallery is shown after a navigation, THE Panorama_Viewer SHALL set the view to the initial View_Position of that Gallery.
3. THE Panorama_Viewer SHALL support rotation by mouse or touch drag and zoom by mouse wheel or pinch.
4. THE Panorama_Viewer SHALL display one exhibit Hotspot per Exhibit of the current Gallery at its View_Position, and one navigation Hotspot per reachable Gallery labeled with the target Gallery name.
5. WHILE the SceneMind_Runtime has a focused entity, THE Panorama_Viewer SHALL render that Exhibit's Hotspot in a focused style and THE Details_Panel SHALL display its Exhibit_Details.
6. WHILE a Panorama is loading, THE Panorama_Viewer SHALL display a loading indicator.
7. IF a Panorama fails to load, THEN THE Panorama_Viewer SHALL display a message that names the Gallery and THE Chat_Drawer SHALL remain usable.
8. WHEN the Panorama_Viewer unmounts, THE Panorama_Viewer SHALL release its Marzipano viewer and DOM listeners.

### Requirement 5: Visitor clicks and state sync

**User Story:** As a visitor, I want my clicks reflected in the app state and known to the AI, so that chat and clicks stay consistent.

#### Acceptance Criteria

1. WHEN the Visitor clicks an exhibit Hotspot, THE Living_Museum_App SHALL call `syncFocus` on the SceneMind_Runtime with the Exhibit id.
2. WHEN the Visitor clicks the Panorama background, THE Living_Museum_App SHALL call `syncFocus` with `null`.
3. WHEN the Visitor clicks a navigation Hotspot, THE Living_Museum_App SHALL call `execute` with a `navigate` request for the target Gallery id.
4. IF `syncFocus` or `execute` returns `ok: false` for a Visitor click, THEN THE Living_Museum_App SHALL show the error code in a status message and leave the displayed state unchanged.
5. WHILE an `execute` call is pending, THE Living_Museum_App SHALL ignore further Hotspot clicks.
6. THE Living_Museum_App SHALL derive the current Gallery and focused Exhibit from `getCurrentSceneId()` and `getFocusedEntityId()`.
7. WHEN a `navigate` action succeeds, THE Living_Museum_App SHALL clear the Details_Panel.

### Requirement 6: Action bridge

**User Story:** As a developer, I want SceneMind actions connected to the viewer, so that validated actions have visible effects.

#### Acceptance Criteria

1. THE Action_Bridge SHALL attach one handler each for `focus`, `highlight`, and `navigate`, and no handler for `inspect`.
2. WHEN the `focus` handler is called, THE Action_Bridge SHALL rotate the Panorama_Viewer to the View_Position of the entity within 1.5 seconds, or immediately WHILE the Visitor prefers reduced motion.
3. WHEN the `highlight` handler is called, THE Action_Bridge SHALL highlight the Hotspot of that Exhibit for 3 seconds and replace any active highlight.
4. WHEN the `navigate` handler is called, THE Action_Bridge SHALL load the Panorama of the target Gallery and resolve after the load completes.
5. IF the target Panorama fails to load, THEN THE `navigate` handler SHALL reject, so that the SceneMind_Runtime keeps the previous scene.

### Requirement 7: Immersive and responsive interface

**User Story:** As a visitor, I want the panorama to be the main experience with a refined, unobtrusive interface, so that exploring feels like visiting a museum rather than using a chatbot.

#### Acceptance Criteria

1. THE Living_Museum_App SHALL render the Panorama_Viewer region as the main landmark and fill the full viewport behind all other interface elements.
2. WHEN the Living_Museum_App starts, THE Chat_Drawer SHALL be collapsed and a control labeled "Chat with guide" SHALL open it.
3. WHEN the Visitor activates the open or close control of the Chat_Drawer, THE Chat_Drawer SHALL toggle between collapsed and open, and WHILE open THE Chat_Drawer SHALL leave the Panorama_Viewer region at full viewport size.
4. THE Living_Museum_App SHALL display the Gallery name and the Credits control as small overlays at the viewport edge, and THE Details_Panel SHALL appear only WHILE an Exhibit is focused.
5. THE Living_Museum_App SHALL lay out without horizontal scrolling and without overlapping controls at viewport widths from 360 px up, and WHILE the viewport is a Narrow_Viewport THE Chat_Drawer and Details_Panel SHALL each occupy at most 60% of the viewport height.
6. THE Living_Museum_App SHALL render each Hotspot with an interactive target of at least 44 by 44 CSS pixels.
7. THE Living_Museum_App SHALL make every control and every Hotspot reachable and operable by keyboard (Tab, Enter, Space), with an accessible name and a visible focus indicator.
8. WHEN the Visitor presses Escape WHILE the Chat_Drawer, Details_Panel, or Credits_Panel is open, THE Living_Museum_App SHALL close the topmost open panel and return focus to the control that opened it.
9. WHILE the Visitor prefers reduced motion, THE Living_Museum_App SHALL replace animated rotation, drawer transitions, and highlight animations with instant changes.

### Requirement 8: Chat interaction

**User Story:** As a visitor, I want to chat with the guide in text, so that I can ask about what I see and be taken to places.

#### Acceptance Criteria

1. THE Chat_Drawer SHALL provide a labeled text input, a send control, and a scrolling message list.
2. WHEN the Visitor submits a non-empty message, THE Living_Museum_App SHALL append the message to the list and call the selected Guide_Provider with the message and the current SceneContext from `getContext()`.
3. IF the Visitor submits an empty or whitespace-only message, THEN THE Chat_Drawer SHALL ignore the submission.
4. WHILE the Guide_Provider has not returned, THE Chat_Drawer SHALL show a pending indicator and disable the send control.
5. THE Chat_Drawer SHALL render message text as plain text, not as HTML.
6. IF the Guide_Provider throws, rejects, or does not return within 15 seconds, THEN THE Chat_Drawer SHALL display an error message and re-enable the send control.
7. THE Living_Museum_App SHALL keep chat messages in memory only.

### Requirement 9: Guide actions go through SceneMind validation

**User Story:** As a developer, I want every AI-proposed action validated by SceneMind, so that untrusted output cannot manipulate the app.

#### Acceptance Criteria

1. IF a Guide_Reply does not match the Guide_Reply schema, THEN THE Living_Museum_App SHALL discard the reply, display an error message, and not call `execute`.
2. WHEN a Guide_Reply contains Action_Requests, THE Living_Museum_App SHALL pass each Action_Request unchanged to `execute`, one after another in list order, awaiting each result.
3. THE Living_Museum_App SHALL execute at most 5 Action_Requests per Guide_Reply and report the skipped count in the Chat_Drawer.
4. IF `execute` returns `ok: false`, THEN THE Living_Museum_App SHALL show the error code and message in the Chat_Drawer as a system message and continue with the next Action_Request.
5. WHEN `execute` returns `ok: true` for an `inspect` request, THE Living_Museum_App SHALL show the returned Exhibit_Details in the Chat_Drawer as a system message.
6. THE Living_Museum_App SHALL change the viewer, the focused Exhibit, and the current Gallery only through SceneMind_Runtime handlers or `syncFocus`.
7. THE Living_Museum_App SHALL NOT apply `eval`, `new Function`, `dangerouslySetInnerHTML`, or dynamic imports to Guide_Reply content.

### Requirement 10: Guide behavior

**User Story:** As a visitor, I want a guide that understands what I am looking at and answers only from museum facts, so that I can trust its answers.

#### Acceptance Criteria

1. THE Living_Museum_App SHALL call guides only through the Guide_Provider interface, so that one Guide_Provider replaces another without changes to the Chat_Drawer, the Action_Bridge, or the SceneMind_Runtime.
2. WHEN the Visitor message mentions the label of an Exhibit in the SceneContext entities, THE Scripted_Guide SHALL reply with the Exhibit description and with `focus` and `inspect` Action_Requests for it.
3. WHEN the Visitor message mentions the name of a Gallery in the SceneContext reachable scenes, THE Scripted_Guide SHALL reply with a confirmation and a `navigate` Action_Request for it.
4. WHEN the Visitor message asks to highlight an Exhibit in the SceneContext entities, THE Scripted_Guide SHALL reply with a `highlight` Action_Request for it.
5. WHEN the Visitor message contains a contextual reference ("this", "it", "that one") and `focusedEntityId` in the SceneContext is not null, THE Scripted_Guide SHALL resolve the reference to the focused Exhibit.
6. IF the Visitor message contains a contextual reference and `focusedEntityId` is null, THEN THE Scripted_Guide SHALL reply with a question asking which Exhibit the Visitor means, listing the Exhibit labels of the current Gallery, with no Action_Requests.
7. WHEN the Visitor message asks to compare two Exhibits, or asks which Exhibit is older or newer, or asks which Exhibits share a period or origin, THE Scripted_Guide SHALL answer using only the period and origin fields of the Exhibit_Details in the SceneContext.
8. IF the Visitor message asks for a fact that is absent from the Exhibit_Details, description, and label of the referenced Exhibits, THEN THE Scripted_Guide SHALL reply that it does not have that information and SHALL include no invented fact.
9. IF the Visitor message matches no rule, THEN THE Scripted_Guide SHALL reply with the current Gallery name and its Exhibit labels, and with no Action_Requests.
10. THE Scripted_Guide SHALL build Action_Requests only from ids in the SceneContext it received, and SHALL return the same Guide_Reply for the same message and SceneContext.
11. WHILE the Scripted_Guide is the selected Guide_Provider, THE Living_Museum_App SHALL send no Visitor message or SceneContext over the network.
12. WHEN the Living_Museum_App starts, THE Living_Museum_App SHALL select the Http_Guide if the Guide_Endpoint reports that an LLM_API_Key is configured, and SHALL otherwise select the Scripted_Guide.
13. IF the Http_Guide call fails because the Guide_Endpoint is unreachable or returns an error, THEN THE Living_Museum_App SHALL answer that message with the Scripted_Guide and show a notice that the fallback was used.

### Requirement 11: Guide endpoint and LLM integration

**User Story:** As a developer, I want a minimal server-side endpoint that calls an LLM with grounded instructions, so that the guide gives open-ended answers without exposing secrets or inventing facts.

#### Acceptance Criteria

1. THE Guide_Endpoint SHALL accept `POST /api/guide` with a JSON body that contains a Visitor message and a SceneContext, SHALL validate the SceneContext with `SceneContextSchema`, and SHALL return a Guide_Reply as JSON.
2. THE Guide_Endpoint SHALL run inside `apps/living-museum/` as Vite dev and preview middleware, with no separate server project or hosted infrastructure.
3. THE Guide_Endpoint SHALL read the LLM_API_Key only from a server-side environment variable.
4. THE Living_Museum_App SHALL NOT include the LLM_API_Key in the client bundle, in any response to the browser, or in any log output.
5. THE Living_Museum_App SHALL provide `.env.example` with placeholder values and SHALL list `.env` files in `.gitignore`.
6. IF the request body exceeds 256 KB, is not valid JSON, or does not match the request schema, THEN THE Guide_Endpoint SHALL respond with status 400 and a generic error body.
7. THE Guide_Endpoint SHALL call the LLM through the LLM_Client interface, so that tests replace the LLM service with a fake.
8. THE Guide_Endpoint SHALL pass to the LLM_Client the Visitor message and the Full_Context after validation, including entities, `metadata`, `focusedEntityId`, and the available action types, with no field removed or summarized and no museum data outside the Full_Context.
9. THE Guide_Endpoint SHALL instruct the LLM to answer facts only from the supplied entity data, to say that it does not have the information when a requested fact is absent, to resolve contextual references with `focusedEntityId`, to ask which Exhibit is meant when no Exhibit is focused and the reference is ambiguous, and to propose only the supplied action types.
10. WHEN the LLM_Client returns output, THE Guide_Endpoint SHALL validate the output against the Guide_Reply schema before it responds, and SHALL treat the output as untrusted.
11. IF the LLM_Client fails, returns output that fails validation, or does not return within 10 seconds, THEN THE Guide_Endpoint SHALL respond with status 502 and a generic error body that contains no upstream message, stack trace, or secret.
12. WHILE no LLM_API_Key is configured, THE Guide_Endpoint SHALL respond to `POST /api/guide` with status 503 and report the unconfigured state to the client capability check.
13. THE Http_Guide SHALL return the parsed endpoint response as an unknown value, and the Living_Museum_App SHALL treat it as untrusted under Requirement 9.

### Requirement 12: Testing

**User Story:** As a developer, I want automated tests for the app logic, so that the example stays correct as SceneMind evolves.

#### Acceptance Criteria

1. THE Living_Museum_App SHALL include Vitest tests for the Catalog_Schema, the Catalog_Mapper, the Scripted_Guide, and the Action_Bridge, with the Panorama_Viewer replaced by a fake.
2. THE Living_Museum_App SHALL include Catalog_Schema tests that reject a catalog with each of the following: a missing Attribution field, a non-redistributable license, an out-of-range View_Position, a missing Position_Verification, duplicate ids, and an unknown reachable Gallery id; and a test that the shipped Museum_Catalog passes the Catalog_Schema.
3. THE Living_Museum_App SHALL include a fast-check test that, for every valid Museum_Catalog, the Catalog_Mapper output passes `SceneGraphDefinitionSchema` and `createRuntime` accepts it.
4. THE Living_Museum_App SHALL include a fast-check test that, for every SceneContext and message, every Action_Request of the Scripted_Guide is accepted by `execute` of a SceneMind_Runtime with the handlers attached and in the state of that SceneContext.
5. THE Living_Museum_App SHALL include Scripted_Guide tests for contextual references with and without a focused Exhibit, for comparative questions, and for a fast-check property that every period or origin value in a Scripted_Guide reply equals a value in the SceneContext metadata.
6. THE Living_Museum_App SHALL include a fast-check test with a fake LLM_Client that, for every valid SceneContext, the Guide_Endpoint passes a context deep-equal to the received SceneContext to the LLM_Client, and a test that the Guide_Endpoint includes the grounding instructions of Requirement 11.9.
7. THE Living_Museum_App SHALL include a test that, for a question about a fact absent from the catalog, the Scripted_Guide replies that it does not have the information.
8. THE Living_Museum_App SHALL include component tests, without a WebGL context, that assert: the Panorama_Viewer region is the main landmark; the Chat_Drawer starts collapsed and opens and closes by control and by Escape; the Details_Panel appears only with a focused Exhibit; the Credits_Panel lists every Attribution; Hotspots and controls have accessible names and are keyboard-operable; and reduced-motion disables animations.
9. THE Living_Museum_App SHALL include a test that sends hostile Guide_Replies (unknown action types, entity ids of other Galleries, non-object values, markup in text) and checks that the displayed state is unchanged and no markup is rendered as HTML.
10. THE Living_Museum_App SHALL include Guide_Endpoint tests with a fake LLM_Client that cover a valid reply, an oversized body, a malformed body, invalid LLM output, an LLM timeout, an LLM failure, and a missing LLM_API_Key.
11. THE Living_Museum_App SHALL include a test that a sentinel LLM_API_Key value appears in no Guide_Endpoint response body, including error responses.
12. THE Living_Museum_App SHALL include a test that runs the build with a sentinel LLM_API_Key in the environment and checks that the value appears in no file of the client bundle output.
13. WHEN `pnpm test` is run in `apps/living-museum/`, THE Living_Museum_App SHALL run all tests without a WebGL context, a network connection, or a real LLM_API_Key.

### Requirement 13: Development-only calibration mode

**User Story:** As a developer, I want to read the yaw and pitch of any point in a panorama, so that I can place Exhibit and navigation Hotspots accurately.

#### Acceptance Criteria

1. WHERE the build is a development build (`import.meta.env.DEV` is true), THE Panorama_Viewer SHALL provide the Calibration_Mode, toggled by a control labeled "Calibrate".
2. WHILE the Calibration_Mode is on, WHEN the Developer clicks or drags in the Panorama, THE Calibration_Mode SHALL display the yaw and pitch of the pointer position in radians, rounded to 3 decimals.
3. WHILE the Calibration_Mode is on, THE Calibration_Mode SHALL display a JSON snippet `{ "yaw": <number>, "pitch": <number> }` for the last selected point, with a control labeled "Copy" that copies the snippet to the clipboard.
4. WHILE the Calibration_Mode is on, THE Living_Museum_App SHALL leave the Museum_Catalog and the SceneMind_Runtime state unchanged and SHALL call no `execute`, `syncFocus`, or handler.
5. THE Screen_Projection SHALL convert a screen coordinate into a View_Position through a view interface, so that tests replace the Marzipano view with a fake.
6. FOR ALL screen coordinates in the viewport and every fake view, THE Screen_Projection SHALL return a yaw in [-π, π] and a pitch in [-π/2, π/2], and projecting a View_Position to the screen and back SHALL return the original View_Position within 0.001 radians (round-trip property).
7. THE production build output SHALL contain no Calibration_Mode code, no "Calibrate" control text, and no Screen_Projection module.
8. THE Living_Museum_App SHALL include a test that builds in production mode and asserts the absence required by criterion 7.

### Requirement 14: Release verification and fixture separation

**User Story:** As a maintainer, I want a release check that blocks unverified or placeholder content, so that no fabricated or unchecked exhibit ships.

#### Acceptance Criteria

1. THE Living_Museum_App SHALL store Fixture_Catalogs and fixture Panoramas only under `apps/living-museum/fixtures/`, mark each Fixture_Catalog with `"fixture": true`, and use them only in tests and in the development build.
2. THE Release_Catalog SHALL be loaded by the production build, and THE production build SHALL include no file from `apps/living-museum/fixtures/`.
3. THE Release_Check SHALL fail with a message that names each offending Exhibit WHEN any Exhibit in the Release_Catalog lacks a Position_Verification with a non-empty verifier, a valid date, and the status `visible`.
4. THE Release_Check SHALL fail WHEN the Release_Catalog contains `"fixture": true`, an asset path under `fixtures/`, or a placeholder marker (`TODO`, `TBD`, `PLACEHOLDER`, `lorem ipsum`, case-insensitive) in any string value.
5. THE Release_Check SHALL fail WHEN a Panorama file referenced by the Release_Catalog does not exist, or WHEN the Asset_Checklist lists any required asset with status `missing`.
6. WHEN `pnpm build` runs in production mode, THE Living_Museum_App SHALL run the Release_Check first and abort the build on failure.
7. THE Living_Museum_App SHALL NOT generate, default, or infer any Position_Verification value in code, scripts, or agent output, and the Catalog_Schema SHALL provide no default for Position_Verification fields.
8. THE Living_Museum_App SHALL include Release_Check tests, using Fixture_Catalogs, that cover each failure condition in criteria 3 to 5 and a passing case.

### Requirement 15: Asset preparation and documentation

**User Story:** As a developer, I want required assets identified before implementation and the app documented, so that missing content is known up front and the app can be set up and run by others.

#### Acceptance Criteria

1. THE project SHALL contain `apps/living-museum/ASSETS.md` before any Release_Catalog content is written.
2. THE Asset_Checklist SHALL list for each required asset its filename, format, the Gallery or Exhibit it serves, the required catalog fields, a status of `available` or `missing`, and for each available asset its source, license, and license URL.
3. THE Asset_Checklist SHALL list at least 2 Panoramas (equirectangular JPEG or WebP, with a stated minimum width in pixels) and, for each Exhibit, the Exhibit_Details fields and the source of the facts.
4. WHILE the Asset_Checklist lists a required asset as `missing`, THE Release_Catalog SHALL contain no entry for that asset and no stand-in for it.
5. THE `apps/living-museum/README.md` SHALL document setup, asset requirements with a link to the Asset_Checklist, configuration including each environment variable, run instructions for `dev`, `build`, `test`, and `release:check`, use of the Calibration_Mode, and the manual verification process for Position_Verification.

### Requirement 16: No fabricated content

**User Story:** As a maintainer, I want an explicit rule against invented content, so that every asset, fact, and verification result is real and traceable.

#### Acceptance Criteria

1. THE Release_Catalog SHALL contain only Panoramas, Exhibit_Details, and Attributions that come from the cited source of the entry.
2. THE Living_Museum_App SHALL treat any entry without a complete Attribution as invalid under the Catalog_Schema.
3. THE Scripted_Guide and THE Guide_Endpoint instructions SHALL limit factual statements to values present in the SceneContext.
4. IF a requested fact is absent from the SceneContext, THEN THE Scripted_Guide and THE Guide_Endpoint instructions SHALL state that the information is not available.
5. THE Living_Museum_App scripts SHALL NOT write a Position_Verification, an Attribution, or an Exhibit fact that a human did not supply from a real source or check.
