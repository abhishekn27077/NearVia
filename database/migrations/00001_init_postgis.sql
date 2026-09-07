-- ==============================================================================
-- Migration: 00001_init_postgis.sql
-- Purpose: Enable UUID Generation and PostGIS Spatial Extension for NEARVIA
-- ==============================================================================

-- Enable UUID extension for globally unique primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS extension for high-performance geodesic spatial queries
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Log confirmation
DO $$
BEGIN
  RAISE NOTICE 'NEARVIA PostGIS Extension successfully initialized: %', postgis_full_version();
END $$;
