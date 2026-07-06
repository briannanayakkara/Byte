---
name: code-style
description: Code style conventions for the Byte codebase (React/TS/Tailwind/R3F). Use when writing or reviewing any src/ or api/ file.
---

Read `references/style-guide.md` for the full conventions. Summary:

- Function components only, no class components.
- TypeScript strict mode is on (`tsconfig.app.json`) — no `any` without a
  comment explaining why it's unavoidable.
- Styling is Tailwind utility classes in JSX; no new `.css` files beyond
  `src/index.css` (the single `@import "tailwindcss";` entry point).
- Linting is `oxlint` (see `.oxlintrc.json`), not ESLint — don't add an
  ESLint config alongside it.
- The `mood` value is a single shared union type, not a raw string, defined
  once and imported everywhere it's used (character component, `/api/chat`
  response type, Supabase `character_state.mood` column).
