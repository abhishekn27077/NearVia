-- ==============================================================================
-- NEARVIA Migration: 00025_notifications_messaging_hardening.sql
-- Harden notifications and messaging:
-- 1. Support direct Agent <-> Worker conversations (nullable work_opportunity_id & provider_id, agent_id FK)
-- 2. Performance indexes on notifications and messages
-- 3. RLS updates for counterparty-restricted access and active assisting agent access
-- ==============================================================================

-- 1. Support direct Agent <-> Worker conversations alongside Job conversations
ALTER TABLE conversations ALTER COLUMN work_opportunity_id DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN provider_id DROP NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_conversation_participants;
ALTER TABLE conversations ADD CONSTRAINT chk_conversation_participants 
  CHECK ((work_opportunity_id IS NOT NULL AND provider_id IS NOT NULL) OR (agent_id IS NOT NULL));

-- Unique constraint for direct Agent <-> Worker conversations
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_agent_worker 
  ON conversations(worker_id, agent_id) 
  WHERE agent_id IS NOT NULL AND work_opportunity_id IS NULL;

-- 2. Performance indexes for notification lists and message threads
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread_created 
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
  ON messages(conversation_id, created_at ASC);

-- 3. Update Row Level Security (RLS) for conversations
DROP POLICY IF EXISTS "Allow participants to read conversations" ON conversations;
CREATE POLICY "Allow participants to read conversations"
  ON conversations FOR SELECT
  USING (
    -- Worker participant
    EXISTS (
      SELECT 1 FROM worker_profiles wp 
      JOIN users u ON wp.user_id = u.id
      WHERE wp.id = conversations.worker_id 
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
    OR
    -- Provider participant
    (
      conversations.provider_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM provider_profiles pp 
        JOIN users u ON pp.user_id = u.id
        WHERE pp.id = conversations.provider_id 
          AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
      )
    )
    OR
    -- Direct Agent participant
    (
      conversations.agent_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM agent_profiles ap 
        JOIN users u ON ap.user_id = u.id
        WHERE ap.id = conversations.agent_id 
          AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
      )
    )
    OR
    -- Assisting Agent with ACTIVE relationship on worker
    EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE awr.worker_id = conversations.worker_id
        AND awr.status = 'ACTIVE'
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Allow participants to modify conversations" ON conversations;
CREATE POLICY "Allow participants to modify conversations"
  ON conversations FOR ALL
  USING (
    -- Worker participant
    EXISTS (
      SELECT 1 FROM worker_profiles wp 
      JOIN users u ON wp.user_id = u.id
      WHERE wp.id = conversations.worker_id 
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
    OR
    -- Provider participant
    (
      conversations.provider_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM provider_profiles pp 
        JOIN users u ON pp.user_id = u.id
        WHERE pp.id = conversations.provider_id 
          AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
      )
    )
    OR
    -- Direct Agent participant
    (
      conversations.agent_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM agent_profiles ap 
        JOIN users u ON ap.user_id = u.id
        WHERE ap.id = conversations.agent_id 
          AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
      )
    )
    OR
    -- Assisting Agent with ACTIVE relationship on worker
    EXISTS (
      SELECT 1 FROM agent_worker_relationships awr
      JOIN agent_profiles ap ON awr.agent_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE awr.worker_id = conversations.worker_id
        AND awr.status = 'ACTIVE'
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
  );
