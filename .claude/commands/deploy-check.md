---
description: Pre-deploy checklist against spec section 11 (environment/secrets) and section 14 (polish + deploy)
---

Before deploying (spec §14), verify each of these explicitly — don't just
assume:

1. **No secrets in the browser bundle.** `npm run build`, then grep
   `dist/assets/*.js` for `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, or any
   raw service-role JWT. Only `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` should be present, and the anon key must
   actually be the `anon` role, not `service_role` (decode the JWT `role`
   claim to confirm — do not print the key itself into any log or chat).
2. **Env vars set on the host** (Vercel/Cloudflare dashboard, not `.env`):
   `LLM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ACTIVE_USER_ID`.
3. **RLS is enabled** on `users`, `facts`, `messages`, `character_state`,
   `important_dates` (spec §5b).
4. **Two seed users exist** in `users` — the real person and `is_test =
   true` test user — and `ACTIVE_USER_ID` points at the real person, not
   the test user (spec §9 step 6).
5. **Build is clean:** `npm run build` and `npm run lint` both pass.
6. **Error states work:** kill `/api/chat` locally and confirm the UI shows
   the `confused` mood + the in-character fallback line (spec §8), not a
   raw error or a blank screen.
7. Mobile layout and the mute toggle both work (spec §7, §14).
