import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminService } from "../src/modules/admin/service";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Phase 16: Admin Dashboard & Platform Operations Suite", () => {
  const adminUserId = "admin-user-999";
  const workerUserId = "worker-user-111";
  const providerUserId = "provider-user-222";
  const verificationId = "verif-uuid-333";
  const workId = "work-uuid-444";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Dashboard Metrics Aggregation", () => {
    it("should return aggregated executive platform metrics", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("COUNT(*) AS total_users")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_users: "150",
                total_workers: "100",
                total_providers: "40",
                total_agents: "10",
              },
            ],
          } as any;
        }
        if (sql.includes("published_work")) {
          return { rowCount: 1, rows: [{ published_work: "25" }] } as any;
        }
        if (sql.includes("active_assignments")) {
          return {
            rowCount: 1,
            rows: [{ active_assignments: "12", completed_assignments: "85" }],
          } as any;
        }
        if (sql.includes("pending_verifications")) {
          return { rowCount: 1, rows: [{ pending_verifications: "8" }] } as any;
        }
        if (sql.includes("open_reports")) {
          return { rowCount: 1, rows: [{ open_reports: "3" }] } as any;
        }
        if (sql.includes("open_disputes")) {
          return { rowCount: 1, rows: [{ open_disputes: "2" }] } as any;
        }
        if (sql.includes("confirmed_paise")) {
          return {
            rowCount: 1,
            rows: [{ confirmed_paise: "12500000", pending_payments: "4" }],
          } as any;
        }
        if (sql.includes("FROM audit_logs")) {
          return { rowCount: 0, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const metrics = await adminService.getDashboardMetrics();

      expect(metrics.totalUsers).toBe(150);
      expect(metrics.totalWorkers).toBe(100);
      expect(metrics.totalProviders).toBe(40);
      expect(metrics.publishedWorkCount).toBe(25);
      expect(metrics.activeAssignmentsCount).toBe(12);
      expect(metrics.completedAssignmentsCount).toBe(85);
      expect(metrics.pendingVerificationsCount).toBe(8);
      expect(metrics.openReportsCount).toBe(3);
      expect(metrics.openDisputesCount).toBe(2);
      expect(metrics.confirmedPaymentsVolumePaise).toBe(12500000);
      expect(metrics.confirmedPaymentsVolume).toBe(125000);
    });
  });

  describe("2. User Management Operations", () => {
    it("should allow searching and paginating users", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("COUNT(*) FROM users")) {
          return { rowCount: 1, rows: [{ count: "1" }] } as any;
        }
        if (sql.includes("SELECT id, phone, full_name")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                phone: "+919876543210",
                full_name: "Rahul Sharma",
                email: "rahul@example.com",
                role: "WORKER",
                is_active: true,
                avatar_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const result = await adminService.getUsers(1, 20, "Rahul", "WORKER", "ACTIVE");

      expect(result.total).toBe(1);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].fullName).toBe("Rahul Sharma");
      expect(result.users[0].role).toBe("WORKER");
      expect(result.users[0].isActive).toBe(true);
    });

    it("should allow suspending a user and recording an audit event", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT * FROM users WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                phone: "+919876543210",
                full_name: "Rahul Sharma",
                role: "WORKER",
                is_active: true,
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE users SET is_active = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                phone: "+919876543210",
                full_name: "Rahul Sharma",
                role: "WORKER",
                is_active: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const updated = await adminService.updateUserStatus(adminUserId, workerUserId, {
        status: "SUSPENDED",
        reason: "Violated terms of service by recurring no-shows",
      });

      expect(updated.isActive).toBe(false);
    });

    it("should reject admin self-suspension", async () => {
      await expect(
        adminService.updateUserStatus(adminUserId, adminUserId, {
          status: "SUSPENDED",
          reason: "Accidental self lockout",
        })
      ).rejects.toThrow(/cannot suspend your own/);
    });

    it("should allow changing user role with audit log", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT * FROM users WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                phone: "+919876543210",
                full_name: "Rahul Sharma",
                role: "WORKER",
                is_active: true,
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE users SET role = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workerUserId,
                phone: "+919876543210",
                full_name: "Rahul Sharma",
                role: "ADMIN",
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const updated = await adminService.updateUserRole(adminUserId, workerUserId, {
        role: "ADMIN",
        reason: "Promoted to support mediator",
      });

      expect(updated.role).toBe("ADMIN");
    });
  });

  describe("3. Work Opportunity Moderation", () => {
    it("should allow admin to moderate and cancel non-compliant work opportunities", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT * FROM work_opportunities WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workId,
                title: "Misleading Warehouse Task",
                status: "PUBLISHED",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE work_opportunities")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: workId,
                title: "Misleading Warehouse Task",
                status: "CANCELLED",
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const cancelled = await adminService.moderateCancelWork(adminUserId, workId, {
        reason: "Deceptive job description violating safety standards",
      });

      expect(cancelled.status).toBe("CANCELLED");
    });
  });

  describe("4. Verification Queue Review", () => {
    it("should approve verification and update target provider profile", async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("SELECT * FROM verifications")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: verificationId,
                    target_type: "PROVIDER",
                    target_id: providerUserId,
                    status: "PENDING",
                  },
                ],
              };
            }
            if (sql.includes("UPDATE verifications")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: verificationId,
                    target_type: "PROVIDER",
                    target_id: providerUserId,
                    status: "VERIFIED",
                  },
                ],
              };
            }
            return { rowCount: 1, rows: [] };
          }),
        };
        return cb(client);
      });

      const approved = await adminService.approveVerification(adminUserId, verificationId, {
        notes: "GSTIN document confirmed",
      });

      expect(approved.status).toBe("VERIFIED");
    });

    it("should reject verification with required reason", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT * FROM verifications WHERE id = $1")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: verificationId,
                target_type: "WORKER",
                target_id: workerUserId,
                status: "PENDING",
              },
            ],
          } as any;
        }
        if (sql.includes("UPDATE verifications")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: verificationId,
                target_type: "WORKER",
                target_id: workerUserId,
                status: "REJECTED",
                rejection_reason: "Document was illegible",
              },
            ],
          } as any;
        }
        return { rowCount: 1, rows: [] } as any;
      });

      const rejected = await adminService.rejectVerification(adminUserId, verificationId, {
        rejectionReason: "Document was illegible",
      });

      expect(rejected.status).toBe("REJECTED");
    });
  });

  describe("5. Payment Logs & Audit Trail", () => {
    it("should list payment records without leaking sensitive credentials", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("COUNT(*) FROM payment_records")) {
          return { rowCount: 1, rows: [{ count: "1" }] } as any;
        }
        if (sql.includes("FROM payment_records p")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: "pay-1",
                assignment_id: "asg-1",
                amount: 1200,
                amount_paise: 120000,
                currency: "INR",
                status: "CONFIRMED",
                payment_method: "RAZORPAY_SANDBOX",
                transaction_ref: "pay_xyz123",
                gateway_order_id: "order_abc",
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                opportunity_title: "Event Security",
                work_type: "SHIFT",
                payer_name: "Event Co",
                payee_name: "Suresh K",
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const result = await adminService.getPayments(1, 20);

      expect(result.total).toBe(1);
      expect(result.payments[0].amount).toBe(1200);
      expect(result.payments[0].status).toBe("CONFIRMED");
      expect(result.payments[0].opportunityTitle).toBe("Event Security");
      expect(result.payments[0]).not.toHaveProperty("secret_key");
    });

    it("should return immutable audit logs with actor and payload details", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("COUNT(*) FROM audit_logs")) {
          return { rowCount: 1, rows: [{ count: "1" }] } as any;
        }
        if (sql.includes("FROM audit_logs a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: "log-1",
                actor_id: adminUserId,
                actor_name: "Super Admin",
                action: "USER_STATUS_UPDATED",
                target_entity: "users",
                target_id: workerUserId,
                old_values: { isActive: true },
                new_values: { isActive: false },
                ip_address: "127.0.0.1",
                created_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const result = await adminService.getAuditLogs(1, 30);

      expect(result.total).toBe(1);
      expect(result.auditLogs[0].action).toBe("USER_STATUS_UPDATED");
      expect(result.auditLogs[0].actorName).toBe("Super Admin");
    });
  });

  describe("6. Platform Multi-Entity Search & Idempotency", () => {
    it("should search across users, work opportunities, and payments", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM users")) {
          return { rowCount: 1, rows: [{ id: workerUserId, full_name: "Rahul Sharma", role: "WORKER" }] } as any;
        }
        if (sql.includes("FROM work_opportunities")) {
          return { rowCount: 1, rows: [{ id: workId, title: "Event Security Shift", status: "PUBLISHED" }] } as any;
        }
        if (sql.includes("FROM payment_records")) {
          return { rowCount: 1, rows: [{ id: "pay-1", amount: 1200, transaction_ref: "pay_123" }] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const searchResult = await adminService.searchPlatform("Rahul");
      expect(searchResult.users).toHaveLength(1);
      expect(searchResult.work).toHaveLength(1);
      expect(searchResult.payments).toHaveLength(1);
    });

    it("should return unchanged state when setting already existing status (idempotency)", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: workerUserId,
            phone: "+919876543210",
            full_name: "Rahul Sharma",
            role: "WORKER",
            is_active: true,
          },
        ],
      } as any);

      // Attempting to set ACTIVE on already ACTIVE user
      const res = await adminService.updateUserStatus(adminUserId, workerUserId, {
        status: "ACTIVE",
        reason: "No-op verification",
      });

      expect(res.isActive).toBe(true);
    });
  });
});
