# NEARVIA Database Architecture & Migrations

> **Relational Core**: PostgreSQL 15+  
> **Geospatial Engine**: PostGIS `GEOGRAPHY(Point, 4326)`  
> **Search Radius Default**: 5 km (5000 meters) with GIST Spatial Indexing

---

## 1. Migration Hierarchy (`database/migrations/`)

- `00001_init_postgis.sql`: Enables `uuid-ossp` and `postgis` extensions.
- `00002_master_schema.sql`: Full DDL defining 19 normalized relational tables, check constraints, unique constraints, and spatial GIST indexes.

---

## 2. Seed Data Hierarchy (`database/seeds/`)

- `001_reference_data.sql`: Official domain work categories (10 categories) and verified skills taxonomy (13 skills).
- `002_test_fixtures.sql`: Deterministic test fixtures for spatial 5 km query validation (Worker A in Domlur at ~2 km, Worker B in Whitefield at ~11.8 km).

---

## 3. Schema Documentation (`docs/database/`)

- [`DATABASE_DESIGN.md`](../docs/database/DATABASE_DESIGN.md): Master Technical ERD, Academic Simplified ERD, spatial query mechanics, and privacy policies.
- [`DATA_DICTIONARY.md`](../docs/database/DATA_DICTIONARY.md): Complete schema reference catalog for all 19 entities.
- [`ADR-007`](../docs/decisions/ADR-007-database-access-strategy.md): Database access strategy (`pg` connection pooling + typed repositories).
