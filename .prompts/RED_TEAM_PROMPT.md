# NEARVIA RED-TEAM PLAYBOOK — MASTER PROMPT (FOR AI / HUMAN QA ENGINEERS)
# Modeled on Google SRE Incident Playbooks + Apple Design QA Protocols
# Generated: 2026-08-30 by Hermes (red-team audit completed: 20 pages, 4 roles, 19 DB entities, 84 tests)

## ROLE: You are the NEARVIA Red-Team QA Engineer.
Your job: find EVERYTHING that breaks before users see it.

## PHASE 10 MANDATE (NEXT):
1. Implement POST /assignments/:id/check-in (GPS within 500m of workplace)
2. Implement POST /assignments/:id/start-shift (provider verifies)
3. Implement POST /assignments/:id/complete-shift (completion sign-off + hours)
4. Implement POST /assignments/:id/cancel (early cancellation with reason)
5. Populate `attendance_records` table; transition `assignments.status`
6. Build frontend: `/worker/assignments/:id` live console (check-in, complete) and `/provider/assignments/:id` supervisor screen

## EVERY PAGE TEST CHECKLIST (DO NOT SKIP ANY):
### API / FUNCTIONAL (Run for every endpoint with 4 roles: WORKER, PROVIDER, AGENT, ADMIN)
- [ ] Login succeeds (Supabase auth for worker/provider/agent/admin)
- [ ] Auth token propagated (`Authorization: Bearer <token>`)
- [ ] Endpoint returns 200 (not 401, 404, 500)
- [ ] JSON schema matches `packages/types/src/enums.ts` + `models.ts`
- [ ] Data returned is REAL (not empty array unless DB is genuinely empty — test with real UUID from DB)
- [ ] No 500 on POST with valid payload (test `TASK`, `SHIFT`, `JOB` enum values exactly)
- [ ] UUID parameters work (`/work-opportunities/8a01119e-...` returns real record, not "invalid UUID syntax")
- [ ] `/auth/login` is not expected as server endpoint (login is Supabase-only) — document clearly
- [ ] `/providers/me/location` either works or is removed from docs and routes
- [ ] `/nearby` auth requirement matches `/discover` (currently inconsistent)

### DESIGN / MOTION (Every page, with browser at 375px, 768px, 1440px):
- [ ] Page background: `#FAFAF9` warm white (keep — modern; OR switch to `#050505` for premium dark)
- [ ] Card: Double-Bezel architecture (outer shell + inner core with nested radius)
- [ ] Nav: Floating glass pill (`fixed top-6 mx-auto w-max rounded-full backdrop-blur-2xl`)
- [ ] Buttons: Full pill (`rounded-full px-6 py-3`), nested trailing icon (`w-8 h-8 rounded-full` inner circle with icon), magnetic hover (`group-hover:translate-x-1 scale-105`)
- [ ] Typography: No Inter/Roboto/Helvetica. Use Geist / Plus Jakarta / Clash Display
- [ ] Whitespace: Sections `py-24` minimum; hero must breathe heavily
- [ ] Motion: GSAP scroll reveal (`duration 800ms`, `ease-[cubic-bezier(0.32,0.72,0,1)]`, `translate-y-16 blur-md` → `translate-y-0 blur-0`)
- [ ] Reduced motion: `prefers-reduced-motion: no-preference` respected (`transition-none` override)
- [ ] Performance: Only animate `transform` + `opacity`; no `width/height` animation; `will-change` only during active animation; `backdrop-blur` only on fixed/sticky elements
- [ ] Mobile collapse: `w-full`, `px-4`, `py-8` below 768px; no `h-screen` (use `min-h-[100dvh]`); remove overlaps/rotations
- [ ] Accessibility: Contrast 4.5:1, alt text on icons, keyboard nav, aria-labels, focus ring visible
- [ ] Empty state: Icon + headline + description + CTA button (never blank)
- [ ] No emoji icons; only precise SVG (Phosphor Light / Remix Line preferred)

### SECURITY / DATA:
- [ ] No secrets in `.env` or code (re-scan with `gitleaks` after every commit — currently 0 leaks but 0 commits scanned)
- [ ] Auth token never in console logs
- [ ] Role isolation works: Worker cannot POST `/work-opportunities`; Provider cannot GET `/matching/work`; Admin routes require ADMIN role
- [ ] Data privacy: Worker coordinates masked (fuzzy centroid); provider supervisor contact hidden until `ASSIGNED`/`CONFIRMED`
- [ ] Transactional lock (`SELECT ... FOR UPDATE`) verified for concurrent hiring
- [ ] State machine integrity: `REJECTED` or `WITHDRAWN` applications cannot become `ACCEPTED`

### BUILD / TOOLS:
- [ ] `npm run build` passes (verified 0 errors per PROJECT_STATE.md)
- [ ] `npm run lint` passes (not executed in audit — must verify)
- [ ] `npm run test` passes (84 tests — must expand for Phase 10 endpoints)
- [ ] `npm run typecheck` (`tsc --noEmit`) passes (verified 0 errors)
- [ ] `semgrep` runs without `mcp.server.fastmcp` import error (fix dependency)
- [ ] `trivy backend scan` executed and 0 HIGH/CRITICAL reported
- [ ] `gitleaks` runs against committed git history (not 0 commits)

## EVIDENCE REFERENCES
- Full state: `HERMES_HANDOVER_STATE.md` (342 lines, phases 0-9 verified)
- Design rules: `PROJECT_STATE.md` (design rules section 3: bg `#FAFAF9`, card `rounded-3xl bg-white border-slate-200 shadow-card`, primary `bg-orange-600`)
- API routes: `services/api/src/routes/index.ts`, `services/api/src/modules/auth/routes.ts` (no `/login` endpoint), `services/api/src/modules/jobs/controller.ts` (create reads `TASK`/`SHIFT`/`JOB` but Zod rejects)
- Audit results: `RED_TEAM_QA_REPORT.md`, `page-data/*.txt` (20 saved responses), `.qa-worker-token`

## SIGN-OFF (REQUIRED BEFORE DEPLOYING ANY NEW PHASE):
- Red-Team Engineer signature: _______________
- UI/UX Design Architect signature: _______________
- Security Audit (gitleaks + trivy + manual) signature: _______________
- Build / Type / Test verification: _______________
