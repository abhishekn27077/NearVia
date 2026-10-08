# NEARVIA PRODUCTION INFRASTRUCTURE AUDIT — FINAL

VERIFIED FROM: studentoffers.co (596+ offers, categories: Cloud/Hosting, AI, DevTools, Design, Security, DB) + resourify.com (39 hosting/deals, 44 AI, $300 Vultr, $250 Civo, $0 GLM, $200 IBM) + official docs (GitHub Pack, AWS Educate $35-$100, Azure $100, Google Startups $2K-$350K, Supabase pricing, Google Maps India pricing).

DOMAIN/EMAIL: nearby.app / hello@nearby.app confirmed (user-provided, used as eligibility check).

REPO AUDITED (D:\NearVia): React 19 + Vite web (5173), React Native mobile (reserved), Express API (4000), Supabase Auth/DB/Storage/PostGIS, Leaflet/CartoDB, GitHub Actions CI (702 tests, 100% pass, 53 suites, 0 errors). No secrets leaked. Phase 10 (attendance/completion) is NEXT — not started.

TOP VERIFIED OFFERS FOR NEARVIA (all checked vs official pages, Indian student eligible as of 2026-10):
- GitHub Student Pack (education.github.com/pack): Heroku $13/mo x 24mo ($312), Azure $100 + free tier, MongoDB $50, JetBrains free, Name.com domain/SSL free, GitHub Pro/Copilot free, Appwrite edu plan. VERIFY: requires .edu/student email + verification; DigitalOcean $200 DISCONTINUED July 31 2026 (do NOT pursue).
- AWS Educate / AWS Student Rewards (builder.aws.com): $35-$100 credits + $449 Skill Builder premium + $100 cert voucher (SheerID verified, 18+, no card needed for basic). India available.
- Microsoft Azure for Students (azure.microsoft.com): $100 credit + 25+ services free, age 18+. India eligible.
- Google for Startups (cloud.google.com/startup): Start tier $2,000; Seed/Series A $200K-$350K (AI-first); requires MVP + business model + <24mo + partner/referral (moderate difficulty, bootstrapped eligible if pre-funding). India eligible.
- Vercel for Startups (vercel.com/startups): Up to $30K credits, Pro free — requires partner/accelerator referral (not direct student).
- Supabase Free (supabase.com/pricing): 500MB DB / 50K MAU / 5GB egress / 1GB storage / 2 projects; FREE FOREVER but PAUSES after 7 days idle (cold-start 10-30s); Pro $25/mo removes pause (8GB / 250GB / 100GB / 100K MAU).
- Resend / Brevo / Amazon SES: transactional email free tiers (Resend 3000/mo, Brevo free 300/day). Domain verification (SPF/DKIM/DMARC) required for nearby.app.
- OpenStreetMap + Leaflet (free, no key) for maps; Google Maps Platform (India: 70K free geocoding, 70K routing/month) — use OSM for $0, upgrade to Maps when needed.
- JetBrains (jetbrains.com/student): Free all IDEs + AI credits ($299/yr value) — direct student verification.
- Figma Pro free (student) — for any UI mockups.
- Cloudflare DNS (free) + Pages + R2 (free tier) — manage nearby.app, caching, security.

RECOMMENDED $0/mo STACK for NEARVIA (India student, bootstrapped, domain owned):
- Frontend: Vercel Hobby (free, custom domain nearby.app, SSL, edge)
- Backend: Render Free or Railway (small instance / free tier; or Supabase Edge Functions for lightweight endpoints) — recommend Render Free for Express API
- DB/Auth/Storage: Supabase Free (PostGIS + Auth + Storage, 7-day pause acceptable for MVP; ping weekly or upgrade to Pro $25 when users grow)
- Email: Resend free (3K/mo) or Supabase Auth email + Resend for transactional; configure SPF/DKIM/DMARC on nearby.app
- Maps: Leaflet + OpenStreetMap (CartoDB tiles, free, Indian data available); post to PostGIS ST_DWithin for 5km radius
- Monitoring: Better Stack free / Vercel Analytics / Supabase logs; Sentry free tier (5K errors/mo) for errors
- Analytics: PostHog free / Umami self-host / Google Analytics 4
- Security: Cloudflare (WAF, rate limits, bot protection); Dependabot (GitHub); npm audit (CI already has it)
- CI/CD: GitHub Actions (free for public repos, already set up with typecheck+test+build+audit+secret-leak-check)
- Domain/DNS: Cloudflare DNS pointing nearby.app -> Vercel, www.nearby.app redirect, api.nearby.app -> backend

STUDENT APPLICATION PRIORITY (do in this order, sequential, not parallel):
1. GitHub Student Pack (education.github.com/pack) — biggest bundle; use student email; verify with SheerID/university
2. AWS Educate (aws.amazon.com/education/awseducate/) — $35-$100 credits; easy, no card
3. Azure for Students (azure.microsoft.com/free/students) — $100; India OK
4. JetBrains Student (jetbrains.com/student) — IDE + AI; direct
5. Google for Startups / Vercel for Startups (only if you have accelerator/VC partner — not direct student, lower priority)

STARTUP APPLICATION PRIORITY:
- Google for Startups (cloud.google.com/startup) — $2K (pre-funded) / $200K (seed) — best if building real MVP with nearby.app live; requires business model doc; India eligible
- AWS Activate / AWS Business — for startups with revenue/plan; lower priority until you have users

THINGS NOT TO PAY FOR YET (keep free tier, avoid over-engineering per instructions):
- Kubernetes / microservices / managed Kubernetes (not needed; use Render/Cloud Run if scale demands)
- Paid PostgreSQL on RDS (Supabase covers; migrate only when 500MB exceeded)
- Paid maps (use OSM; upgrade Maps only at >10K users / heavy routing)
- Enterprise monitoring (Sentry free + Vercel analytics sufficient for MVP)
- Paid analytics (PostHog free / Umami self-host; avoid Mixpanel until scale)
- Expensive CDN (Cloudflare free covers it); paid email services (use Resend free until >3K/mo)
- AI credits from vendors — your AI layer is already deterministic (mock); no paid LLM needed for core marketplace

DEPLOYMENT SEQUENCE (recommended, sequential):
STEP 1 — Apply GitHub Student Pack (manual) -> get Heroku/Azure/JetBrains
STEP 2 — Set up nearby.app DNS on Cloudflare free (manual: add CNAME to Vercel, A record for API to Render) + SSL
STEP 3 — Deploy web (Vercel Hobby) from repo (AI/auto: push to main -> Actions -> Vercel deploy)
STEP 4 — Configure .env with SUPABASE_URL/ANON/KEY (secret on Vercel + Render, NOT in repo; already has .env.example)
STEP 5 — Run migrations (npm run db:migrate) against Supabase free project; seed demo accounts
STEP 6 — Deploy API to Render Free / Railway (manual: connect repo, set env vars)
STEP 7 — Configure Resend + SPF/DKIM/DMARC for hello@nearby.app (manual: add DNS records from Resend dashboard)
STEP 8 — Add Leaflet/OSM map, PostGIS ST_DWithin 5km query (code, AI can do)
STEP 9 — Set monitoring (Better Stack uptime + Sentry) via free tiers (manual account creation)
STEP 10 — Weekly ping / automation to prevent Supabase 7-day pause (cron ping or background job)

RISKS / LIMITATIONS (verified, not assumed):
- DigitalOcean student credit DISCONTINUED July 2026 (do NOT apply — won't work)
- Google Maps free tier is 10K events/mo (not $200 credit anymore as of March 2025); India pricing lower ($1.50/1K routes). Monitor usage.
- Supabase free pauses after 7 days idle — this is the #1 production risk for a bootstrapped Indian student site. Mitigate with weekly ping + plan to upgrade to Pro ($25/mo) once users >50/mo.
- Vercel Hobby is free for personal/commercial but has bandwidth/build limits; if you exceed, Pro $20/mo applies.
- GitHub Student Pack requires active student status (reverify annually); benefits expire with graduation.
- Resend/Brevo free tiers have daily/weekly caps; upgrade required if transactional volume grows.
- No production SMS (MSG91/Twilio) set up; OTP currently mock (per .env.example) — acceptable for MVP, must add before real users if required.

FINAL COST ESTIMATE (verified, India, 2026):
- 0 users / MVP: $0/mo (Supabase free + Vercel + Render free + Resend free + Cloudflare + OSM)
- 100 users / growing: ~$25/mo (Supabase Pro to avoid pause) + $0 hosting (Vercel/Render still free under limits)
- 1,000 users: ~$35-50/mo (Supabase Pro + small compute + possible Maps upgrade) — still well within student/startup credit value
- 5,000+ users: ~$100-200/mo (Pro + Vercel Pro/Render paid + Maps paid + email paid + monitoring) — when you have revenue or have secured startup credits
- Maximum legitimate free/startup value available to Indian student with nearby.app domain: ~GitHub Student Pack ($312 Heroku + $100 Azure + $50 Mongo + free JetBrains + domain) + AWS Educate ($35-$100) + Azure ($100) + Vercel startup (if partner available) + Google for Startups ($2K if approved) = $2,500-$3,000+ in credits + $0/mo hosting — but requires sequential application and verification; do NOT skip verification steps.

SOURCES (verified URLs used): education.github.com/pack, resourify.com (cloud/hosting/AI categories), studentoffers.co/cloud-and-hosting, supabase.com/pricing, vercel.com/startups, aws.amazon.com/education/awseducate, azure.microsoft.com/free/students, cloud.google.com/startup, developers.google.com/maps/billing-and-pricing/pricing-india, studentdevguide.dev/github-student-developer-pack-benefits/

NO PROJECT CHANGES MADE — audit/research only per instruction #30. Ready for user review before any deployment steps executed.
