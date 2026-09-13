# NEARVIA — Final Release Documentation & Demonstration Guide

> **Tagline**: *Work Within Reach*  
> **Project Scope**: Hyperlocal Quick-Work Marketplace (5 KM Spatial Radius + Immediate Execution + Deterministic Matching)  
> **Academic Context**: Master of Computer Applications (MCA) Final Year Project Dissertation  
> **System Status**: Feature-Frozen • 100% Build Passing • 702/702 Tests Passing (53 Suites) • 29/29 Migrations Applied • ₹0 Free-Tier Ready  

---

## 1. Project Purpose
NEARVIA addresses the acute friction in Indian urban labor markets where short-duration tasks (1–3 hours), daily shifts (4–8 hours), and urgent micro-jobs struggle to connect with verified nearby workers in real time. Unlike legacy gig platforms characterized by long recruitment cycles and city-wide searches, NEARVIA restricts discovery to an uncompromising **5 km geospatial perimeter** with immediate availability dispatch, transparent deterministic matching, and on-site Job PIN attendance verification.

---

## 2. Architecture & Main Technologies
The project is architected as a modular TypeScript monorepo ensuring zero circular dependencies and strict domain boundary enforcement:

```
NEARVIA MONOREPO/
├── apps/
│   ├── web/           # React 19 + Vite 6 Public Marketplace Client (Port 5173)
│   └── admin/         # React 19 + Vite 6 Isolated Admin Command Center (Port 5174)
├── services/
│   └── api/           # Node.js 20 LTS + Express Modular Monolith REST Backend (Port 4000)
└── packages/
    ├── types/         # Canonical Domain Models, DTOs & Enums
    ├── shared/        # Shared Geodesic Math, Humanized Dates & Currency Formatters
    ├── validation/    # Server/Client Zod Validation Schemas
    └── config/        # Environment Constants, Bounds & Error Codes
```

- **Frontend Core**: React 19, TypeScript 5, Vite 6, Tailwind CSS (Warm `#FAFAF9` Design Tokens), Lucide Icons, Leaflet / OpenStreetMap.
- **Backend Core**: Node.js 20 LTS, Express 4, TypeScript 5, Zod 3, `pg-pool` connection pooling, Helmet, CORS.
- **Persistence & Spatial**: PostgreSQL 15+ with PostGIS 3.3+ spatial extension (`geography(Point, 4326)`), `pg_trgm` fuzzy indexing.
- **Authentication**: Supabase Auth (Email/Password & Google OAuth) with server-authoritative RBAC.

---

## 3. Core Features (Verified Working)
1. **5 KM Hyperlocal Discovery**: Real PostGIS indexing queries jobs within 5 km of worker's location.
2. **Deterministic Smart Matching**: Multi-factor ranking (distance, category, skill overlap, reliability).
3. **Capacity-Locked Hiring**: Row-level database locks (`SELECT ... FOR UPDATE`) prevent hiring beyond capacity.
4. **Attendance & Job PIN**: 6-digit cryptographic PIN verification prevents attendance fraud.
5. **Mutual Trust Ratings**: Double-blind 1–5 star reviews restricted strictly to completed shifts.
6. **Agent-Assisted Onboarding**: Community agents assist non-digitized workers without account compromise.
7. **Trust & Safety Arbitration**: Built-in dispute filing, evidence attachment, and admin mediation.
8. **In-App Messaging & Notifications**: Real-time DB event triggers for applications, status changes, and counterparty chat.
9. **Trilingual Accessibility**: Full English, हिन्दी, and ಕನ್ನಡ localized dictionaries with keyboard/ARIA compliance.
10. **Workforce Radar**: Aggregated PostGIS spatial heatmap displaying demand without revealing worker coordinates.

---

## 4. Database & PostGIS Design
- **Spatial Column**: `location geography(Point, 4326)` on jobs, worker profiles, and attendance logs.
- **GIST Spatial Index**: `CREATE INDEX idx_jobs_location_gist ON work_opportunities USING GIST(location);`
- **Radial Filtering Query**:
  ```sql
  SELECT id, title, ST_Distance(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography) AS distance_meters
  FROM work_opportunities
  WHERE status = 'PUBLISHED'
    AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, 5000);
  ```
- **Integrity**: 35 relational tables, 29 applied idempotent migrations, composite foreign keys, and strict enum state machines.

---

## 5. Authentication, Authorization & Admin Isolation
- **Authentication Mechanism**: Supabase Auth tokens verified server-side. Production strictly rejects all mock credentials.
- **Role-Based Access Control (RBAC)**: Enforced via `requireRole(...)` middleware across `WORKER`, `PROVIDER`, `AGENT`, and `ADMIN`.
- **Admin Isolation**:
  - The Admin Command Center runs exclusively on `apps/admin` (Port 5174).
  - Public `apps/web` contains **zero** admin links, routes, or credentials.
  - All `/api/v1/admin/*` endpoints strictly require verified `ADMIN` role and log to `audit_logs`.

---

## 6. Security Controls & Data Privacy
- **Zero Secret Leakage**: No API keys, service-role keys, or database credentials are exposed to frontend clients.
- **IDOR Protection**: Mutations verify ownership against authenticated `req.user.id`.
- **Location Privacy**: Workforce Radar applies spatial neighborhood aggregation; exact worker coordinates are never leaked to competitors or public feeds.
- **Rate Limiting**: Tiered rate limiters protect auth, admin, and sensitive mutation routes.

---

## 7. Current Scope vs. Future Roadmap
In compliance with academic honesty, system capabilities are strictly delineated:

| Domain | Current Implementation (Free-Tier Verified) | Future Production Scope |
|---|---|---|
| **Auth** | Supabase Auth (Email/Password & Google OAuth) | Cellular Telecom SMS OTP Gateway (MSG91/Twilio) |
| **KYC** | Cryptographic document reference submission & admin review | Live UIDAI Aadhaar / DigiLocker XML API integration |
| **Settlements** | Authoritative cash settlement recording & Razorpay Sandbox | Production multi-party commercial escrow payouts |
| **Matching** | Deterministic multi-factor scoring (Spatial + Skill overlap) | Deep ML Learning-to-Rank neural models |
| **Push Alerts** | In-app PostgreSQL notification engine | Background FCM / Apple APNs push notifications |

---

## 8. Local Development Commands

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Seed demo personas (Worker, Provider, Agent)
npm run seed:demo

# Provision first administrator
npm run admin:create -- --email admin@nearvia.in

# Start development servers
npm run dev:api    # REST API on http://localhost:4000
npm run dev:web    # Public marketplace on http://localhost:5173
npm run dev:admin  # Admin console on http://localhost:5174

# Run test suite and builds
npm test
npm run typecheck
npm run build
```

---

## 9. MCA Demonstration Script (5-Minute Walkthrough)

1. **Provider Flow (`demo.provider@nearvia.test`)**:
   - Log in at `http://localhost:5173/login`.
   - Post work opportunity: "Event Helper" (₹450 / 3 hrs, 5 km geofence).
   - Publish to active feed.
2. **Worker Discovery Flow (`demo.worker@nearvia.test`)**:
   - Log in in incognito/separate browser.
   - Open **Find Work (5 KM)** — verify real-time PostGIS distance computation.
   - Inspect **Multi-Factor Hyperlocal Compatibility Breakdown** and apply.
3. **Hiring & Shift Execution**:
   - Provider reviews applicant and clicks **Hire / Accept**.
   - Worker views active assignment, provides valid **6-digit Job PIN** to check in.
   - Worker completes shift; provider confirms completion.
4. **Settlement & Trust**:
   - Record cash/direct settlement or test Razorpay Sandbox payment.
   - Both parties submit reciprocal 5-star reviews — verify rolling reliability score updates.
5. **Admin Console (`apps/admin` on Port 5174)**:
   - Access `http://localhost:5174/login` with administrative credentials.
   - Review live platform metrics, user accounts, dispute logs, and the PostGIS **Workforce Radar** heatmap.
