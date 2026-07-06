# pre-commit-lint

**Event:** `PreToolUse`, matcher `Bash`
**Script:** `pre-commit-lint.mjs`
**Wired in:** `.claude/settings.local.json`

When the proposed Bash command contains `git commit`, runs `npm run build`
(`tsc -b && vite build`) first. If it fails, the hook exits `2` and the
commit is blocked with the build error surfaced back to Claude to fix.
Any other Bash command passes straight through (exit `0`) without running
a build.

This project has no test suite yet (see `skills/testing-patterns/SKILL.md`
for the plan once one exists) — a clean typecheck + build is the only cheap
signal available at commit time until then.
