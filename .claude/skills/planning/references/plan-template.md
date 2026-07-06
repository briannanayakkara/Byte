# Plan template (per build step)

Use this shape when planning a single step from spec §9.

```
## Step <N>: <name from spec §9>

**Spec text:** "<verbatim quote from §9>"
**Related sections:** <e.g. §5b for schema, §6 for model requirements>

### Changes
- <file>: <what changes>
- <file>: <what changes>
- New dependency: <name> — <already in spec §3? if not, flag for approval>

### Verify
<the step's own done-criterion, quoted or closely paraphrased from §9,
e.g. "Verify it shows up centered and cute" for step 2>

### Open questions / ambiguity
<anything the spec doesn't fully specify — e.g. exact model source, exact
relationship-level thresholds — flag rather than deciding silently>
```

Keep it short — this is a checkpoint before implementation, not a design
document. The spec itself is the design document.
