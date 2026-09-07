# NEARVIA Database Architecture & PostGIS Foundation

> **Document Version**: 1.0.0  
> **Status**: Approved Infrastructure Specification (Phase 2)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Database Overview & Strategy

- **Primary Relational Store**: **PostgreSQL 15+** is the single source of truth for all structured application data (users, profiles, tasks, shifts, applications, assignments, ratings, disputes, payments).
- **Geospatial Engine**: **PostGIS extension** powers all spatial operations, including 5 km radius searches, distance calculations, and proximity bounding boxes.
- **Single Store Architecture**: NEARVIA does not use multiple databases (no MongoDB, SQLite in production, or separate spatial DBs).

---

## 2. Spatial PostGIS Role in Hyperlocal Matching

1. **Spatial Data Type**: Locations are stored as `GEOGRAPHY(Point, 4326)` (WGS 84 coordinate reference system).
2. **Indexing**: Indexed with **GIST (Generalized Search Tree)** spatial indexes for sub-50ms proximity queries.
3. **Core Query Functions**:
   - `ST_DWithin(location1, location2, radius_meters)`: Filters candidates within the default 5 km (5000m) radius.
   - `ST_Distance(location1, location2)`: Computes geodesic distance in meters for explainable match scoring.
4. **Privacy Protection**: Exact worker coordinates are never broadcast publicly. Public feeds use approximate centroid coordinates.

---

## 3. Schema Evolution & Migration Workflow

- **`database/migrations/`**: The authoritative source of schema evolution. Numbered sequential SQL files applied in strict order.
  - `00001_init_postgis.sql`: Installs `uuid-ossp` and `postgis` extensions.
  - `00002_initial_schema.sql`: Full relational DDL skeleton (to be finalized in Phase 3).
- **`database/seeds/`**: Seed scripts providing verified skill taxonomies and baseline lookup categories for local development and integration testing.
- **`database/schema/`**: Entity relational diagrams (ERD) and table contract references.

---

## 4. Credential Security

- Production database credentials must NEVER be placed in source code or committed to Git.
- Use `DATABASE_URL` configured securely via environment variables.
