# NEARVIA Folder Ownership & Responsibility Architecture

> **Document Version**: 1.0.0  
> **Status**: Approved Infrastructure Specification (Phase 2)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Core Principle

To ensure high AI-agent token efficiency, maintainability, and clean boundaries, every directory in the NEARVIA monorepo has a single, strictly enforced responsibility.

```
NEARVIA/
├── apps/
│   ├── web/                     # Web UI Application ONLY
│   └── mobile/                  # Mobile UI Client ONLY (Reserved)
├── services/
│   └── api/                     # Central REST Backend & Modular Monolith ONLY
├── packages/
│   ├── types/                   # Shared TypeScript Domain Types & Enums ONLY
│   ├── validation/              # Shared Zod Validation Schemas ONLY
│   ├── shared/                  # Generic, Non-Business Utilities ONLY
│   └── config/                  # Shared Constants & System Enums ONLY
├── database/                    # SQL Migrations, Seeds, and Schema Docs ONLY
├── docs/                        # Project Architecture, ADRs, and PRDs ONLY
├── tests/                       # Cross-Workspace Integration & E2E Suites ONLY
└── scripts/                     # Tooling, Build, & Workspace Automation ONLY
```

---

## 2. Directory Ownership Matrix

| Directory              | Allowed Responsibilities                                                                                                                     | Prohibited Actions                                                            |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| `apps/web/`            | React 19 web application UI, client-side routing, feature view components, layout, local UI state.                                           | Direct database access; backend business logic; duplicating shared models.    |
| `apps/mobile/`         | Mobile client UI application (future phase).                                                                                                 | Separate backend implementation; duplicate validation logic.                  |
| `services/api/`        | Express.js REST API; 18 modular monolith domain modules (`src/modules/*`); security middleware; routing; controllers; services.              | Client-specific rendering logic; duplicated generic utilities.                |
| `packages/types/`      | Universal TypeScript interfaces, enums, DTOs, and API response primitives.                                                                   | Executable application logic; runtime side-effects; external service clients. |
| `packages/validation/` | Reusable Zod input validation schemas for forms and API request bodies.                                                                      | Business execution logic; database calls.                                     |
| `packages/shared/`     | Pure, generic utilities (Haversine math, date difference helpers, number formatters).                                                        | NEARVIA business logic; domain entities; database queries.                    |
| `packages/config/`     | System constants, default 5 km radius, port mappings, standard HTTP error codes.                                                             | Secret environment variables; API keys; service credentials.                  |
| `database/`            | SQL migration files (`migrations/`), seed data (`seeds/`), DDL schema references (`schema/`), and PostGIS spatial indexing guides (`docs/`). | Application runtime code; ORM model implementations.                          |
| `docs/`                | System architecture, ADRs, PRDs, screen inventories, user flow diagrams, and agent rules.                                                    | Code artifacts; scratch files; temporary test outputs.                        |
| `tests/`               | Multi-module integration tests, E2E test scenarios, fixtures, and load benchmarks.                                                           | Unit tests tied strictly to a single module (keep those co-located).          |
| `scripts/`             | Scaffolding scripts, maintenance tasks, linting helpers, workspace setup scripts.                                                            | Production business services.                                                 |

---

## 3. Rules for AI Coding Agents

1. **Targeted Inspection**: Inspect only the specific feature folder in `apps/web/src/features/<domain>` and `services/api/src/modules/<domain>`.
2. **Never Create Duplicate Folders**: Single source of truth. Do not create parallel folders (e.g. `src/job-module/` when `src/modules/jobs/` exists).
3. **Unidirectional Package Import**: `apps/*` and `services/*` may import from `packages/*`. `packages/*` must NEVER import from `apps/*` or `services/*`.
