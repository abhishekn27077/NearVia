# ADR-007: Database Access Strategy & Spatial Query Architecture

> **Status**: Approved  
> **Date**: 2026-08-22  
> **Author**: NEARVIA Architecture Team  
> **Context**: Phase 3 Database Architecture & Data Foundation

---

## 1. Context & Problem Statement

NEARVIA is a hyperlocal quick-work marketplace operating on a default **5 km proximity radius** powered by **PostgreSQL 15+** with the **PostGIS spatial extension**. The backend service (`services/api`) requires a database access strategy that:

1. Provides first-class, native support for PostGIS spatial functions (`ST_DWithin`, `ST_Distance`, `ST_MakePoint`, `ST_SetSRID`, `GIST` indexes).
2. Maintains strict TypeScript type safety without heavy ORM impedance mismatch.
3. Avoids complex schema synchronization magic that breaks spatial DDL.
4. Supports connection pooling, parameterized query execution, and transactional consistency.
5. Remains predictable, easily maintainable by multiple AI coding agents, and lightweight.

---

## 2. Decision

We adopt **`node-postgres` (`pg`) with connection pooling and typed domain repository query helpers** as the official database access strategy.

### Core Components:

- **Connection Pool**: Managed via `pg.Pool` (`services/api/src/db/index.ts`) with configurable pool sizing (`max: 20`), idle timeouts, and automatic connection recycling.
- **Native PostGIS Spatial Queries**: Direct parameterized execution of spatial queries (`ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`) ensuring zero abstraction leak or polyfill requirement.
- **Type-Safe Domain Repositories**: Each modular monolith domain module (`services/api/src/modules/<domain>/`) uses repository functions mapping SQL rows directly into shared TypeScript interfaces defined in `@nearvia/types`.
- **Authoritative SQL Migrations**: Schema evolution is strictly driven by sequential SQL files under `database/migrations/`.

---

## 3. Alternatives Considered

| Alternative                     | Evaluation & Shortcomings                                                                                                                                                                                  | Reason for Rejection                                                                     |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Prisma ORM**                  | Heavy runtime engine binary; poor native PostGIS geography point support without fragile raw SQL escapes; auto-generated migrations frequently corrupt complex spatial GIST indexes and check constraints. | High risk of spatial abstraction friction and large bundle overhead.                     |
| **TypeORM / Sequelize**         | Verbose decorator syntax; complex legacy entity state caching; poor PostGIS SRID 4326 geography mapping out-of-the-box.                                                                                    | Architectural complexity and maintenance burden.                                         |
| **Kysely / Knex Query Builder** | Better than full ORMs, but adds an extra query AST layer that requires custom extensions for complex PostGIS functions (`ST_DWithin`, `ST_Distance`).                                                      | Unnecessary layer when parameterized SQL with typed wrappers is cleaner and transparent. |

---

## 4. Consequences & Benefits

### Positive:

- **100% Native PostGIS Compatibility**: Full access to all PostGIS geodesic functions, spatial aggregations, and bounding-box queries without ORM limitations.
- **Zero ORM Magic / Full SQL Control**: Database performance, index utilization (`GIST`, B-tree), and query plans (`EXPLAIN ANALYZE`) remain directly observable and optimizable.
- **Lightweight & High-Performance**: Sub-millisecond query overhead with minimal memory footprint.
- **AI-Agent Friendly**: Pure SQL queries are universally understood and debugged by AI coding agents without framework-specific ORM quirks.

### Neutral / Trade-offs:

- Repository query functions require writing explicit parameterized SQL statements with mapped interfaces, which is easily mitigated by adhering to consistent domain module patterns.
