-- ==============================================================================
-- NEARVIA DATABASE MIGRATION: 00006_platform_events.sql
-- Phase 17: Analytics, Monitoring & Platform Health
-- ==============================================================================

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(64),
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_user ON platform_events(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_created ON platform_events(created_at DESC);
