#!/usr/bin/env node
// PreToolUse hook, matcher: Bash. See pre-commit-lint.md.
import { execSync } from 'node:child_process';

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
  if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch {
    console.error(
      'pre-commit-lint: `npm run build` (tsc -b && vite build) failed — fix errors before committing.'
    );
    process.exit(2);
  }
  process.exit(0);
});
