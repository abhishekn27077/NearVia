-- ==============================================================================
-- NEARVIA Migration: 00007_conversations_and_messages.sql
-- In-app messaging between Workers and Providers for active jobs and applications
-- ==============================================================================

-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_opportunity_id UUID NOT NULL REFERENCES work_opportunities(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_conversation_opportunity_worker UNIQUE (work_opportunity_id, worker_id)
);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_conversations_worker ON conversations(worker_id);
CREATE INDEX IF NOT EXISTS idx_conversations_provider ON conversations(provider_id);
CREATE INDEX IF NOT EXISTS idx_conversations_work_opportunity ON conversations(work_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages(recipient_id) WHERE read_at IS NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. Public / Authenticated RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read on conversations" ON conversations;
CREATE POLICY "Allow authenticated read on conversations"
  ON conversations FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow authenticated insert/update on conversations" ON conversations;
CREATE POLICY "Allow authenticated insert/update on conversations"
  ON conversations FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "Allow authenticated read on messages" ON messages;
CREATE POLICY "Allow authenticated read on messages"
  ON messages FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow authenticated insert on messages" ON messages;
CREATE POLICY "Allow authenticated insert on messages"
  ON messages FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow authenticated update on messages" ON messages;
CREATE POLICY "Allow authenticated update on messages"
  ON messages FOR UPDATE USING (TRUE);
