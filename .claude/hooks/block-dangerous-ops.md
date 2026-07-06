# block-dangerous-ops

**Event:** `PreToolUse`, matcher `Bash`
**Script:** `block-dangerous-ops.mjs`
**Wired in:** `.claude/settings.local.json`

Blocks Bash commands that would undo work or defeat the secret/RLS boundary
this project depends on (see spec §4 "Key rules" and §5b "Enable Row Level
Security on every table"). Exits `2` (block) with a reason on stderr; exits
`0` (allow) otherwise.

## Rules enforced

| Pattern | Why |
|---|---|
| `rm -rf /`, `rm -rf *`, `rm -rf ~` | Irreversible mass deletion |
| `git push --force` / `-f` | Can overwrite the shared `origin` history on `git@github.com:briannanayakkara/Byte.git` |
| `git reset --hard` | Discards uncommitted work silently |
| `--no-verify`, `--no-gpg-sign` | Bypasses whatever verification hooks exist |
| `DROP TABLE`, `TRUNCATE TABLE` | Destroys the `users` / `facts` / `messages` / `character_state` / `important_dates` tables from spec §5b — there is no seed script to replay this automatically |
| `DISABLE ROW LEVEL SECURITY` | RLS must stay on for every table per spec §5b, even though the service-role key currently bypasses it |
| Literal `SUPABASE_SERVICE_ROLE_KEY` / `LLM_API_KEY` in a command | Usually means the command is about to echo, log, or curl a secret somewhere it shouldn't go |
| `cat .env` / `type .env` | Prints secrets to a transcript that may be logged |

## Rationale

This project's entire security model is "the browser only ever calls
`/api/chat`; the service-role key and LLM key never leave the server"
(spec §4, §11). The riskiest way to break that isn't a code bug — it's an
agent running a shell command that leaks or nukes something irreversibly.
This hook is a last line of defense, not a substitute for reviewing diffs.
