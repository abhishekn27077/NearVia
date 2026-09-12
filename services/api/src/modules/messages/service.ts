/**
 * Messages Service
 * Handles conversation creation, message dispatch, read receipts, and access control.
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { UserRole } from "@nearvia/types";
import { ConversationItem, MessageItem } from "./types";
import { notificationsService } from "../notifications/service";

export class MessagesService {
  /**
   * Get or create a conversation between legitimate marketplace counterparties:
   * 1. Job Conversation: Worker <-> Provider (with application or assignment on workOpportunityId)
   * 2. Direct Agent <-> Worker Conversation (with ACTIVE relationship)
   */
  public async getOrCreateConversation(
    userId: string,
    role: UserRole,
    workOpportunityId?: string,
    targetWorkerUserId?: string,
    targetAgentUserId?: string,
  ): Promise<ConversationItem> {
    // -------------------------------------------------------------------------
    // CASE A: Work Opportunity Conversation (Provider <-> Worker, or Agent on behalf of Worker)
    // -------------------------------------------------------------------------
    if (workOpportunityId) {
      const oppRes = await query<{
        id: string;
        title: string;
        provider_id: string;
        provider_user_id: string;
      }>(
        `SELECT wo.id, wo.title, wo.provider_id, pp.user_id AS provider_user_id
         FROM work_opportunities wo
         JOIN provider_profiles pp ON wo.provider_id = pp.id
         WHERE wo.id = $1`,
        [workOpportunityId],
      );

      const opp = oppRes.rows[0];
      if (!opp) {
        throw new AppError("Work opportunity not found.", 404, ErrorCode.NOT_FOUND);
      }

      let workerId = "";
      const providerId = opp.provider_id;

      if (role === UserRole.WORKER) {
        const wpRes = await query<{ id: string }>(
          "SELECT id FROM worker_profiles WHERE user_id = $1",
          [userId],
        );
        if (!wpRes.rows[0]) {
          throw new AppError("Worker profile not found.", 404, ErrorCode.NOT_FOUND);
        }
        workerId = wpRes.rows[0].id;
      } else if (role === UserRole.PROVIDER) {
        if (opp.provider_user_id !== userId) {
          throw new AppError("You do not own this work opportunity.", 403, ErrorCode.FORBIDDEN);
        }
        if (!targetWorkerUserId) {
          throw new AppError("Target worker is required to initiate conversation.", 400, ErrorCode.VALIDATION_ERROR);
        }
        const wpRes = await query<{ id: string }>(
          "SELECT id FROM worker_profiles WHERE user_id = $1",
          [targetWorkerUserId],
        );
        if (!wpRes.rows[0]) {
          throw new AppError("Target worker profile not found.", 404, ErrorCode.NOT_FOUND);
        }
        workerId = wpRes.rows[0].id;
      } else if (role === UserRole.AGENT) {
        if (!targetWorkerUserId) {
          throw new AppError("Target worker is required for agent-assisted messaging.", 400, ErrorCode.VALIDATION_ERROR);
        }
        const wpRes = await query<{ id: string }>(
          "SELECT id FROM worker_profiles WHERE user_id = $1",
          [targetWorkerUserId],
        );
        if (!wpRes.rows[0]) {
          throw new AppError("Target worker profile not found.", 404, ErrorCode.NOT_FOUND);
        }
        workerId = wpRes.rows[0].id;

        // Verify active agent-worker relationship
        const agentCheck = await query<{ id: string }>(
          `SELECT awr.id 
           FROM agent_worker_relationships awr
           JOIN agent_profiles ap ON awr.agent_id = ap.id
           WHERE ap.user_id = $1 AND awr.worker_id = $2 AND awr.status = 'ACTIVE'`,
          [userId, workerId],
        );
        if (!agentCheck.rows[0]) {
          throw new AppError("You do not have active authorization to represent this worker.", 403, ErrorCode.FORBIDDEN);
        }
      } else {
        throw new AppError("Only workers, employers, or authorized agents can participate in conversations.", 403, ErrorCode.FORBIDDEN);
      }

      // Verify legitimate marketplace relationship (must have application or assignment on this opportunity)
      const relRes = await query<{ has_rel: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM applications WHERE work_opportunity_id = $1 AND worker_id = $2
           UNION
           SELECT 1 FROM assignments WHERE work_opportunity_id = $1 AND worker_id = $2
         ) AS has_rel`,
        [workOpportunityId, workerId],
      );

      if (!relRes.rows[0]?.has_rel) {
        throw new AppError(
          "A valid application or shift assignment is required to start a conversation.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      // Upsert Job conversation
      const convRes = await query<{ id: string }>(
        `INSERT INTO conversations (work_opportunity_id, worker_id, provider_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (work_opportunity_id, worker_id)
         DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [workOpportunityId, workerId, providerId],
      );

      const convId = convRes.rows[0]?.id;
      if (!convId) {
        throw new AppError("Failed to initialize conversation.", 500, ErrorCode.DATABASE_ERROR);
      }

      return this.getConversationById(userId, convId);
    }

    // -------------------------------------------------------------------------
    // CASE B: Direct Agent <-> Worker Conversation
    // -------------------------------------------------------------------------
    let workerProfileId = "";
    let agentProfileId = "";

    if (role === UserRole.AGENT) {
      if (!targetWorkerUserId) {
        throw new AppError("Target worker is required to initiate agent conversation.", 400, ErrorCode.VALIDATION_ERROR);
      }
      const apRes = await query<{ id: string }>("SELECT id FROM agent_profiles WHERE user_id = $1", [userId]);
      if (!apRes.rows[0]) {
        throw new AppError("Agent profile not found.", 404, ErrorCode.NOT_FOUND);
      }
      agentProfileId = apRes.rows[0].id;

      const wpRes = await query<{ id: string }>("SELECT id FROM worker_profiles WHERE user_id = $1", [targetWorkerUserId]);
      if (!wpRes.rows[0]) {
        throw new AppError("Target worker profile not found.", 404, ErrorCode.NOT_FOUND);
      }
      workerProfileId = wpRes.rows[0].id;
    } else if (role === UserRole.WORKER) {
      if (!targetAgentUserId) {
        throw new AppError("Target agent is required to initiate conversation with an agent.", 400, ErrorCode.VALIDATION_ERROR);
      }
      const wpRes = await query<{ id: string }>("SELECT id FROM worker_profiles WHERE user_id = $1", [userId]);
      if (!wpRes.rows[0]) {
        throw new AppError("Worker profile not found.", 404, ErrorCode.NOT_FOUND);
      }
      workerProfileId = wpRes.rows[0].id;

      const apRes = await query<{ id: string }>("SELECT id FROM agent_profiles WHERE user_id = $1", [targetAgentUserId]);
      if (!apRes.rows[0]) {
        throw new AppError("Target agent profile not found.", 404, ErrorCode.NOT_FOUND);
      }
      agentProfileId = apRes.rows[0].id;
    } else {
      throw new AppError("Only linked agents and workers can initiate direct assistance conversations.", 403, ErrorCode.FORBIDDEN);
    }

    // Check ACTIVE status in agent_worker_relationships
    const activeRel = await query<{ id: string }>(
      `SELECT id FROM agent_worker_relationships
       WHERE agent_id = $1 AND worker_id = $2 AND status = 'ACTIVE'`,
      [agentProfileId, workerProfileId],
    );

    if (!activeRel.rows[0]) {
      throw new AppError(
        "An active agent-worker relationship is required to initiate messaging.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    // Upsert direct conversation
    const existingConv = await query<{ id: string }>(
      `SELECT id FROM conversations 
       WHERE worker_id = $1 AND agent_id = $2 AND work_opportunity_id IS NULL`,
      [workerProfileId, agentProfileId],
    );

    if (existingConv.rows[0]) {
      return this.getConversationById(userId, existingConv.rows[0].id);
    }

    const newConvRes = await query<{ id: string }>(
      `INSERT INTO conversations (worker_id, agent_id, updated_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [workerProfileId, agentProfileId],
    );

    const convId = newConvRes.rows[0]?.id;
    if (!convId) {
      throw new AppError("Failed to initialize direct conversation.", 500, ErrorCode.DATABASE_ERROR);
    }

    return this.getConversationById(userId, convId);
  }

  /**
   * Get all conversations for authenticated user
   */
  public async getMyConversations(
    userId: string,
    role: UserRole,
  ): Promise<ConversationItem[]> {
    let whereClause = "";
    if (role === UserRole.WORKER) {
      whereClause = "wp.user_id = $1";
    } else if (role === UserRole.PROVIDER) {
      whereClause = "pp.user_id = $1";
    } else if (role === UserRole.AGENT) {
      whereClause = `(
        ap.user_id = $1 OR 
        c.worker_id IN (
          SELECT awr.worker_id 
          FROM agent_worker_relationships awr
          JOIN agent_profiles ap2 ON awr.agent_id = ap2.id
          WHERE ap2.user_id = $1 AND awr.status = 'ACTIVE'
        )
      )`;
    } else {
      whereClause = "wp.user_id = $1 OR pp.user_id = $1 OR ap.user_id = $1";
    }

    const res = await query<{
      id: string;
      work_opportunity_id: string | null;
      opportunity_title: string | null;
      worker_id: string;
      worker_user_id: string;
      worker_full_name: string;
      worker_avatar_url: string | null;
      provider_id: string | null;
      provider_user_id: string | null;
      provider_full_name: string | null;
      provider_business_name: string | null;
      agent_id: string | null;
      agent_user_id: string | null;
      agent_full_name: string | null;
      last_message_text: string | null;
      last_message_at: string;
      unread_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT 
        c.id,
        c.work_opportunity_id,
        COALESCE(wo.title, 'Direct Assistance') AS opportunity_title,
        c.worker_id,
        wp.user_id AS worker_user_id,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        c.provider_id,
        pp.user_id AS provider_user_id,
        up.full_name AS provider_full_name,
        pp.business_name AS provider_business_name,
        c.agent_id,
        ap.user_id AS agent_user_id,
        ua.full_name AS agent_full_name,
        c.last_message_text,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       LEFT JOIN work_opportunities wo ON c.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON c.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       LEFT JOIN provider_profiles pp ON c.provider_id = pp.id
       LEFT JOIN users up ON pp.user_id = up.id
       LEFT JOIN agent_profiles ap ON c.agent_id = ap.id
       LEFT JOIN users ua ON ap.user_id = ua.id
       WHERE ${whereClause}
       ORDER BY c.last_message_at DESC`,
      [userId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      workOpportunityId: r.work_opportunity_id || undefined,
      opportunityTitle: r.opportunity_title || "Direct Conversation",
      workerId: r.worker_id,
      workerUserId: r.worker_user_id,
      workerFullName: r.worker_full_name,
      workerAvatarUrl: r.worker_avatar_url || undefined,
      providerId: r.provider_id || undefined,
      providerUserId: r.provider_user_id || undefined,
      providerFullName: r.provider_full_name || undefined,
      providerBusinessName: r.provider_business_name || undefined,
      agentId: r.agent_id || undefined,
      agentUserId: r.agent_user_id || undefined,
      agentFullName: r.agent_full_name || undefined,
      lastMessageText: r.last_message_text || undefined,
      lastMessageAt: r.last_message_at,
      unreadCount: parseInt(r.unread_count || "0", 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Get single conversation details by ID with strict counterparty authorization.
   * Private conversations are NOT exposed to admins without an explicit moderation workflow.
   */
  public async getConversationById(
    userId: string,
    conversationId: string,
  ): Promise<ConversationItem> {
    const res = await query<{
      id: string;
      work_opportunity_id: string | null;
      opportunity_title: string | null;
      worker_id: string;
      worker_user_id: string;
      worker_full_name: string;
      worker_avatar_url: string | null;
      provider_id: string | null;
      provider_user_id: string | null;
      provider_full_name: string | null;
      provider_business_name: string | null;
      agent_id: string | null;
      agent_user_id: string | null;
      agent_full_name: string | null;
      last_message_text: string | null;
      last_message_at: string;
      unread_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT 
        c.id,
        c.work_opportunity_id,
        COALESCE(wo.title, 'Direct Assistance') AS opportunity_title,
        c.worker_id,
        wp.user_id AS worker_user_id,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        c.provider_id,
        pp.user_id AS provider_user_id,
        up.full_name AS provider_full_name,
        pp.business_name AS provider_business_name,
        c.agent_id,
        ap.user_id AS agent_user_id,
        ua.full_name AS agent_full_name,
        c.last_message_text,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       LEFT JOIN work_opportunities wo ON c.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON c.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       LEFT JOIN provider_profiles pp ON c.provider_id = pp.id
       LEFT JOIN users up ON pp.user_id = up.id
       LEFT JOIN agent_profiles ap ON c.agent_id = ap.id
       LEFT JOIN users ua ON ap.user_id = ua.id
       WHERE c.id = $2`,
      [userId, conversationId],
    );

    const r = res.rows[0];
    if (!r) {
      throw new AppError("Conversation not found.", 404, ErrorCode.NOT_FOUND);
    }

    const isWorker = r.worker_user_id === userId;
    const isProvider = r.provider_user_id === userId;
    const isDirectAgent = r.agent_user_id === userId;

    if (!isWorker && !isProvider && !isDirectAgent) {
      // Check if user is an assisting agent with an ACTIVE relationship with this worker
      const agentCheck = await query<{ id: string }>(
        `SELECT awr.id 
         FROM agent_worker_relationships awr
         JOIN agent_profiles ap ON awr.agent_id = ap.id
         WHERE ap.user_id = $1 AND awr.worker_id = $2 AND awr.status = 'ACTIVE'`,
        [userId, r.worker_id],
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(
          "You are not authorized to access this conversation.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    return {
      id: r.id,
      workOpportunityId: r.work_opportunity_id || undefined,
      opportunityTitle: r.opportunity_title || "Direct Conversation",
      workerId: r.worker_id,
      workerUserId: r.worker_user_id,
      workerFullName: r.worker_full_name,
      workerAvatarUrl: r.worker_avatar_url || undefined,
      providerId: r.provider_id || undefined,
      providerUserId: r.provider_user_id || undefined,
      providerFullName: r.provider_full_name || undefined,
      providerBusinessName: r.provider_business_name || undefined,
      agentId: r.agent_id || undefined,
      agentUserId: r.agent_user_id || undefined,
      agentFullName: r.agent_full_name || undefined,
      lastMessageText: r.last_message_text || undefined,
      lastMessageAt: r.last_message_at,
      unreadCount: parseInt(r.unread_count || "0", 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Get messages for a conversation with pagination and mark received messages as read
   */
  public async getMessages(
    userId: string,
    conversationId: string,
    limit = 50,
    offset = 0,
  ): Promise<MessageItem[]> {
    // 1. Authorization check
    await this.getConversationById(userId, conversationId);

    // 2. Mark unread messages addressed to current user as read
    await query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE conversation_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [conversationId, userId],
    );

    // 3. Fetch messages with pagination and authoritative order
    const res = await query<{
      id: string;
      conversation_id: string;
      sender_id: string;
      sender_name: string;
      recipient_id: string;
      content: string;
      read_at: string | null;
      created_at: string;
    }>(
      `SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        u.full_name AS sender_name,
        m.recipient_id,
        m.content,
        m.read_at,
        m.created_at
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset],
    );

    return res.rows.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      recipientId: m.recipient_id,
      content: m.content,
      isMine: m.sender_id === userId,
      readAt: m.read_at || undefined,
      createdAt: m.created_at,
    }));
  }

  /**
   * Send a message in a conversation with sender verification and duplicate send suppression
   */
  public async sendMessage(
    senderUserId: string,
    conversationId: string,
    content: string,
  ): Promise<MessageItem> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new AppError("Message content cannot be empty.", 400, ErrorCode.VALIDATION_ERROR);
    }
    if (trimmed.length > 2000) {
      throw new AppError("Message content exceeds 2,000 characters limit.", 400, ErrorCode.VALIDATION_ERROR);
    }

    // 1. Fetch conversation and verify authorization
    const conv = await this.getConversationById(senderUserId, conversationId);

    // 2. Fetch authoritative sender name from users table (prevents spoofing)
    const senderRes = await query<{ full_name: string }>(
      "SELECT full_name FROM users WHERE id = $1",
      [senderUserId],
    );
    const senderName = senderRes.rows[0]?.full_name || "User";

    // 3. Determine authoritative recipientId
    let recipientId = "";
    if (conv.agentUserId && !conv.providerUserId) {
      // Direct Agent <-> Worker conversation
      recipientId =
        conv.workerUserId === senderUserId ? conv.agentUserId : conv.workerUserId;
    } else {
      // Work Opportunity conversation (Worker <-> Provider, or assisting Agent)
      if (senderUserId === conv.workerUserId) {
        recipientId = conv.providerUserId || "";
      } else if (senderUserId === conv.providerUserId) {
        recipientId = conv.workerUserId;
      } else {
        // Assisting agent sending on behalf of worker -> delivers to provider
        recipientId = conv.providerUserId || conv.workerUserId;
      }
    }

    if (!recipientId) {
      throw new AppError("Unable to determine valid message recipient.", 400, ErrorCode.VALIDATION_ERROR);
    }

    // 4. Duplicate request suppression (identical message within 3 seconds)
    const recentDup = await query<{
      id: string;
      conversation_id: string;
      sender_id: string;
      recipient_id: string;
      content: string;
      read_at: string | null;
      created_at: string;
    }>(
      `SELECT id, conversation_id, sender_id, recipient_id, content, read_at, created_at
       FROM messages 
       WHERE conversation_id = $1 AND sender_id = $2 AND content = $3
         AND created_at > NOW() - INTERVAL '3 seconds'
       ORDER BY created_at DESC
       LIMIT 1`,
      [conversationId, senderUserId, trimmed],
    );

    if (recentDup.rows[0]) {
      const dup = recentDup.rows[0];
      return {
        id: dup.id,
        conversationId: dup.conversation_id,
        senderId: dup.sender_id,
        senderName,
        recipientId: dup.recipient_id,
        content: dup.content,
        isMine: true,
        readAt: dup.read_at || undefined,
        createdAt: dup.created_at,
      };
    }

    // 5. Insert message
    const res = await query<{
      id: string;
      conversation_id: string;
      sender_id: string;
      recipient_id: string;
      content: string;
      read_at: string | null;
      created_at: string;
    }>(
      `INSERT INTO messages (conversation_id, sender_id, recipient_id, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, conversation_id, sender_id, recipient_id, content, read_at, created_at`,
      [conversationId, senderUserId, recipientId, trimmed],
    );

    const msg = res.rows[0];
    if (!msg) {
      throw new AppError("Failed to send message.", 500, ErrorCode.DATABASE_ERROR);
    }

    // 6. Update conversation last message timestamp & preview
    await query(
      `UPDATE conversations
       SET last_message_text = $1, last_message_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [trimmed.slice(0, 100), conversationId],
    );

    // 7. Send background notification to recipient
    notificationsService
      .createNotification(
        recipientId,
        "NEW_MESSAGE",
        `Message from ${senderName}`,
        trimmed.length > 80 ? trimmed.slice(0, 80) + "..." : trimmed,
        { conversationId, workOpportunityId: conv.workOpportunityId },
      )
      .catch((err) => console.error("Notification trigger failed:", err));

    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      senderName,
      recipientId: msg.recipient_id,
      content: msg.content,
      isMine: true,
      readAt: msg.read_at || undefined,
      createdAt: msg.created_at,
    };
  }
}

export const messagesService = new MessagesService();
