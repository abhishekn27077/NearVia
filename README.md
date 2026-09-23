# NEARVIA

> **Work Within Reach**  
> *A Production-Structured Hyperlocal Marketplace for Quick-Work & Informal Labor*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17.6-336791.svg)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.3-green.svg)](https://postgis.net/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-702%20Passed-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/Audit-0%20High%20Vulnerabilities-success.svg)]()

---

## 1. Overview

**NEARVIA** is an engineering-driven, security-hardened hyperlocal labor marketplace connecting informal daily-wage workers with micro-shifts (sweet box packing, retail help, event catering, skilled trades) within a **1–5 km radius**. 

Unlike corporate resume portals or high-commission gig dispatchers, NEARVIA operates as an **open matching exchange** engineered for the realities of the informal urban economy:
- **Sub-15ms Spatial Discovery**: PostGIS geodesic search on the ellipsoidal Earth model (`GEOGRAPHY(Point, 4326)`).
- **Explainable Multi-Factor Matching**: Deterministic, transparent scoring (Skills, Distance, Availability, Rating, Reliability).
- **Low-Literacy Multimodal Accessibility**: Native browser audio synthesis (Hindi/English), Hinglish natural language parsing, and high-contrast pictorial trade cards.
- **Community Agent Assisted Access**: Verified field facilitators authorized to onboard and apply on behalf of digitally excluded workers.
- **Dual Settlement Architecture**: Auditable peer-to-peer cash payment confirmations combined with Razorpay sandbox integration.

---

## 2. Core Architecture

```
USER CLIENTS (React 18 SPA / Mobile)
               ↓
CLOUDFLARE CDN / REVERSE PROXY
               ↓
EXPRESS 4 REST API (/api/v1)
├── Rate Limiters (OTP: 6/15m, Payments: 30/15m)
├── Authentication & Session Guard (JWT Bearer)
├── Role-Based Access Control (RBAC)
└── Zod Runtime Schema Validation
               ↓
BUSINESS SERVICE MODULES
├── Jobs & Spatial Discovery (PostGIS ST_DWithin)
├── Explainable Candidate Matching Engine
├── Work Execution & Geofenced Check-In
├── Dual Payments & HMAC Webhook Verification
└── Low-Literacy Voice & NLP Drafting
               ↓
POSTGRESQL 17.6 + POSTGIS 3.3 PERSISTENCE LAYER
```

---

## 3. Technology Stack

- **Frontend**: React 19, Vite 6, TypeScript 5, Tailwind CSS with custom design tokens, Lucide icons, Leaflet / OpenStreetMap.
- **Backend API**: Node.js 20 LTS, Express 4, TypeScript 5, Zod 3, `pg-pool` connection pooling, Helmet.
- **Database & Spatial**: PostgreSQL 17.6 with PostGIS 3.3, `pg_trgm` fuzzy text extension.
- **Authentication**: Supabase Auth (Email/Password & Google OAuth) with server-side RBAC and session token validation.
- **Testing**: Vitest 3.2.7 (53 test suites, 702 tests covering unit, integration, spatial PostGIS, security/IDOR, and lifecycle state machines).

---

## 4. Repository Structure

```
NEARVIA/
├── apps/
│   ├── web/                     # React 19 + Vite Web Application (Public Marketplace)
│   ├── admin/                   # Isolated Admin Command Center (Port 5174)
│   └── mobile/                  # Native Mobile Application Architecture (Future scope)
├── services/
│   └── api/                     # Node.js + Express Modular Monolith REST API
├── packages/
│   ├── types/                   # Shared TypeScript models and enums
│   ├── validation/              # Shared Zod validation schemas
│   ├── shared/                  # Spatial math and date-time utilities
│   └── config/                  # Constants, error codes, and shared config
├── database/
│   ├── migrations/              # Sequential SQL migrations (PostGIS schema)
│   └── seeds/                   # Taxonomic categories and trade skills
└── docs/                        # Comprehensive Architecture, MCA & Viva Documentation
    ├── REQUIREMENTS_TRACEABILITY.md
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── JOB_LIFECYCLE.md
    ├── PAYMENTS.md
    ├── INTELLIGENCE.md
    ├── AI.md
    ├── USER_FLOWS.md
    ├── SCREEN_INVENTORY.md
    ├── API.md
    ├── TESTING.md
    ├── MCA_REPORT.md
    ├── VIVA_QUESTIONS.md
    ├── VIVA_CHEAT_SHEET.md
    ├── DEMO_SCRIPT.md
    ├── PRESENTATION_OUTLINE.md
    ├── STARTUP_READINESS.md
    ├── LIMITATIONS.md
    ├── FUTURE_SCOPE.md
    └── FINAL_STATUS.md
```

---

## 5. Getting Started (Local Development)

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v15+ with **PostGIS 3.x** enabled

### 1. Installation
Clone the repository and install all monorepo dependencies:
```bash
git clone https://github.com/your-org/nearvia.git
cd NearVia
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root and `services/api`:
```bash
cp .env.example .env
cp .env.example services/api/.env
```
Ensure your PostgreSQL connection string has PostGIS enabled:
```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/nearvia
PORT=4000
NODE_ENV=development
PAYMENT_MODE=demo
AI_PROVIDER=deterministic
```

### 3. Database Migration & Seeding
Apply the PostGIS spatial migrations and seed taxonomic trades:
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Development Servers
Run the full monorepo concurrently:
```bash
npm run dev
```
- **Web Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000`
- **API Health Check**: `http://localhost:4000/health`

---

## 6. Verification & Testing

NEARVIA maintains a 100% automated test pass rate:

```bash
# Run all 53 Vitest test suites (702 automated tests)
npm test

# Run TypeScript typechecks across all 6 workspaces
npm run typecheck

# Verify production builds
npm run build

# Run security package audit
npm audit
```

---

## 7. Application Architecture & Demonstration Accounts

### Public Application (`apps/web`)
The primary public marketplace operates at `http://localhost:5173`. Users authenticate securely via Supabase Auth (Email/Password or Google OAuth).

For local development and testing, standard demo accounts can be provisioned using `npm run seed:demo` with password supplied via the `DEMO_PASSWORD` local environment variable:

| Persona | Role | Demo Account Email | Primary Portal |
| :--- | :--- | :--- | :--- |
| **Priya Sharma** | `PROVIDER` | `demo.provider@nearvia.test` | `/provider/dashboard` |
| **Suresh Patel** | `WORKER` | `demo.worker@nearvia.test` | `/worker/dashboard` |
| **Sunita Rao** | `AGENT` | `demo.agent@nearvia.test` | `/agent/dashboard` |

*(Note: Demo account credentials require `DEMO_PASSWORD` in `.env`. No fallback passwords are committed in source code).*

### Isolated Admin Console (`apps/admin`)
The Admin Console is a physically separate application running on `http://localhost:5174`.

- **Admin Provisioning**: Administrative accounts cannot be registered publicly. They must be provisioned securely via CLI/server environment:
  ```bash
  npm run admin:create -- --email <admin-email>
  ```
- **Admin APIs**: All administrative endpoints (`/api/v1/admin/*`) require server-side `ADMIN` role verification, active status enforcement, and structured audit logging. No administrative access exists through `apps/web`.

---

## 8. Payment & AI Operating Modes

### Payment Modes
- **`DEMO`**: Local in-memory mock provider for rapid offline development.
- **`SANDBOX`**: Razorpay test mode with HMAC-SHA256 signature verification.
- **`PRODUCTION`**: Explicitly blocked until commercial entity incorporation, GSTIN registration, and live merchant KYC approval.

### AI & Copilot Modes
- **`DETERMINISTIC`**: Local regex & Hinglish keyword extraction with zero external API calls.
- **`GEMINI`**: Google Gemini 1.5 Flash Copilot for natural language job drafting with automatic fail-safe fallback to deterministic heuristics.

---

## 9. Technical Limitations & Future Production Disclosures

In compliance with academic honesty, engineering integrity, and the MCA scope:
1. **SMS & Mobile OTP (Future / Production)**: Current version uses Supabase Email verification and development OTP logging. Live telecom SMS delivery requires commercial TRAI DLT registration and an enterprise SMS aggregator (e.g., MSG91/Twilio).
2. **Identity & KYC (Future / Production)**: Current version supports manual administrative review and document reference storage. Automated Aadhaar/e-KYC verification requires a certified UIDAI/DigiLocker commercial license.
3. **Payment Settlement (Future / Production)**: Operates in transparent peer-to-peer cash confirmation mode and Razorpay Sandbox test mode. Production bank transfers and escrow accounts require RBI compliance and merchant bank nodal account approval.
4. **Emergency Assistance (Truthful Device Action)**: The Emergency 112 button triggers the native device telephone dialer (`tel:112`) with national ERSS guidelines and logs an on-device safety event. NEARVIA does not operate a private emergency dispatch service.
5. **Location Privacy vs. Continuous Tracking**: NEARVIA uses server-authoritative PostGIS geofenced check-in/check-out (`ST_DWithin`) and 5 km radius matching. It intentionally does not conduct continuous background GPS tracking to protect worker privacy and device battery.
6. **Smart Matching**: Employs an explainable, deterministic multi-factor algorithm (Skills, Distance, Availability, Rating, Reliability). Production Learning-to-Rank (LTR) will be introduced in V2 after collecting 10,000+ interaction records.

---

## 10. License & Academic Attribution

This project was developed as a Master of Computer Applications (MCA) Final Year Project Dissertation.  
Distributed under the MIT License. See `LICENSE` for details.
