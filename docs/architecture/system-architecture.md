# NEARVIA System Architecture

## 1. System Overview

NEARVIA is architected as a modern, high-performance **Modular Monolith** designed for hyperlocal, short-duration work matching.

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                               |
|   +-----------------------------+     +-----------------------------+   |
|   |          apps/web           |     |         apps/mobile         |   |
|   |  (React, TypeScript, Vite)  |     |  (Reserved for future phase)|   |
|   +--------------+--------------+     +--------------+--------------+   |
+------------------|-----------------------------------|------------------+
                   |                                   |
                   | REST API (JSON over HTTPS)        |
                   v                                   v
+-------------------------------------------------------------------------+
|                            API SERVICE LAYER                            |
|                            services/api                                 |
|                                                                         |
|   +--------------------+  +--------------------+  +-----------------+   |
|   |  Security & Cors   |  |   Request Logger   |  | Error Handling  |   |
|   +--------------------+  +--------------------+  +-----------------+   |
|                                                                         |
|   +-----------------------------------------------------------------+   |
|   |                      DOMAIN MODULE ENGINE                       |   |
|   |  auth | users | workers | providers | agents | jobs | tasks     |   |
|   |  availability | location | matching | applications | reviews    |   |
|   |  assignments | verification | payments | disputes | admin       |   |
|   +-----------------------------------------------------------------+   |
+------------------|-----------------------------------|------------------+
                   |                                   |
                   | Relational & PostGIS Queries      | Auth & JWT
                   v                                   v
+--------------------------------------+   +------------------------------+
|            DATA STORE                |   |       IDENTITY PROVIDER      |
|        PostgreSQL + PostGIS          |   |        Supabase Auth         |
|  - Spatial GIST Indexing             |   |  - Phone OTP Authentication  |
|  - Relational Integrity & Schema     |   |  - JWT Issuance & Session    |
+--------------------------------------+   +------------------------------+
```

## 2. Key Tiers & Responsibilities

### Client Tier (`apps/web`, `apps/mobile`)

- Responsive Web Application (Vite + React + TypeScript + Tailwind CSS).
- Mobile Application (Reserved).
- Feature-driven UI structure with zero duplicated business logic.
- Uses Leaflet / OpenStreetMap for spatial visualization.

### Backend Tier (`services/api`)

- Express.js with TypeScript in a Modular Monolith layout.
- Decoupled modules owning their routes, controllers, services, and types.
- Centralized middleware for security (Helmet, CORS), validation (Zod), and error formatting.

### Shared Layer (`packages/*`)

- `@nearvia/types`: Canonical domain models, status enums, and request contracts.
- `@nearvia/validation`: Reusable Zod schemas for coordinates, phone, jobs, and user inputs.
- `@nearvia/shared`: Haversine distance math, date calculations, and formatters.
- `@nearvia/config`: Constants (5 km default radius, error codes, HTTP statuses).

### Data Tier (`database/`)

- PostgreSQL 15+ for relational integrity.
- PostGIS extension for spatial queries (`ST_DWithin`, `ST_Distance`, `GIST` indexes).
- Supabase Auth for managed identity and token issuance.
