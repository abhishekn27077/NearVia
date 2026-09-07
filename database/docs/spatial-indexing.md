# PostGIS Spatial Indexing Strategy for NEARVIA

## 1. Hyperlocal 5 KM Requirement

NEARVIA focuses strictly on hyperlocal quick work within an approximate 5 km radius. To achieve sub-50ms query response times under high concurrency, spatial lookups leverage PostGIS `GEOGRAPHY(Point, 4326)` with **GIST (Generalized Search Tree)** indexes.

## 2. GIST Spatial Indexing

```sql
-- Spatial indexing on worker and job locations
CREATE INDEX idx_worker_profiles_location ON worker_profiles USING GIST(location);
CREATE INDEX idx_job_posts_location ON job_posts USING GIST(location);
```

## 3. High-Performance Spatial Query Pattern

To query all available workers within 5 km of a job location:

```sql
SELECT
  w.id,
  w.user_id,
  u.full_name,
  ST_Distance(w.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km
FROM worker_profiles w
JOIN users u ON u.id = w.user_id
WHERE w.is_available_now = TRUE
  AND ST_DWithin(
    w.location,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3 * 1000 -- radius in meters (e.g. 5000)
  )
ORDER BY distance_km ASC;
```

## 4. Privacy Considerations

Exact coordinates of workers are strictly protected. Approximate location (fuzzed to ~200-500 meters or neighborhood level) is displayed to job providers until an assignment is mutually accepted and active.
