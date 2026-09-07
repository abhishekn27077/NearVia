# NEARVIA Repository Architecture & Monorepo Design

## 1. Monorepo Organization

NEARVIA is structured as an npm workspaces monorepo:

```
NEARVIA/
├── apps/                        # Deployable client applications
│   ├── web/                     # React + Vite + TypeScript web application
│   └── mobile/                  # Mobile application (reserved)
├── services/                    # Deployable backend services
│   └── api/                     # Node.js + Express REST API (Modular Monolith)
├── packages/                    # Internal shared libraries
│   ├── types/                   # Shared TypeScript models and enums
│   ├── validation/              # Shared Zod validation schemas
│   ├── shared/                  # Generic math, date, and formatting utilities
│   └── config/                  # Constants, error codes, and configuration defaults
├── database/                    # Database DDL, migrations, seeds, and spatial docs
├── docs/                        # Project architecture, ADRs, and guides
├── tests/                       # Cross-workspace integration and e2e test suites
├── scripts/                     # Automation and scaffolding scripts
├── .github/workflows/           # CI/CD pipelines
├── .gitignore                   # Version control exclusions
├── .env.example                 # Sanitized environment template
├── README.md                    # Project overview
└── PROJECT_STATE.md             # Project lifecycle tracking
```

## 2. Dependency Rules & Encapsulation

1. **Unidirectional Dependencies**:
   - `apps/*` and `services/*` may import from `packages/*`.
   - `packages/*` must NEVER import from `apps/*` or `services/*`.
   - Packages may depend on each other only in a strict hierarchy: `validation` -> `types`, `shared` -> `types`, `config` -> `types`.
2. **Zero Circular Dependencies**:
   - Monorepo tooling and TypeScript compiler enforce strict acyclic dependency graphs.
3. **Domain Module Encapsulation in `services/api`**:
   - Each module in `services/api/src/modules/` is self-contained.
   - Cross-module communication must happen via exported service interfaces, never by reaching into another module's internal controller or route files.
