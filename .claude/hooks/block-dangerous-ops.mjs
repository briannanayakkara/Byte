#!/usr/bin/env node
// PreToolUse hook, matcher: Bash. See block-dangerous-ops.md for the policy this enforces.
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const cmd = input?.tool_input?.command ?? '';

  const rules = [
    { pattern: /rm\s+-rf\s+(\/(?!c\/Users)|\*|~)/i, reason: 'rm -rf against root/home/wildcard' },
    { pattern: /git\s+push\s+(--force|-f)\b/i, reason: 'force push' },
    { pattern: /git\s+reset\s+--hard/i, reason: 'git reset --hard' },
    { pattern: /--no-verify|--no-gpg-sign/i, reason: 'hook or signature bypass flag' },
    { pattern: /\b(DROP|TRUNCATE)\s+TABLE\b/i, reason: 'destructive SQL against a Supabase table' },
    { pattern: /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i, reason: 'disabling RLS — every table in the spec (section 5b) must stay RLS-on' },
    { pattern: /SUPABASE_SERVICE_ROLE_KEY|LLM_API_KEY/, reason: 'command references a server-only secret name — likely about to print or ship it' },
    { pattern: /cat\s+[^\n]*\.env\b|type\s+[^\n]*\.env\b/i, reason: 'dumping .env contents to stdout' },
  ];

  for (const { pattern, reason } of rules) {
    if (pattern.test(cmd)) {
      console.error(`block-dangerous-ops: blocked (${reason})`);
      process.exit(2);
    }
  }
  process.exit(0);
});
