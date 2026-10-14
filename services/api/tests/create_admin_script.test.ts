import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole } from "@nearvia/types";
import { promptMaskedPassword } from "../src/scripts/create-admin";
import { Readable } from "stream";

// Mock dependencies for unit testing without live network or DB
const mockQuery = vi.fn();
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();
const mockCreateUser = vi.fn();
const mockLogAuditEvent = vi.fn();

vi.mock("../src/db", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

vi.mock("../src/utils/audit", () => ({
  logAuditEvent: (...args: any[]) => mockLogAuditEvent(...args),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        listUsers: (...args: any[]) => mockListUsers(...args),
        updateUserById: (...args: any[]) => mockUpdateUserById(...args),
        createUser: (...args: any[]) => mockCreateUser(...args),
      },
    },
  }),
}));

describe("NearVia Admin Provisioning Script Unit Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://mock.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";
    delete process.env.ADMIN_PASSWORD;
  });

  describe("1. Masked Password Input Utility", () => {
    it("safely reads password from non-TTY input stream without echoing", async () => {
      const originalStdin = process.stdin;
      const mockStream = new Readable({
        read() {
          this.push("SecureAdminPass2026!\n");
          this.push(null);
        },
      });

      // Temporarily mock stdin
      Object.defineProperty(process, "stdin", {
        value: mockStream,
        configurable: true,
      });

      const pass = await promptMaskedPassword("Prompt: ");
      expect(pass).toBe("SecureAdminPass2026!");

      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      });
    });
  });

  describe("2. Schema & SQL Query Compliance", () => {
    it("ensures SQL statements use email_verified and NEVER use nonexistent is_verified", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const scriptContent = fs.readFileSync(
        path.resolve(__dirname, "../src/scripts/create-admin.ts"),
        "utf-8"
      );

      // Must not contain any reference to is_verified
      expect(scriptContent).not.toContain("is_verified");

      // Must contain email_verified
      expect(scriptContent).toContain("email_verified");

      // Must NOT set mobile_verified or identity_verified to TRUE
      expect(scriptContent).not.toContain("mobile_verified = TRUE");
      expect(scriptContent).not.toContain("identity_verified = TRUE");
      expect(scriptContent).not.toMatch(/mobile_verified\s*,\s*identity_verified/);
    });

    it("ensures console output never leaks or prints plaintext password", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const scriptContent = fs.readFileSync(
        path.resolve(__dirname, "../src/scripts/create-admin.ts"),
        "utf-8"
      );

      // Must not contain Temporary Password console output
      expect(scriptContent).not.toContain("Temporary Password:");
      expect(scriptContent).not.toContain("${adminPassword}");
    });
  });

  describe("3. Idempotent Provisioning Flow with Existing Auth Identity", () => {
    it("updates existing Supabase user and syncs PostgreSQL users table without duplicates", async () => {
      const existingUid = "b5af74fb-a208-4bcb-a6ba-1f8c748fbcfd";
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [
            {
              id: existingUid,
              email: "admin@nearvia.app",
              user_metadata: { role: UserRole.WORKER },
            },
          ],
        },
        error: null,
      });

      mockUpdateUserById.mockResolvedValueOnce({ error: null });

      // Simulate database user elevation
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "internal-admin-uuid-1", role: "WORKER" }],
        }) // SELECT existing user
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE users

      mockLogAuditEvent.mockResolvedValueOnce({});

      // Import script execution dynamically with env password
      process.env.ADMIN_PASSWORD = "ValidAdminPassword123!";
      process.argv = ["node", "create-admin.ts", "--email", "admin@nearvia.app", "--name", "Platform Administrator"];

      const { createOrElevateAdmin } = await import("../src/scripts/create-admin");
      await createOrElevateAdmin();

      // Verify Supabase was updated, NOT created
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockUpdateUserById).toHaveBeenCalledWith(
        existingUid,
        expect.objectContaining({
          email_confirm: true,
          password: "ValidAdminPassword123!",
          user_metadata: expect.objectContaining({
            role: UserRole.ADMIN,
            email_verified: true,
          }),
        })
      );

      // Verify SQL UPDATE was executed with email_verified
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users"),
        expect.any(Array)
      );
      const updateCall = mockQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE users"));
      expect(updateCall[0]).toContain("email_verified = TRUE");
      expect(updateCall[0]).not.toContain("is_verified");

      // Verify audit event
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_ROLE_ELEVATED",
          targetId: "internal-admin-uuid-1",
          newValues: expect.objectContaining({
            role: "ADMIN",
            email: "admin@nearvia.app",
          }),
        })
      );
    });
  });
});
