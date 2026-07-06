#!/usr/bin/env node
// PostToolUse hook, matcher: Edit|Write. See post-write-format.md.
import { execFileSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const path = input?.tool_input?.file_path ?? '';
  if (!/\.(ts|tsx|js|jsx)$/.test(path)) process.exit(0);

  try {
    execFileSync('npx', ['oxlint', '--fix', path], { stdio: 'inherit' });
  } catch {
    // oxlint exits non-zero when it finds issues it can't autofix — surface
    // them but don't block the edit itself, that's what pre-commit-lint is for.
    console.error(`post-write-format: oxlint flagged remaining issues in ${path}`);
  }
  process.exit(0);
});
