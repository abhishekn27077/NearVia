/**
 * Messages Module Types
 */

export interface ConversationItem {
  id: string;
  workOpportunityId?: string;
  opportunityTitle: string;
  workerId: string;
  workerUserId: string;
  workerFullName: string;
  workerAvatarUrl?: string;
  providerId?: string;
  providerUserId?: string;
  providerFullName?: string;
  providerBusinessName?: string;
  agentId?: string;
  agentUserId?: string;
  agentFullName?: string;
  lastMessageText?: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  isMine: boolean;
  readAt?: string;
  createdAt: string;
}

export interface SendMessageInput {
  content: string;
}

export interface CreateConversationInput {
  workOpportunityId?: string;
  workerUserId?: string;
  agentUserId?: string;
}

