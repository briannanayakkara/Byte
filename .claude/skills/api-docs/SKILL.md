---
name: api-docs
description: The /api/chat request/response contract and the data models it reads/writes in Supabase. Use when building or calling the serverless function (spec section 5, steps 5-9).
---

`references/endpoints.md` has the `/api/chat` request/response shape.
`references/data-models.md` has the TypeScript types mirroring the Supabase
schema from spec §5b — keep these in sync with the actual `.sql` migrations
as the schema evolves; this doc is descriptive, the database is the source
of truth.
