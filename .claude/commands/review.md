---
description: Review the current diff for security leaks and spec drift before finishing a build step
---

Review the current uncommitted diff (`git diff` / `git status`) against
`docs/specs/Byte-app-spec.md`. Dispatch to the `code-reviewer` subagent
(`.claude/agents/code-reviewer.md`) rather than reviewing informally — it
knows this project's specific risk list (secret boundary, RLS, mood
contract, multi-user scoping).

Report findings back with file:line references. If the diff spans a
build-order step from spec §9, note which step it corresponds to.
