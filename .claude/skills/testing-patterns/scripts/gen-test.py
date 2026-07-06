#!/usr/bin/env python3
"""Scaffold a Vitest test file for a given module.

Usage: python gen-test.py src/lib/relationshipLevel.ts

Writes a sibling `<name>.test.ts` next to the target module with a Vitest
boilerplate importing the module's exports. Does not install or configure
Vitest -- see skills/testing-patterns/SKILL.md for when to add it.
"""
import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    target = Path(sys.argv[1])
    if not target.exists():
        print(f"error: {target} does not exist")
        sys.exit(1)

    module_name = target.stem
    test_path = target.with_name(f"{module_name}.test{target.suffix}")
    if test_path.exists():
        print(f"error: {test_path} already exists")
        sys.exit(1)

    source = target.read_text(encoding="utf-8")
    exported = re.findall(r"export (?:function|const) (\w+)", source)
    import_names = ", ".join(exported) if exported else "/* TODO: exports */"

    import_path = f"./{module_name}"
    content = f"""import {{ describe, expect, it }} from 'vitest'
import {{ {import_names} }} from '{import_path}'

describe('{module_name}', () => {{
  it.todo('add real cases')
}})
"""
    test_path.write_text(content, encoding="utf-8")
    print(f"wrote {test_path}")


if __name__ == "__main__":
    main()
