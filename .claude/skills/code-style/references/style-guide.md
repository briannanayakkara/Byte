# Byte style guide

## React / TypeScript

- Function components + hooks only.
- One component per file; colocate small subcomponents only if they're never
  reused (e.g. a single `<Blink>` helper used only by the character mesh).
- Props interfaces are named `<Component>Props` and declared just above the
  component, not in a separate types file, unless shared across files.
- The `Mood` type lives in `src/types.ts` (create it in step 3 when moods are
  introduced) as:
  ```ts
  export type Mood =
    | 'happy' | 'curious' | 'sleepy' | 'excited'
    | 'confused' | 'neutral' | 'lovestruck'
  ```
  Import this everywhere — the character component, the `/api/chat` response
  type, and the Supabase `character_state.mood` column all reference the
  same seven values (spec §5, §6, §5b). Don't let any of them drift into a
  separately-typed string.

## Styling

- Tailwind utility classes directly in JSX. No CSS Modules, no styled-components.
- `src/index.css` contains only `@import "tailwindcss";` — don't add global
  CSS here; use Tailwind's `@theme`/`@layer` directives in that same file if
  a design token is truly needed.
- Mobile-first: base classes target small screens, add `sm:`/`md:` overrides
  for larger ones (spec §7 "mobile-friendly").

## Three.js / R3F

- Keep the render-loop code (`useFrame`) minimal and allocation-free per
  frame — reuse `Vector3`/`Quaternion` instances across frames rather than
  constructing new ones (standard R3F perf practice, matters once idle
  animations + mouth-tracking are both running at once per spec §6).
- Mood transitions lerp over ~200-300ms (spec §6) — implement as a lerp
  toward a target weight in `useFrame`, not a step change.

## Linting

- `oxlint` via `npm run lint` (see `.oxlintrc.json`). Don't add ESLint/Prettier
  configs on top of it — `post-write-format` hook already runs
  `oxlint --fix` on every edited file.

## Secrets

- Anything read via `import.meta.env.VITE_*` ships to the browser. Never put
  `LLM_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` behind a `VITE_` prefix — see
  `skills/supabase-patterns/references/rls-policies.md` and spec §11.
