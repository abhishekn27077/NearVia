# Database Schema Documentation

## Engine Overview

- **Primary Relational Store**: PostgreSQL (15+)
- **Geospatial Engine**: PostGIS extension
- **Spatial Reference System**: WGS 84 (SRID 4326), stored as `GEOGRAPHY(Point, 4326)`

## Core Entity Relationships

1. **Users (`users`)**: Central identity entity linked to Supabase Auth UID.
2. **Worker Profiles (`worker_profiles`)**: Spatial entity with current coordinates, service radius (default 5 km), availability status, and skills.
3. **Job Provider Profiles (`job_provider_profiles`)**: Spatial entity representing businesses, shops, restaurants, and individuals posting work.
4. **Agent Profiles (`agent_profiles`)**: Local verified assistants who assist low-digital-literacy workers.
5. **Job Posts (`job_posts`)**: Short-duration, time-bound tasks and shifts with exact spatial points.
6. **Applications & Assignments (`job_applications`, `job_assignments`)**: Two-sided workflow tracking from application to shift completion and wage release.
7. **Reputation & Disputes (`reviews`, `disputes`)**: Mutual ratings and conflict resolution records.
