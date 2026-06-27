# AGENTS.md

This file provides guidelines for AI agents and coding assistants when working with code in this repository

## Scope

- These guidelines applies to the entire `tijaratk-backend` project.

## Tech stack and tooling

- This is a TypeScript Node.js API (NestJS-style layout under `src/`).
- Use `pnpm` as the package manager (a `pnpm-lock.yaml` file is present).
- When adding or updating scripts, keep them consistent with existing entries in `package.json`.

## Code style and structure

- Follow the existing patterns in `src/` for module structure, dependency injection, and file naming.
- Always add swagger docs to new routes.
- Prefer descriptive variable and function names over abbreviations.
- Keep functions and classes focused; avoid unnecessary complexity or over-engineering.

## Documentation

- Always add swagger docs to new routes and make sure types are correct.
- Always add TypeDoc comments to new functions and classes.

## Adding & Editing files

- Always add TypeDoc comments to new functions and classes.
- Always add swagger docs to new routes and make sure types are correct.
- Always add @ApiBody() to new routes with typed DTOs.
- Always use nestjs cli to generate files.
- Keep changes minimal and targeted to the user’s request.
- Do not rename or move files unless explicitly required to satisfy the request.
- Avoid making cross-cutting refactors without clear user direction.
- Do not create migration files unless explicitly required to satisfy the request.

## Testing and verification

- Unit tests are not allowed in the codebase. Do not write spec/unit test files.

## Database schema

- Always use `SERIAL` for auto-incrementing primary keys no UUIDs.
- For JSONB columns, always use `jsonb` instead of `json`.
- For relations, always use `Relation<Post[]>` instead of `Post[]`.

## RLS migrations

- When writing migrations that touch RLS tables, do data backfills before enabling RLS on the table.
- If reading from an existing RLS-protected table, temporarily disable RLS inside the migration.
- Re-enable `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` immediately after the trusted data operation.
- Test migrations from an empty DB with `migrate reset`, not only against a dev DB that already has state.
- Be careful with `FORCE ROW LEVEL SECURITY`; it makes even the table owner subject to policies, so migration reads can fail.

## Dependencies and tooling changes

- Do not add new dependencies unless they are necessary to satisfy the request.
- If a new dependency is required, prefer small, well-maintained libraries and explain why they are needed in your final message.

## Communication with the user

- Be concise and direct; avoid long explanations unless the user asks for more detail.
- When making non-trivial changes, briefly summarize what you changed and where (file paths and key symbols).
- If you encounter unclear requirements, ask for clarification instead of guessing behavior that could affect production logic.

## Ask Before

- package installs and dependencies updates
- git push, pull, merge
- deleting files, chmod
- running full build

**Always read & summarize before proposing a clear plan and write your plan in a markdown file and then ask before implementation / committing.**
**Write your plan in a markdown file in `.docs/plans` directory in this format `resource_name-action-description.md` and then ask before implementation / committing.**
