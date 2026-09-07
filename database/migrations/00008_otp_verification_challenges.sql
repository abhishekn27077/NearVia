-- ------------------------------------------------------------------------------
-- 00008_otp_verification_challenges.sql
-- Production OTP verification challenges & security ledger
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  provider VARCHAR(30) DEFAULT 'mock' NOT NULL,
  provider_reference VARCHAR(255),
  attempts INT DEFAULT 0 NOT NULL,
  max_attempts INT DEFAULT 3 NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_user ON otp_challenges(user_id, phone);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_active ON otp_challenges(user_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_created ON otp_challenges(phone, created_at DESC);
