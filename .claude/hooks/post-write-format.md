# post-write-format

**Event:** `PostToolUse`, matcher `Edit|Write`
**Script:** `post-write-format.mjs`
**Wired in:** `.claude/settings.local.json`

After any `Edit`/`Write` touches a `.ts`/`.tsx`/`.js`/`.jsx` file, runs
`npx oxlint --fix <path>` on just that file (this repo uses `oxlint`, not
ESLint/Prettier — see `package.json`'s `lint` script and
`.oxlintrc.json`). Non-JS/TS files (`.glb`, `.css`, `.md`, SQL) are skipped.

Failures are printed but never block the edit — oxlint can flag issues it
can't autofix (e.g. unused vars in a half-written function), and blocking
mid-edit would be more annoying than useful. `pre-commit-lint.md` is the
hook that actually gates on lint/build passing, at commit time.
