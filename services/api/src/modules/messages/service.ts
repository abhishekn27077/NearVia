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
   * Get or create a conversation between worker and provider for a specific work opportunity
   */
  public async getOrCreateConversation(
    userId: string,
    role: UserRole,
    workOpportunityId: string,
    targetWorkerUserId?: string,
  ): Promise<ConversationItem> {
    // 1. Verify opportunity exists
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

    let workerId: string = "";
    let providerId: string = opp.provider_id;

    if (role === UserRole.WORKER) {
      // Find worker profile for this user
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
    } else {
      throw new AppError("Only workers and employers can initiate conversations.", 403, ErrorCode.FORBIDDEN);
    }

    // 2. Check relationship legitimacy (must have an application or assignment on this job)
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

    // 3. Upsert conversation
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

    const fullConv = await this.getConversationById(userId, convId);
    return fullConv;
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
    } else {
      whereClause = "wp.user_id = $1 OR pp.user_id = $1";
    }

    const res = await query<{
      id: string;
      work_opportunity_id: string;
      opportunity_title: string;
      worker_id: string;
      worker_user_id: string;
      worker_full_name: string;
      worker_avatar_url: string | null;
      provider_id: string;
      provider_user_id: string;
      provider_full_name: string;
      provider_business_name: string | null;
      last_message_text: string | null;
      last_message_at: string;
      unread_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT 
        c.id,
        c.work_opportunity_id,
        wo.title AS opportunity_title,
        c.worker_id,
        wp.user_id AS worker_user_id,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        c.provider_id,
        pp.user_id AS provider_user_id,
        up.full_name AS provider_full_name,
        pp.business_name AS provider_business_name,
        c.last_message_text,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN work_opportunities wo ON c.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON c.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       JOIN provider_profiles pp ON c.provider_id = pp.id
       JOIN users up ON pp.user_id = up.id
       WHERE ${whereClause}
       ORDER BY c.last_message_at DESC`,
      [userId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      workOpportunityId: r.work_opportunity_id,
      opportunityTitle: r.opportunity_title,
      workerId: r.worker_id,
      workerUserId: r.worker_user_id,
      workerFullName: r.worker_full_name,
      workerAvatarUrl: r.worker_avatar_url || undefined,
      providerId: r.provider_id,
      providerUserId: r.provider_user_id,
      providerFullName: r.provider_full_name,
      providerBusinessName: r.provider_business_name || undefined,
      lastMessageText: r.last_message_text || undefined,
      lastMessageAt: r.last_message_at,
      unreadCount: parseInt(r.unread_count || "0", 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Get single conversation details by ID
   */
  public async getConversationById(
    userId: string,
    conversationId: string,
  ): Promise<ConversationItem> {
    const res = await query<{
      id: string;
      work_opportunity_id: string;
      opportunity_title: string;
      worker_id: string;
      worker_user_id: string;
      worker_full_name: string;
      worker_avatar_url: string | null;
      provider_id: string;
      provider_user_id: string;
      provider_full_name: string;
      provider_business_name: string | null;
      last_message_text: string | null;
      last_message_at: string;
      unread_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT 
        c.id,
        c.work_opportunity_id,
        wo.title AS opportunity_title,
        c.worker_id,
        wp.user_id AS worker_user_id,
        uw.full_name AS worker_full_name,
        uw.avatar_url AS worker_avatar_url,
        c.provider_id,
        pp.user_id AS provider_user_id,
        up.full_name AS provider_full_name,
        pp.business_name AS provider_business_name,
        c.last_message_text,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN work_opportunities wo ON c.work_opportunity_id = wo.id
       JOIN worker_profiles wp ON c.worker_id = wp.id
       JOIN users uw ON wp.user_id = uw.id
       JOIN provider_profiles pp ON c.provider_id = pp.id
       JOIN users up ON pp.user_id = up.id
       WHERE c.id = $2`,
      [userId, conversationId],
    );

    const r = res.rows[0];
    if (!r) {
      throw new AppError("Conversation not found.", 404, ErrorCode.NOT_FOUND);
    }

    if (r.worker_user_id !== userId && r.provider_user_id !== userId) {
      throw new AppError("You are not authorized to access this conversation.", 403, ErrorCode.FORBIDDEN);
    }

    return {
      id: r.id,
      workOpportunityId: r.work_opportunity_id,
      opportunityTitle: r.opportunity_title,
      workerId: r.worker_id,
      workerUserId: r.worker_user_id,
      workerFullName: r.worker_full_name,
      workerAvatarUrl: r.worker_avatar_url || undefined,
      providerId: r.provider_id,
      providerUserId: r.provider_user_id,
      providerFullName: r.provider_full_name,
      providerBusinessName: r.provider_business_name || undefined,
      lastMessageText: r.last_message_text || undefined,
      lastMessageAt: r.last_message_at,
      unreadCount: parseInt(r.unread_count || "0", 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Get messages for a conversation and mark received messages as read
   */
  public async getMessages(
    userId: string,
    conversationId: string,
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

    // 3. Fetch messages
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
       ORDER BY m.created_at ASC`,
      [conversationId],
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
   * Send a message in a conversation
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

    const recipientId =
      conv.workerUserId === senderUserId ? conv.providerUserId : conv.workerUserId;
    const senderName =
      conv.workerUserId === senderUserId ? conv.workerFullName : conv.providerFullName;

    // 2. Insert message
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

    // 3. Update conversation last message timestamp & preview
    await query(
      `UPDATE conversations
       SET last_message_text = $1, last_message_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [trimmed.slice(0, 100), conversationId],
    );

    // 4. Send background notification to recipient
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
