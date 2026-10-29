# NEARVIA

> **Work Within Reach**  
> *A Production-Structured Hyperlocal Marketplace for Quick-Work & Informal Labor*  
> **Master of Computer Applications (MCA) Final Year Project Dissertation**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17.6-336791.svg)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.3-green.svg)](https://postgis.net/)
[![Tests](https://img.shields.io/badge/Tests-778%20Passed-brightgreen.svg)]()
[![Typecheck](https://img.shields.io/badge/Typecheck-0%20Errors-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/Audit-0%20High%20Vulnerabilities-success.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 1. Executive Summary & Problem Statement

**NEARVIA** is an engineering-driven, security-hardened hyperlocal labor marketplace connecting informal daily-wage workers with micro-shifts (sweet box packing, retail help, event catering, unloading, skilled trades) within a strict **1–5 km perimeter**.

### The Problem in the Informal Urban Economy
In Indian urban and semi-urban labor markets, short-duration tasks (1–3 hours), daily shifts (4–8 hours), and urgent micro-jobs struggle to connect with verified nearby workers in real time. 
- Traditional job portals (LinkedIn, Naukri) cater exclusively to white-collar resume workflows with multi-week hiring cycles.
- Existing gig platforms (Urban Company, TaskRabbit) enforce high commission cuts (20–30%), centralized dispatching, and rigid qualification barriers that exclude informal daily-wage earners.
- Daily wage workers congregate physically at street corners (*labor chowks*), losing billable hours and dignity while facing exploitation by informal middlemen.

### The NEARVIA Solution
NEARVIA acts as a **decentralized, low-friction matching exchange** purpose-built for the informal economy:
- **Sub-15ms Spatial Discovery**: PostGIS geodesic search on the ellipsoidal Earth model (`GEOGRAPHY(Point, 4326)`).
- **Explainable Multi-Factor Matching**: Deterministic, transparent scoring (Skills, Distance, Availability, Rating, Reliability) with positive match explanations and zero black-box AI opacity.
- **Low-Literacy Multimodal Accessibility**: Native browser Web Speech API (speech synthesis & voice search in English, हिन्दी, and ಕನ್ನಡ), high-contrast pictorial trade cards, and minimal cognitive load.
- **Community Agent Assisted Access**: Verified field facilitators authorized to onboard and apply on behalf of digitally excluded workers without compromising worker accounts.
- **On-Site 4-Digit Job PIN & Geofenced Attendance**: Cryptographic 4-digit PIN verification combined with GPS geofence checks to eliminate attendance fraud and ghost worker claims.
- **Dual Settlement Architecture**: Auditable peer-to-peer cash payment confirmations combined with Razorpay sandbox integration.

---

## 2. Cloud Architecture & Live Deployments

NEARVIA is engineered for high availability, zero cold-leakage, and ₹0 free-tier cloud deployment:

```
                              [ INTERNET CLIENTS ]
                      (Worker, Provider, Agent & Admin)
                                      │
                                      ▼
                           [ CLOUDFLARE CDN / WAF ]
                         (SSL/TLS Termination, DDoS)
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         ▼                                                         ▼
[ PUBLIC & ADMIN WEB ]                                   [ REST API GATEWAY ]
  Vite SPA on Vercel                                      Node.js/Express on Render
  apps/web & apps/admin                                   services/api (/api/v1)
         │                                                         │
         │                                                         ▼
         │                                                [ SECURITY SHIELD ]
         │                                                (Rate Limiters, Helmet,
         │                                                 RBAC & Zod Validation)
         │                                                         │
         └────────────────────────────┬────────────────────────────┘
                                      ▼
                        [ SUPABASE MANAGED CLOUD ]
                       (PostgreSQL 17.6 + PostGIS 3.3)
                        • Geodesic Spatial Indexes (GIST)
                        • Supabase Auth (JWT & OAuth)
                        • Row Level Security (RLS)
                        • 29 Idempotent SQL Migrations
```

### Live Deployment Topology
| Tier | Host Platform | Production Endpoint | Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | **Vercel** | `https://nearvia.in` | React 19 Public Marketplace SPA |
| **Admin Console** | **Vercel** | `https://nearvia.in/admin` | Isolated Admin Command Center |
| **Backend REST API** | **Render** | `https://nearvia-api.onrender.com/api/v1` | Express 4 Modular Monolith Gateway |
| **Database & Auth** | **Supabase** | `db.supabase.co` | PostgreSQL 17.6 + PostGIS 3.3 & Auth |

---

## 3. Technology Stack

- **Frontend Core**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS (Warm `#FAFAF9` Design Tokens), Lucide Icons, Leaflet & CartoDB tiles.
- **Backend API**: Node.js 20 LTS, Express 4, TypeScript 5.8, Zod 3 runtime schemas, `pg-pool` connection pooling, Helmet, CORS.
- **Database & Spatial**: PostgreSQL 17.6 with PostGIS 3.3, `pg_trgm` fuzzy text extension, GIST spatial indexation on `GEOGRAPHY(Point, 4326)`.
- **Authentication & RBAC**: Supabase Auth (Email/Password & Google OAuth) with server-authoritative role verification (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`).
- **Testing & QA**: Vitest 3.2.7 (58 test suites, 778 tests covering unit, integration, spatial PostGIS, security/IDOR, and lifecycle state machines).

---

## 4. Repository Structure

```
NEARVIA/
├── apps/
│   ├── web/                     # React 19 + Vite Public Marketplace (Port 5173)
│   ├── admin/                   # Isolated Admin Command Center (Port 5174 / /admin)
│   └── mobile/                  # Native Mobile Application Architecture (Reserved)
├── services/
│   └── api/                     # Node.js 20 + Express Modular Monolith REST API (Port 4000)
├── packages/
│   ├── types/                   # Canonical TypeScript models, DTOs & domain enums
│   ├── validation/              # Shared Zod validation schemas
│   ├── shared/                  # Geodesic spatial math, date-time & currency utilities
│   └── config/                  # Constants, bounds, error codes & configuration defaults
├── database/
│   ├── migrations/              # 29 sequential, idempotent SQL migrations
│   └── seeds/                   # Taxonomic categories and trade skills
├── docs/                        # Complete MCA Dissertation & Technical Documentation Hub
│   ├── MCA_REPORT.md            # Comprehensive MCA Final Project Dissertation
│   ├── VIVA_QUESTIONS.md        # 50+ Top Viva Voce Questions & Answers
│   ├── VIVA_CHEAT_SHEET.md      # Rapid-fire Viva revision cheat sheet
│   ├── DEMO_SCRIPT.md           # Step-by-step viva presentation walkthrough
│   ├── ARCHITECTURE.md          # End-to-end system architectural specification
│   ├── DATABASE.md              # Database DDL, ER diagrams & spatial index analysis
│   ├── JOB_LIFECYCLE.md         # Finite state machine (POSTED -> COMPLETED -> SETTLED)
│   ├── PAYMENTS.md              # Dual settlement & cash audit ledger design
│   ├── TESTING.md               # 702-test verification matrix & test architecture
│   ├── PROJECT_STATE.md         # Engineering lifecycle & phase completion records
│   └── FINAL_RELEASE.md         # Production release notes & feature manifest
├── scripts/                     # Monorepo build & static bundle assembly scripts
├── tests/                       # Cross-workspace integration & E2E audit scripts
├── LICENSE                      # MIT Open Source License
└── vercel.json                  # Vercel SPA routing and reverse proxy configuration
```

---

## 5. Key Engineering Highlights for Viva / Evaluation

### 1. Ellipsoidal Geodesic Search vs. Planar Approximation
NEARVIA utilizes PostGIS `GEOGRAPHY(Point, 4326)` for all spatial operations:
```sql
SELECT id, title, hourly_rate, 
       ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
FROM jobs
WHERE status = 'POSTED'
  AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)
ORDER BY distance_meters ASC;
```
*Why this matters*: Planar Euclidean math (`sqrt((x2-x1)^2 + (y2-y1)^2)`) introduces severe spherical distortion as latitude increases. Using PostGIS Great-Circle calculations ensures distance accuracy down to the meter.

### 2. Explainable Deterministic Matching Engine
Unlike black-box AI recommendation models that hallucinate or introduce uncontrollable bias, NEARVIA scores matches transparently:
$$\text{Score} = (0.35 \times \text{Skill}) + (0.25 \times \text{Availability}) + (0.20 \times \text{Distance}) + (0.10 \times \text{Duration}) + (0.05 \times \text{Category}) + (0.05 \times \text{Urgency})$$
Every match returns explicit, human-readable explanations (e.g., *"Matched 3 of 3 required skills"*, *"Located 1.2 km away (within 5 km perimeter)"*).

### 3. Concurrency-Safe Hiring & Race Condition Prevention
When multiple providers attempt to accept candidates or when multiple workers apply for the last opening:
```sql
BEGIN;
SELECT workers_needed, workers_assigned 
FROM jobs 
WHERE id = $1 
FOR UPDATE;

-- Strict capacity check:
IF workers_assigned >= workers_needed THEN
  RAISE EXCEPTION 'Capacity reached';
END IF;

UPDATE jobs SET workers_assigned = workers_assigned + 1 WHERE id = $1;
COMMIT;
```
PostgreSQL row-level locks prevent over-subscription and duplicate shift allocation under high concurrency.

### 4. Cryptographic Job PIN & Anti-Fraud Attendance
- When an assignment is confirmed, a cryptographically secure 4-digit PIN is generated and visible only to the Provider.
- At the work site, the Worker provides this PIN to the Provider upon arrival.
- The server validates both the PIN and the GPS coordinates against the job location (`ST_DWithin <= 200m`).

### 5. Multilingual & Low-Literacy Multimodal UI
- Localized in **English**, **हिन्दी (Hindi)**, and **ಕನ್ನಡ (Kannada)**.
- Integrated Web Speech API enables voice search and audio text-to-speech reading for low-literacy workers.
- High-contrast visual trade cards with iconography ensure usability without requiring complex reading comprehension.

---

## 6. Demonstration Accounts (For Examiner Demo)

For evaluation and testing, the platform includes standard pre-seeded personas. Passwords are set via the `DEMO_PASSWORD` environment variable (no fallback passwords committed to source):

| Persona | Role | Email | Target Portal | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Suresh Patel** | `WORKER` | `demo.worker@nearvia.test` | `/worker/dashboard` | Broadcast availability, 5 km job discovery, 1-tap apply, Job PIN check-in |
| **Priya Sharma** | `PROVIDER` | `demo.provider@nearvia.test` | `/provider/dashboard` | 5-step job creation, candidate selection, PIN generation, cash settlement |
| **Sunita Rao** | `AGENT` | `demo.agent@nearvia.test` | `/agent/dashboard` | Assisted worker registration, delegated job applications, community roster |
| **Admin** | `ADMIN` | `admin@nearvia.in` | `/admin` (Port 5174) | Verification approval, dispute arbitration, payment monitoring, audit logs |

---

## 7. Getting Started (Local Development)

### Prerequisites
- **Node.js**: v20.x or higher LTS
- **npm**: v10.x or higher
- **PostgreSQL**: v15+ with **PostGIS 3.x** extension enabled

### 1. Clone & Install
```bash
git clone https://github.com/your-org/nearvia.git
cd NearVia
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
cp .env.example services/api/.env
```
Configure your database connection string in `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nearvia
PORT=4000
NODE_ENV=development
PAYMENT_MODE=demo
AI_PROVIDER=deterministic
DEMO_PASSWORD=NearviaDemo2026!
```

### 3. Run Database Migrations & Seeds
```bash
# Apply 29 sequential PostGIS migrations
npm run db:migrate

# Seed taxonomic trade categories and demo personas
npm run seed:demo
```

### 4. Start Development Servers
```bash
# Start backend API (4000) and public web client (5173) concurrently:
npm run dev

# Or run individual workspaces:
npm run dev:api    # REST API on http://localhost:4000
npm run dev:web    # Web App on http://localhost:5173
npm run dev:admin  # Admin Console on http://localhost:5174
```

---

## 8. Verification & Test Evidence

NEARVIA maintains a **100% automated test pass rate** with 0 warnings:

```bash
# Run full test suite (778 automated tests across 58 suites)
npm test

# Run TypeScript type checking across all 6 workspaces (0 errors)
npm run typecheck

# Verify production builds (Web, Admin, API)
npm run build
```

### Test Coverage Highlights
- **58 Test Suites / 778 Passing Tests**:
  - `job_lifecycle.test.ts`: Complete state machine validation from creation to payout.
  - `smart_matching.test.ts`: Multi-factor mathematical scoring and radius bounds.
  - `gps_attendance_pin.test.ts`: Cryptographic PIN matching and geofence boundary checks.
  - `api_idor_security.test.ts`: Insecure Direct Object Reference protection across all roles.
  - `payments_hardening.test.ts`: Double-spend prevention and cash audit logging.
  - `multilingual_accessibility.test.ts`: Localized translation dictionaries and accessibility tags.

---

## 9. Academic Deliverables & Viva Documentation Hub

All detailed technical documentation, dissertation reports, and viva preparation materials are organized in the [`docs/`](docs/) directory:

- 📄 **[MCA Final Dissertation Report](docs/MCA_REPORT.md)**: Complete 20+ page academic project dissertation report.
- 🎓 **[Viva Voce Questions & Answers](docs/VIVA_QUESTIONS.md)**: 50 exhaustive examiner questions covering architecture, database, security, and algorithms.
- ⚡ **[Viva Cheat Sheet](docs/VIVA_CHEAT_SHEET.md)**: Rapid-fire formula and concept summary for on-the-spot evaluation.
- 🎬 **[Live Demonstration Walkthrough](docs/DEMO_SCRIPT.md)**: Structured step-by-step presentation script demonstrating all 4 user roles.
- 📐 **[System Architecture Guide](docs/ARCHITECTURE.md)**: Deep dive into the modular monolith, caching, and network topology.
- 🗄️ **[Database & PostGIS Specification](docs/DATABASE.md)**: ER diagrams, index strategies, and spatial query optimizations.
- 🔄 **[Job Lifecycle State Machine](docs/JOB_LIFECYCLE.md)**: Complete lifecycle specification and transition invariants.
- 💳 **[Payments & Dual Settlement](docs/PAYMENTS.md)**: Peer-to-peer cash flow verification and Razorpay webhook protocols.
- 🛡️ **[Security & Audit Hardening](docs/security/SECURITY.md)**: OWASP Top 10 mitigation, RLS policies, and IDOR defense.
- 🚀 **[Free-Tier Cloud Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)**: Step-by-step guide for Vercel, Render, and Supabase deployment.

---

## 10. License & Academic Attribution

This project was developed as a **Master of Computer Applications (MCA) Final Year Project Dissertation**.  
Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
