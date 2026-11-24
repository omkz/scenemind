---
inclusion: auto
name: asset-checklist
description: How to identify required assets during spec creation for a SceneMind application and when to write ASSETS.md. Use when creating a spec for an application, planning scenes, or when assets (images, models, audio, text content) are mentioned.
---

# Asset Checklist

Identify asset needs while creating the spec, without waiting to be asked.

## When to create ASSETS.md

Create `apps/<app-name>/ASSETS.md` during requirements preparation, before design and tasks, and only if the app needs external assets or content, such as images, models, audio, factual text, or measured positions. If everything is generated in code or the app is text only, skip the file and say so in the requirements.

## Identify the needs

Check each category and list only what the app uses:

- **Visuals** per scene: panorama, background, 3D model, map, sprites, video.
- **Entity media**: a picture, model, or audio clip for entities that need one.
- **Content**: descriptions, facts, and metadata for scenes and entities.
- **Positions**: where entities appear in their scene (angles, coordinates).

Mark each item `required` or `optional`.

## Accepted origins

- Provided by the developer.
- Procedurally generated.
- AI-generated.
- Licensed for the use: public domain, CC0, CC BY, CC BY-SA, or another license that permits it.

Record the origin of each item. Licensed items need credit, source URL, license, and license URL, plus a note on any changes. AI-generated items need the tool or model name.

## Integrity

- Never fabricate factual information, attribution, licenses, or verification results. If something is not provided, mark it `missing`.
- Factual content needs a source.
- Fictional content is fine when the application is fictional or creative. Mark it `fictional` and do not present it as fact.
- Verify positions manually only when they must match something real, such as an object in a photo. A person enters their name and the date. Never fill this in for them. Skip it for fictional or procedurally placed entities.

## Credentials

Credentials are configuration, not assets. Keep API keys and model names out of `ASSETS.md`. List variable names in `.env.example` and the app README.

## Status and release

- Statuses: `available` or `missing`. Fixtures are for development and tests only. Mark them clearly and keep them out of release.
- Only a `required` item that is `missing` blocks release. An `optional` item that is missing does not.

## Template

```markdown
# Asset Checklist: <app-name>

| Item | Serves | Format | Origin | Required | Status | Credit, source, license |
| --- | --- | --- | --- | --- | --- | --- |
| public/<file> | <scene or entity id> | <format, minimum size> | provided / generated / AI-generated / licensed / fictional | yes | missing | |

## Position verification (only if positions must match something real)

| Entity | Verified by | Date |
| --- | --- | --- |
| <entity id> | | |
```

## After writing it

Give the developer a short summary: each missing item, its expected filename and format, and where to put it. Then wait before writing release content.
