# NEARVIA — RED-TEAM QA AUDIT + DESIGN AUDIT + MASTER REPORT
# Generated: 2026-08-30 | By Hermes (UI/UX Pro Max + High-End Visual Design skills loaded)
# Thinking like: Google Search (SRE red-team) + Apple Design Studio (motion/aesthetic audit)

## 1. EXECUTIVE SUMMARY (LIKE A BIG TECH INCIDENT REVIEW)
Status: 20/20 pages load (HTTP 200) — but the SURFACE IS BROKEN.
- 84 backend tests pass → does NOT mean production works
- Design: clean warm cards (#FAFAF9), modern, but ZERO motion / 3D / modern premium depth
- Missing Phase 10 (attendance/check-in/completion) — confirmed from HERMES_HANDOVER_STATE
- Security audit: gitleaks 0 leaks ✓; semgrep BROKEN (missing `mcp` module) ✗; trivy not executed ✗
- Admin login FAILS (supabase returns no token) — role-based routes return 401
- Provider POST /work-opportunities returns 500 (Zod validation rejects 'TASK'/'SHIFT'/'JOB')
- `/providers/me/location` returns 404 (documented endpoint not mounted)
- `/work-opportunities/nearby` requires auth but `/discover` does not (inconsistent)
- `/auth/login` is NOT a server endpoint — login is Supabase-only — but docs say it exists

## 2. API RED-TEAM RESULTS (EVERY ENDPOINT TESTED WITH 4 ROLES)
Public: health ✓, categories ✓, skills ✓, discover ✓ (empty data — no seed work in DB for test user location)
Worker auth: login ✓, /auth/me ✓, /workers/me ✓, /matching/work ✓, /applications/mine ✓, /assignments/mine ✓
Provider auth: login ✓, /providers/me ✓, /work-opportunities/mine ✓
Provider FAIL: /providers/me/location 404, POST /work-opportunities 500, GET /work-opportunities/:id 500 (invalid UUID syntax handled poorly)
Admin auth: login FAIL (no Supabase user) → all /admin/* return 401
Agent auth: not fully tested (scope — needs agent profile linked to user)

## 3. SECURITY SCAN RESULTS
- gitleaks: 0 leaks (scanned 0 commits — no git history indexed; needs `git init` + commit for real scan)
- semgrep: BROKEN — `ModuleNotFoundError: No module named 'mcp.server.fastmcp'` (audit tool failure)
- trivy: NOT EXECUTED — missing from pipeline
- CORS: present in middleware (verified from services/api/src/app.ts line 45 area) — OK
- JWT auth: server verifies `authenticateUser` — OK
- Role guards: `requireRole` enforced — OK (but admin fails upstream due to missing user)

## 4. DESIGN / FRONTEND AUDIT (UI/UX PRO MAX + HIGH-END VISUAL DESIGN)
Strengths (positive — keep these):
- Modern warm white card design (#FAFAF9 bg, rounded-3xl cards, shadow-card) — aligns with 2026 modern SaaS
- Clean typography, Lucide icons, Leaflet map component present
- Responsive routes for worker/provider/agent/admin
- 5-step wizard for work creation with progressive disclosure

Critical gaps (like an Awwwards-level audit):
- NO 3D effects / depth: cards sit flat — no double-bezel (Doppelrand), no nested architecture
- NO motion choreography: no GSAP, no stagger reveals, no fluid hamburger morph, no scroll-triggered entry animations
- NO premium texture: no glassmorphism backdrop-blur, no radial mesh gradients, no film-grain overlay
- Font: likely Inter or system sans — banned by high-end rules; should be Geist / Plus Jakarta / Clash Display
- Navigation: sticky navbar at top — not floating glass pill detached (`mt-6 mx-auto w-max rounded-full`)
- Buttons: no button-in-button icon pattern; no magnetic hover physics (`scale-105` on inner icon, diagonal translate)
- Mobile: likely collapses fine but needs `min-h-[100dvh]` override (iOS Safari viewport jump risk)
- Whitespace: sections likely `py-8` or `py-12` — needs `py-24` to `py-40` for luxury spacing
- Color tokens: uses raw hex / Tailwind defaults — needs semantic token variables (primary, surface, text, border)
- Empty states: must have icon + description + CTA (per design rules) — not verified per page
- No reduced-motion (`prefers-reduced-motion`) support visible

## 5. MISSING / BROKEN THINGS (MASTER CHECKLIST — LIKE A PRODUCT ROADMAP REVIEW)
Phase 10 (work execution, attendance check-in, GPS verification, shift start/complete): COMPLETELY MISSING
- Backend: POST /assignments/:id/check-in, /start-shift, /complete-shift, /confirm, /cancel — not mounted
- DB: `attendance_records` table defined but never populated (no route uses it)
- Frontend: Work execution screen (live shift console, GPS check-in modal, supervisor sign-off) — NOT BUILT
Phase 11 (reviews, reputation, disputes): `reviews` and `disputes` routes exist but not fully audited
Phase 14 (mobile client `apps/mobile`): reserved workspace — empty / not started
Type coverage: `packages/types/src/` exists; `packages/validation/src/` exists; no `types.ts` file directly at `packages/types/src/`; `types` package uses `enums.ts` + `models.ts`
Build: `npm run build` and `npx tsc --noEmit` both verified 0 errors by user (PROJECT_STATE.md confirms)
Tests: 84 passing (per HERMES_HANDOVER_STATE.md) — but backend 500s mean the tests don't cover the real data paths (Zod validation rejects actual enum strings like 'TASK')

## 6. DESIGN SYSTEM RECOMMENDATION (GENERATED FROM UI/UX PRO MAX + HIGH-END SKILL)
Archetype selected: Ethereal Glass (SaaS / local marketplace) + Asymmetrical Bento layout
Colors: Deep black (#050505) background option (optional dark mode) OR keep current warm white (#FAFAF9) with glass cards (`backdrop-blur-xl bg-white/10 border-white/10`)
Typography: Replace Inter → Geist (variable, geometric grotesk) or Plus Jakarta Sans for premium readability
Layout: Bento grid for the landing hero (varying card spans: 8 / 4 stacked) instead of flat single-column
Motion: Add GSAP scroll reveal with `duration 800ms`, `ease-[cubic-bezier(0.32,0.72,0,1)]`, `translate-y-16 blur-md` → `translate-y-0 blur-0`
Navigation: Convert sticky top navbar to floating glass pill (`fixed top-6 left-1/2 -translate-x-1/2 w-max rounded-full backdrop-blur-2xl bg-black/20 border-white/10 px-4 py-2`)
Buttons: Add nested icon wrapper (`group-hover:translate-x-1 group-hover:-translate-y-[1px] scale-105`) inside pill buttons (`rounded-full px-6 py-3`)
Cards: Apply Double-Bezel (`rounded-[2rem] ring-1 ring-black/5 p-1.5 bg-white/5` outer; `rounded-[calc(2rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]` inner)
Performance: Only animate `transform` + `opacity`; `backdrop-blur` only on fixed nav/overlay; never on scroll containers

## 7. STRONG PROMPT FOR NEXT PHASE (LIKE HOW GOOGLE SRE GENERATES INCIDENT PLAYBOOKS)
Generate and save to `.prompts/RED_TEAM_PROMPT.md`
Content: A 10-point red-team checklist for every page — (1) Load time < 1.5s? (2) All API calls return 200/201 with correct JSON schema? (3) Auth token present and propagated? (4) No console errors? (5) No 404/500 on real data (use UUIDs from DB, not fake `:id`)? (6) Responsive layout holds at 375px width? (7) All interactive elements have focus ring and hover state? (8) Empty state shows icon + description + CTA? (9) Reduced motion supported? (10) Design feels premium (not template-level)?

## 8. NEXT ACTIONS (PRIORITY ORDERED LIKE A SPRINT REVIEW)
1. Fix POST /work-opportunities 500: validate enum mapping between Zod schema (`TASK`/`SHIFT`/`JOB`) and DB/store
2. Fix /providers/me/location 404: mount the route or remove from docs
3. Fix admin auth: either create `admin@nearvia.test` Supabase user or disable admin login until Phase 13
4. Complete Phase 10: attendance check-in, GPS verification within 500m, shift start/complete endpoints, attendance_records population, frontend work-execution console with supervisor sign-off
5. Fix design: add GSAP motion, double-bezel cards, floating glass nav pill, premium fonts
6. Re-run security: fix semgrep dependency, execute trivy, commit to git then re-run gitleaks on actual commits
7. Update PROJECT_STATE.md after Phase 10 with verified test count and new endpoint inventory
8. Generate master red-team prompt and attach to `.prompts/`

## 9. FILES CREATED / UPDATED
- `/d/NearVia/RED_TEAM_QA_REPORT.md` (this file)
- `/d/NearVia/page-data/*.txt` (20 page responses — saved for evidence)
- `/d/NearVia/.qa-worker-token` (auth token for audit replay)
- `/d/NearVia/gitleaks-report.json` (0 leaks)
- `/d/NearVia/semgrep-report.json` (not produced — tool broken)
- `.prompts/RED_TEAM_PROMPT.md` (to be generated)
- `PROJECT_STATE.md` update pending (Phase 10)

## 10. VISUAL EVIDENCE FROM LIVE PREVIEW PANE
- Home page: `/` → loads, shows "NEARVIA • WORK WITHIN REACH", hero text, 4-step flow, categories, footer — clean, white cards, orange CTAs (`#FAFAF9` bg, `rounded-3xl` cards, `shadow-card`, `text-slate-900`, orange `#F97316` primary buttons)
- No 3D depth, no motion, no floating elements — flat but clean modern design
- Responsive footer links present; nav links `/login`, `/register`, `/find-work`
- No broken images (no images in design — text/icon driven)
- Live API health indicator not visible in preview (header has health indicator per docs — may be off-screen or loading state not captured)
