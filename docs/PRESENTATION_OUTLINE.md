# NEARVIA — MASTER PROJECT PRESENTATION SLIDE OUTLINE (20 SLIDES)

> **Audience**: Academic Review Committee, MCA External Examiners, Startup Pitch Evaluators  
> **Presentation Duration**: 15–20 Minutes (with Questions)

---

### Slide 1: Title & Overview
- **Title**: NEARVIA: A Hyperlocal Quick-Work & Informal Labor Marketplace
- **Subtitle**: Bridging the Informal Labor Divide via PostGIS Geodesics, Explainable Matching, and Multimodal Low-Literacy UX
- **Presenters**: MCA Final Year Project Candidates
- **Key Visual**: Platform Logo, Mobile UI Mockup, and Tagline: *"Reliable Local Work, Minutes Away."*

### Slide 2: The Real-World Problem
- **The Scale**: Over 80% of urban non-agricultural employment in developing nations is informal.
- **The Plight**: Daily wage workers (packers, helpers, catering staff, electricians) wait at physical street corners ("labour nakas") with zero certainty of daily employment.
- **Economic Inefficiency**: Employers face acute last-minute labor shortages; workers face unpredictable daily income.

### Slide 3: The Five Structural Gaps
- **1. Hyperlocal Radius**: Workers cannot travel $>5\text{ km}$ for a 4-hour shift; transit costs wipe out earnings.
- **2. The Reputation Void**: Informal workers possess no portable work history or verified credit.
- **3. Wage Asymmetry**: Lack of transparent market pricing causes exploitation.
- **4. Digital Literacy Divide**: Complex English forms and resume uploads exclude blue-collar laborers.
- **5. Payment Friction**: Unrecorded cash transactions lead to hours and wage disputes.

### Slide 4: Limitations of Existing Solutions
- **Corporate Portals (LinkedIn, Indeed)**: Built for white-collar multi-week hiring; resume-centric.
- **Vertical Gig Giants (Urban Company, Swiggy)**: Centralized algorithmic fleet dispatching; worker has zero wage autonomy; 20–30% platform commission.
- **Physical Street Corners**: Unregulated, zero safety vetting, zero dispute resolution.

### Slide 5: The NEARVIA Solution
- An open, low-overhead matching marketplace rather than an authoritarian dispatcher:
  - Sub-15ms PostGIS radius search ($1\text{--}5\text{ km}$).
  - Explainable multi-factor candidate matching.
  - Multimodal audio readouts + Hinglish natural language job drafting.
  - Community Agent assisted proxy onboarding.
  - Dual settlement: Peer-to-peer cash confirmation + Razorpay sandbox.

### Slide 6: Target User Personas
- **Workers**: Daily-wage laborers seeking nearby shifts and guaranteed transparent pay.
- **Providers**: Micro-businesses (sweet shops, caterers, warehouses) and households needing flexible help.
- **Community Agents**: Local literate facilitators who enroll and advocate for digitally excluded workers.
- **Platform Administrators**: Governance officers managing safety, disputes, and audit logs.

### Slide 7: Core End-to-End Workflow
- Post Shift $\rightarrow$ Publish $\rightarrow$ Hyperlocal Discovery (PostGIS) $\rightarrow$ Explainable Match $\rightarrow$ Apply $\rightarrow$ Assign $\rightarrow$ Confirm $\rightarrow$ GPS Check-In $\rightarrow$ Work Execution $\rightarrow$ Cash / Online Settlement $\rightarrow$ Mutual Reviews.

### Slide 8: System Architecture & Tier Separation
- Multi-Tier Stateless Architecture:
  - **Client Layer**: React 18 SPA (Vite) with Leaflet mapping.
  - **Service Layer**: Node.js 20 + Express REST API with Zod validation.
  - **Spatial Database**: Managed PostgreSQL 17 + PostGIS 3.3.
- Diagram illustrating clear separation between application business logic and external third-party services.

### Slide 9: Technology Stack Rationale
- **Frontend**: React 18 (Component reusability), Vite (Instant build & HMR), Tailwind CSS.
- **Backend**: Node.js LTS (Event-driven I/O), TypeScript (Compile-time type safety), Zod (Runtime boundary validation).
- **Persistence**: PostgreSQL 17 (Relational ACID consistency), PostGIS (True geodesic spatial math).

### Slide 10: Database Design & PostGIS Geodesics
- 3NF Normalized relational schema across 20+ entities.
- Using `GEOGRAPHY(Point, 4326)` for true ellipsoidal distances in meters.
- 2D GIST Spatial Indexing enabling $O(\log N)$ radius and bounding-box queries.
- SQL integrity constraints protecting invariants.

### Slide 11: Explainable Multi-Factor Matching Algorithm
- Formula: $\text{Score} = (0.35 \times \text{Skills}) + (0.25 \times \text{Distance}) + (0.15 \times \text{AvailableNow}) + (0.10 \times \text{Rating}) + (0.10 \times \text{Reliability}) + (0.05 \times \text{Experience})$.
- Why Rule-Based V1? Solves the cold-start problem, delivers 100% explainability, and builds clean logs for future ML.

### Slide 12: Trust, Identity & The Community Agent Network
- Phone OTP authentication with server-side identity derivation.
- Badge verification (Phone, ID document, Business license).
- Community Agent sponsorship linking digitally excluded workers to the formal platform.

### Slide 13: Work Execution & GPS Geofenced Check-In
- Finite State Machine: `ASSIGNED` $\rightarrow$ `CONFIRMED` $\rightarrow$ `CHECKED_IN` $\rightarrow$ `COMPLETED`.
- Point-in-time geodesic check-in (<1000m threshold) prevents ghost check-ins without continuous battery-draining background tracking.

### Slide 14: Dual Payment Architecture
- **Cash Confirmation**: Neutral two-party confirmation workflow (*"Cash payment confirmed between provider and worker"*).
- **Online Sandbox**: Razorpay test mode with HMAC-SHA256 signature verification and idempotency defense against replay attacks.
- Explicit non-custodial design: NEARVIA does not illegally hold custom escrow.

### Slide 15: Safe Multimodal AI & Copilot Architecture
- Pipeline: User Hinglish Speech $\rightarrow$ Parser $\rightarrow$ Zod Schema Barrier $\rightarrow$ Business Rules $\rightarrow$ User Confirmation Screen $\rightarrow$ Database.
- AI has zero SQL write permissions, cannot bypass authorization, and gracefully falls back to deterministic regex heuristics if LLM APIs are offline.

### Slide 16: Security Engineering & Defense-in-Depth
- Parameterized queries (100% SQLi defense).
- Strict horizontal IDOR prevention via ownership clauses in SQL.
- Timing-safe HMAC signature verification (`crypto.timingSafeEqual`).
- Granular rate limiting on OTP and payment endpoints.

### Slide 17: Empirical Testing & Verification
- **26 Test Suites**, **226 Automated Tests**, **100% Pass Rate** in 8.21 seconds.
- **16 Dedicated Security Negative Tests** verifying rejection of unauthenticated, tampered, or expired requests.
- **Zero Typecheck Errors** across 6 monorepo workspaces.
- **13/13 Live Database PostGIS Assertions** passing on staging PostgreSQL.

### Slide 18: Live System Demonstration Highlights
- Brief recap of the live demo flow:
  1. Provider posts and publishes job in Indiranagar.
  2. Worker discovers job within 500m on map and listens to Hindi audio readout.
  3. Worker applies, Provider hires based on explainable match score.
  4. Worker checks in via GPS, completes shift, confirms cash settlement, and submits 5-star review.

### Slide 19: Honest Limitations & Future Scope
- **Current Limitations**: Mock OTP (TRAI DLT registration required in India), Razorpay Sandbox (commercial KYC required), Heuristic matching V1.
- **Future Roadmap**: V2 Learning-to-Rank (LightGBM), Indic-Whisper voice fine-tuning, WhatsApp bot integration, Portable Skill Passport.

### Slide 20: Conclusion & Acknowledgments
- NEARVIA proves that robust spatial engineering, explainable matching, and low-literacy UX can bring formal dignity, transparency, and safety to the unorganized informal workforce.
- Q&A Session.
