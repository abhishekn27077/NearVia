# ADR-002: PostgreSQL and PostGIS as Single Source of Truth for Relational and Geospatial Data

## Status

Accepted

## Context

NEARVIA relies heavily on proximity-based searches within a 5 km radius, spatial bounding boxes, and complex relational constraints (workers, providers, applications, assignments, and payments).

## Decision

We select **PostgreSQL** with the **PostGIS extension** as the single primary database for both relational application data and spatial geospatial queries. Geolocation coordinates are stored using the `GEOGRAPHY(Point, 4326)` data type and indexed with spatial GIST indexes.

## Alternatives Considered

1. **Separate Document DB (MongoDB) + Geospatial**: Rejected to avoid split-brain data consistency issues, dual ORMs, and lack of ACID transactional integrity across marketplace entities.
2. **PostgreSQL without PostGIS (using manual Euclidean math)**: Rejected because manual spherical math in SQL does not scale efficiently with spatial indexing and cannot leverage optimized spatial bounding operations (`ST_DWithin`, `ST_Distance`).

## Consequences

- **Positive**: Single ACID-compliant database; native spatial acceleration via GIST indexing; robust relational constraints; proven scalability.
- **Negative**: Requires PostGIS extension support on hosting instances (fully supported by Supabase, Render, AWS RDS).
