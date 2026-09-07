# NEARVIA Dependency Governance & Management Rules

> **Document Version**: 1.0.0  
> **Status**: Approved Infrastructure Specification (Phase 2)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Core Dependency Principles

1. **Native-First Policy**: Do NOT install an external npm package if native JavaScript/TypeScript (ES2022+), Web APIs, or standard Node.js runtime libraries (`crypto`, `fs`, `path`, `events`, `http`) provide sufficient capabilities.
2. **Search Before Installing**: Always inspect root `package.json` and workspace dependencies before adding a new package.
3. **No Duplicate Solutions**: Never install multiple libraries that solve the same problem (e.g. do not install `axios` if `fetch` is standard; do not install `moment` or `date-fns` when native `Date`/`Intl` and `@nearvia/shared` suffice; do not install multiple testing frameworks).
4. **Prefer Proven, Maintained Packages**: When third-party packages are required, choose established, actively maintained libraries with strong TypeScript support and zero heavy transitive dependencies.
5. **No Premature Technology Sprawl**:
   - **DO NOT INTRODUCE**: Redis, Kafka, RabbitMQ, Kubernetes, Microservices, MongoDB, Elasticsearch, Prisma, TypeORM, GraphQL, or Blockchain unless explicitly required and approved in a future phase with an ADR.
   - **KEEP SIMPLE**: The core platform is a modular monolith backed by PostgreSQL + PostGIS.
6. **Record Decisions**: Any addition of a significant runtime dependency must be accompanied by an ADR or documented update in `PROJECT_STATE.md`.

---

## 2. Approved Package Registry

| Workspace                 | Approved Core Dependencies                                              | Purpose                                                           |
| :------------------------ | :---------------------------------------------------------------------- | :---------------------------------------------------------------- |
| **Root**                  | `typescript`, `prettier`                                                | Workspace tooling, formatting, type checking.                     |
| **`packages/types`**      | Zero runtime dependencies                                               | Pure TypeScript interfaces, enums, and types.                     |
| **`packages/validation`** | `zod`                                                                   | Declarative schema validation across API, Web, and Mobile.        |
| **`packages/shared`**     | Zero external runtime dependencies                                      | Generic pure math, string, and date utilities.                    |
| **`packages/config`**     | Zero runtime dependencies                                               | Constants, error codes, and configuration types.                  |
| **`services/api`**        | `express`, `cors`, `helmet`, `dotenv`, `zod`                            | REST API routing, security headers, CORS, and request validation. |
| **`apps/web`**            | `react`, `react-dom`, `react-router-dom`, `lucide-react`, `tailwindcss` | Single Page Application UI, routing, icons, and styling.          |

---

## 3. Dependency Verification Command

To verify that no unapproved or vulnerable packages exist:

```bash
npm audit
npm run typecheck
```
