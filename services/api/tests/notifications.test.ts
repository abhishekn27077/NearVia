import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationsService } from "../src/modules/notifications/service";
import * as db from "../src/db";

describe("Notifications Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve user notifications and unread count", async () => {
    const mockList = [
      {
        id: "n-1",
        recipient_id: "u-1",
        type: "APPLICATION_RECEIVED",
        title: "New Applicant",
        message: "Suresh applied for your work.",
        data: { workId: "w-1" },
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(db, "query")
      .mockResolvedValueOnce({ rows: mockList, rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ unread_count: "1" }], rowCount: 1 } as any);

    const result = await notificationsService.getMyNotifications("u-1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("New Applicant");
    expect(result.unreadCount).toBe(1);
  });

  it("should mark a single notification as read", async () => {
    vi.spyOn(db, "query")
      .mockResolvedValueOnce({ rows: [{ id: "n-1", recipient_id: "u-1" }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);

    const updated = await notificationsService.markAsRead("u-1", "n-1");
    expect(updated).toBe(true);
  });

  it("should mark all notifications as read", async () => {
    vi.spyOn(db, "query").mockResolvedValueOnce({ rowCount: 3, rows: [] } as any);

    const markedCount = await notificationsService.markAllAsRead("u-1");
    expect(markedCount).toBe(3);
  });

  it("should create a new notification record", async () => {
    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [{ id: "n-new-id" }],
      rowCount: 1,
    } as any);

    const id = await notificationsService.createNotification(
      "u-2",
      "WORKER_HIRED",
      "Congratulations!",
      "You were hired for the shift.",
      { assignmentId: "a-1" },
    );
    expect(id).toBe("n-new-id");
  });
});
