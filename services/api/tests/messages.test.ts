import { describe, it, expect, vi, beforeEach } from "vitest";
import { messagesService } from "../src/modules/messages/service";
import { UserRole } from "@nearvia/types";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (cb) => {
    const mockClient = { query: vi.fn() };
    return cb(mockClient);
  }),
  pool: { end: vi.fn() },
}));

describe("Phase 17 — In-App Worker <-> Provider Messaging Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Conversation Initiation & Authorization", () => {
    it("Test 1: Worker with valid application can initiate conversation with provider", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_100",
                title: "Cafe Barista",
                provider_id: "pp_100",
                provider_user_id: "u_provider_100",
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_profiles")) {
          return {
            rows: [{ id: "wp_100" }],
          } as any;
        }
        if (sql.includes("has_rel")) {
          return {
            rows: [{ has_rel: true }],
          } as any;
        }
        if (sql.includes("INSERT INTO conversations")) {
          return {
            rows: [{ id: "conv_100" }],
          } as any;
        }
        if (sql.includes("FROM conversations c")) {
          return {
            rows: [
              {
                id: "conv_100",
                work_opportunity_id: "wo_100",
                opportunity_title: "Cafe Barista",
                worker_id: "wp_100",
                worker_user_id: "u_worker_100",
                worker_full_name: "Rahul Kumar",
                worker_avatar_url: null,
                provider_id: "pp_100",
                provider_user_id: "u_provider_100",
                provider_full_name: "Cafe Owner",
                provider_business_name: "Indiranagar Cafe",
                last_message_text: null,
                last_message_at: "2026-09-02T10:00:00Z",
                unread_count: "0",
                created_at: "2026-09-02T10:00:00Z",
                updated_at: "2026-09-02T10:00:00Z",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const conv = await messagesService.getOrCreateConversation(
        "u_worker_100",
        UserRole.WORKER,
        "wo_100",
      );

      expect(conv).toBeDefined();
      expect(conv.id).toBe("conv_100");
      expect(conv.opportunityTitle).toBe("Cafe Barista");
      expect(conv.workerFullName).toBe("Rahul Kumar");
    });

    it("Test 2: Rejects conversation initiation if no relationship (no application/assignment) exists", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_100",
                title: "Cafe Barista",
                provider_id: "pp_100",
                provider_user_id: "u_provider_100",
              },
            ],
          } as any;
        }
        if (sql.includes("FROM worker_profiles")) {
          return { rows: [{ id: "wp_100" }] } as any;
        }
        if (sql.includes("has_rel")) {
          return { rows: [{ has_rel: false }] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        messagesService.getOrCreateConversation(
          "u_worker_100",
          UserRole.WORKER,
          "wo_100",
        ),
      ).rejects.toThrow(
        "A valid application or shift assignment is required to start a conversation.",
      );
    });

    it("Test 3: Provider cannot initiate conversation for another provider's job", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_100",
                title: "Cafe Barista",
                provider_id: "pp_100",
                provider_user_id: "u_provider_100",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        messagesService.getOrCreateConversation(
          "u_imposter_provider",
          UserRole.PROVIDER,
          "wo_100",
          "u_worker_100",
        ),
      ).rejects.toThrow("You do not own this work opportunity.");
    });
  });

  describe("2. Message Dispatch & Retrieval", () => {
    it("Test 4: Sends message successfully, updates preview and delivers recipient message", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes("FROM conversations c")) {
          return {
            rows: [
              {
                id: "conv_100",
                work_opportunity_id: "wo_100",
                opportunity_title: "Cafe Barista",
                worker_id: "wp_100",
                worker_user_id: "u_worker_100",
                worker_full_name: "Rahul Kumar",
                worker_avatar_url: null,
                provider_id: "pp_100",
                provider_user_id: "u_provider_100",
                provider_full_name: "Cafe Owner",
                provider_business_name: "Indiranagar Cafe",
                last_message_text: null,
                last_message_at: "2026-09-02T10:00:00Z",
                unread_count: "0",
                created_at: "2026-09-02T10:00:00Z",
                updated_at: "2026-09-02T10:00:00Z",
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO messages")) {
          return {
            rows: [
              {
                id: "msg_100",
                conversation_id: "conv_100",
                sender_id: "u_worker_100",
                recipient_id: "u_provider_100",
                content: "Hi, I am reaching the venue at 2:00 PM.",
                read_at: null,
                created_at: "2026-09-02T10:05:00Z",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE conversations")) {
          return { rowCount: 1 } as any;
        }
        if (sql.includes("INSERT INTO notifications")) {
          return { rows: [{ id: "notif_msg_100" }] } as any;
        }
        return { rows: [] } as any;
      });

      const msg = await messagesService.sendMessage(
        "u_worker_100",
        "conv_100",
        "Hi, I am reaching the venue at 2:00 PM.",
      );

      expect(msg).toBeDefined();
      expect(msg.id).toBe("msg_100");
      expect(msg.content).toBe("Hi, I am reaching the venue at 2:00 PM.");
      expect(msg.isMine).toBe(true);
      expect(msg.recipientId).toBe("u_provider_100");
    });

    it("Test 5: Rejects empty or oversized messages", async () => {
      await expect(
        messagesService.sendMessage("u_worker_100", "conv_100", "   "),
      ).rejects.toThrow("Message content cannot be empty.");

      const longMsg = "a".repeat(2001);
      await expect(
        messagesService.sendMessage("u_worker_100", "conv_100", longMsg),
      ).rejects.toThrow("Message content exceeds 2,000 characters limit.");
    });

    it("Test 6: Retrieves message history and marks unread messages as read", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM conversations c")) {
          return {
            rows: [
              {
                id: "conv_100",
                work_opportunity_id: "wo_100",
                opportunity_title: "Cafe Barista",
                worker_id: "wp_100",
                worker_user_id: "u_worker_100",
                worker_full_name: "Rahul Kumar",
                worker_avatar_url: null,
                provider_id: "pp_100",
                provider_user_id: "u_provider_100",
                provider_full_name: "Cafe Owner",
                provider_business_name: "Indiranagar Cafe",
                last_message_text: "See you at 2!",
                last_message_at: "2026-09-02T10:06:00Z",
                unread_count: "1",
                created_at: "2026-09-02T10:00:00Z",
                updated_at: "2026-09-02T10:06:00Z",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE messages")) {
          return { rowCount: 1 } as any;
        }
        if (sql.includes("FROM messages m")) {
          return {
            rows: [
              {
                id: "msg_1",
                conversation_id: "conv_100",
                sender_id: "u_worker_100",
                sender_name: "Rahul Kumar",
                recipient_id: "u_provider_100",
                content: "Hi, I am reaching the venue at 2:00 PM.",
                read_at: "2026-09-02T10:06:00Z",
                created_at: "2026-09-02T10:05:00Z",
              },
              {
                id: "msg_2",
                conversation_id: "conv_100",
                sender_id: "u_provider_100",
                sender_name: "Cafe Owner",
                recipient_id: "u_worker_100",
                content: "Great, see you then!",
                read_at: null,
                created_at: "2026-09-02T10:06:00Z",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const messages = await messagesService.getMessages("u_worker_100", "conv_100");

      expect(messages).toHaveLength(2);
      expect(messages[0].isMine).toBe(true);
      expect(messages[1].isMine).toBe(false);
      expect(messages[1].senderName).toBe("Cafe Owner");
    });
  });
});
