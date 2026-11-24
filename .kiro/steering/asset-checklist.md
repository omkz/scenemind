---
inclusion: auto
name: asset-checklist
description: How to identify required assets during spec creation for a SceneMind application and when to write ASSETS.md. Use when creating a spec for an application, planning scenes, or when assets (images, models, audio, text content) are mentioned.
---

# Asset Checklist

Identify asset needs while creating the spec, without waiting to be asked. Skip this whole step when the app needs no external assets or content, and say so in the requirements.

## Inspect first
Before asking for anything, look at what exists: `apps/<app-name>/`, its assets directory, and files the developer mentioned or attached. Match existing files to needs by name and content. Mark matches `available` and ask only for the rest.

## Identify the needs
Check each category and list only what the app uses:
- **Visuals** per scene: panorama, background, 3D model, map, sprites, video.
- **Entity media**: a picture, model, or audio clip for entities that need one.
- **Content**: descriptions, facts, and metadata for scenes and entities.
- **Positions**: where entities appear in their scene (angles, coordinates).

Mark each item `required` or `optional`.

## Ask for assets
- Create the intake directory `apps/<app-name>/assets/` when it is needed. Developers drop files there. Ask them to add subfolders only if they want to.
- Leave the final layout to the application. During implementation, move or copy files to where the viewer and build need them (for example `public/`), and update the checklist paths. Never delete or overwrite files the developer provided.
- Tell the developer which files to provide, the format and minimum size, and the exact folder to put them in.
- Ask for each asset's title, a short description, and a source link when they matter. Accept natural language. Do not require a table or a special format. Extract the details yourself.
- Ask only for what is missing, and only what the app needs.

## Accepted origins
- Provided by the developer.
- Procedurally generated.
- AI-generated.
- Licensed for the use: public domain, CC0, CC BY, CC BY-SA, or another license that permits it.

Record the origin of each item. Licensed items need credit, source URL, license, and license URL, plus a note on any changes. AI-generated items need the tool or model name.

## Integrity
- Never fabricate factual information, attribution, licenses, or verification results. If something is not provided, mark it `missing`.
- Preserve the developer's titles and descriptions as given.
- Factual content comes from the developer or a verified source, and needs a source.
- Fictional content may be generated when the application is fictional or creative. Mark it `fictional` and do not present it as fact.
- Verify positions manually only when they must match something real, such as an object in a photo. The developer confirms them. Never fill in their name or date. Skip this for fictional or procedurally placed entities.

## Credentials
Credentials are configuration, not assets. Keep API keys and model names out of `ASSETS.md`. List variable names in `.env.example` and the app README.

## ASSETS.md
`apps/<app-name>/ASSETS.md` is Kiro's internal development checklist. Kiro creates and updates it from the developer's answers and the files found. The developer is never asked to edit it.

- Statuses: `available` or `missing`. Fixtures are for development and tests only. Mark them clearly and keep them out of release.
- Only a `required` item that is `missing` blocks release. An `optional` item that is missing does not.

```markdown
# Asset Checklist: <app-name>

| Item | Serves | Format | Origin | Required | Status | Credit, source, license |
| --- | --- | --- | --- | --- | --- | --- |
| assets/<file> (intake path, update if moved) | <scene or entity id> | <format, minimum size> | provided / generated / AI-generated / licensed / fictional | yes | missing | |

## Position verification (only if positions must match something real)

| Entity | Verified by | Date |
| --- | --- | --- |
| <entity id> | | |
```

## Summary for the developer
Include this in the consolidated proposal: what is already available, each missing item with its expected filename, format, and folder, and what Kiro will do meanwhile (fixtures). Then wait for approval before technical design or release content.
