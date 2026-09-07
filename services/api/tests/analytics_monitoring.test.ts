import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyticsService } from "../src/modules/admin/analytics.service";
import { trackPlatformEvent } from "../src/utils/events";
import { redactSensitiveData } from "../src/middleware/requestLogger";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Phase 17: Analytics, Monitoring & Platform Health Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Structured Logging & Sensitive Data Redaction", () => {
    it("should redact sensitive fields including passwords, auth tokens, and secret keys", () => {
      const input = {
        userId: "user-123",
        email: "user@example.com",
        password: "SuperSecretPassword123!",
        authorization: "Bearer mock_jwt_token",
        authToken: "mock_auth_token_123",
        secretKey: "mock_secret_key_999",
        nested: {
          apiKey: "mock_api_key_555",
          safeField: "safe value",
        },
      };

      const sanitized = redactSensitiveData(input);

      expect(sanitized.userId).toBe("user-123");
      expect(sanitized.email).toBe("user@example.com");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.authToken).toBe("[REDACTED]");
      expect(sanitized.secretKey).toBe("[REDACTED]");
      expect(sanitized.nested.apiKey).toBe("[REDACTED]");
      expect(sanitized.nested.safeField).toBe("safe value");
    });
  });

  describe("2. Platform & Business Overview Analytics", () => {
    it("should compute accurate user distributions, work tallies, funnels, and financial summaries", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("total_users")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_users: "200",
                total_workers: "140",
                total_providers: "50",
                total_agents: "10",
                active_count: "190",
                suspended_count: "10",
              },
            ],
          } as any;
        }
        if (sql.includes("total_posted")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_posted: "80",
                published_active: "30",
                completed_work: "45",
                cancelled_work: "5",
                draft_work: "0",
                avg_wage: "1500",
              },
            ],
          } as any;
        }
        if (sql.includes("published_jobs")) {
          return {
            rowCount: 1,
            rows: [
              {
                published_jobs: "75",
                total_applications: "150",
                total_assignments: "60",
                completed_shifts: "54",
              },
            ],
          } as any;
        }
        if (sql.includes("settled_paise")) {
          return {
            rowCount: 1,
            rows: [
              {
                settled_paise: "8100000",
                settled_count: "54",
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const overview = await analyticsService.getOverviewAnalytics();

      expect(overview.users.total).toBe(200);
      expect(overview.users.workers).toBe(140);
      expect(overview.users.providers).toBe(50);
      expect(overview.users.activeCount).toBe(190);
      expect(overview.users.suspendedCount).toBe(10);

      expect(overview.work.totalPosted).toBe(80);
      expect(overview.work.publishedActive).toBe(30);

      expect(overview.funnel.publishedJobs).toBe(75);
      expect(overview.funnel.totalApplications).toBe(150);
      expect(overview.funnel.totalAssignments).toBe(60);
      expect(overview.funnel.completedShifts).toBe(54);
      // 60 / 150 = 40%
      expect(overview.funnel.applicationToAssignmentRate).toBe(40);
      // 54 / 60 = 90%
      expect(overview.funnel.workCompletionRate).toBe(90);

      expect(overview.financials.totalSettledVolumePaise).toBe(8100000);
      expect(overview.financials.totalSettledVolume).toBe(81000);
      expect(overview.financials.totalSettledCount).toBe(54);
      expect(overview.financials.averageJobWage).toBe(1500);
    });
  });

  describe("3. Marketplace Health Ratios", () => {
    it("should compute accurate fill rates, completion rates, no-show rates, and dispute rates", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("total_jobs")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_jobs: "50",
                filled_jobs: "40",
                unfilled_jobs: "8",
                cancelled_jobs: "2",
                total_apps: "120",
              },
            ],
          } as any;
        }
        if (sql.includes("total_assignments")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_assignments: "40",
                completed_assignments: "36",
                cancelled_assignments: "4",
              },
            ],
          } as any;
        }
        if (sql.includes("total_disputes")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_disputes: "2",
                active_disputes: "1",
                resolved_disputes: "1",
              },
            ],
          } as any;
        }
        if (sql.includes("total_reports")) {
          return {
            rowCount: 1,
            rows: [
              {
                total_reports: "5",
                active_reports: "1",
                resolved_reports: "4",
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const health = await analyticsService.getMarketplaceHealth();

      // 40 / 50 = 80%
      expect(health.fillRatePercentage).toBe(80);
      // 36 / 40 = 90%
      expect(health.completionRatePercentage).toBe(90);
      // 4 / 40 = 10%
      expect(health.noShowRatePercentage).toBe(10);
      // 2 / 40 = 5%
      expect(health.disputeRatePercentage).toBe(5);
      // 4 / 5 = 80%
      expect(health.reportResolutionRatePercentage).toBe(80);
      // 120 / 50 = 2.4 apps/job
      expect(health.averageApplicationsPerJob).toBe(2.4);
      expect(health.activeDisputesCount).toBe(1);
      expect(health.activeReportsCount).toBe(1);
    });
  });

  describe("4. Meaningful Product Events Tracking", () => {
    it("should record product events with minimal safe metadata", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "event-1" }],
      } as any);

      await trackPlatformEvent({
        eventType: "WORK_PUBLISHED",
        userId: "provider-123",
        resourceType: "WORK_OPPORTUNITY",
        resourceId: "work-456",
        metadata: { category: "Logistics", wage: 1200 },
        ipAddress: "127.0.0.1",
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO platform_events"),
        [
          "WORK_PUBLISHED",
          "provider-123",
          "WORK_OPPORTUNITY",
          "work-456",
          JSON.stringify({ category: "Logistics", wage: 1200 }),
          "127.0.0.1",
        ]
      );
    });

    it("should retrieve paginated product events", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("COUNT(*) FROM platform_events")) {
          return { rowCount: 1, rows: [{ count: "1" }] } as any;
        }
        if (sql.includes("FROM platform_events pe")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: "ev-1",
                event_type: "APPLICATION_SUBMITTED",
                user_id: "user-1",
                resource_type: "APPLICATION",
                resource_id: "app-1",
                metadata: { category: "Retail" },
                ip_address: "127.0.0.1",
                created_at: new Date().toISOString(),
                user_name: "Amit Kumar",
                user_role: "WORKER",
              },
            ],
          } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const result = await analyticsService.getPlatformEvents(1, 10, "APPLICATION_SUBMITTED");

      expect(result.total).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe("APPLICATION_SUBMITTED");
      expect(result.events[0].userName).toBe("Amit Kumar");
    });

    it("should handle empty database records safely without division-by-zero errors", async () => {
      vi.mocked(db.query).mockResolvedValue({
        rowCount: 0,
        rows: [],
      } as any);

      const overview = await analyticsService.getOverviewAnalytics();
      expect(overview.users.total).toBe(0);
      expect(overview.funnel.applicationToAssignmentRate).toBe(0);
      expect(overview.funnel.workCompletionRate).toBe(0);

      const health = await analyticsService.getMarketplaceHealth();
      expect(health.fillRatePercentage).toBe(0);
      expect(health.completionRatePercentage).toBe(0);
      expect(health.disputeRatePercentage).toBe(0);
      expect(health.averageApplicationsPerJob).toBe(0);
    });
  });
});
