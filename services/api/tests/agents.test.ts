import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentsService } from "../src/modules/agents/service";
import { workersService } from "../src/modules/workers/service";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";

// Mock the db module
vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

// Mock the discovery service
vi.mock("../src/modules/jobs/discovery.service", () => ({
  discoveryService: {
    discoverNearbyWork: vi.fn().mockResolvedValue({
      opportunities: [
        {
          id: "job-123",
          title: "Warehouse Helper",
          paymentAmount: 800,
          paymentType: "DAILY",
          distanceMeters: 1200,
          matchScore: 92,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    }),
  },
}));

// Mock the applications service
vi.mock("../src/modules/applications/service", () => ({
  applicationsService: {
    applyForWork: vi.fn().mockResolvedValue({
      id: "app-999",
      workOpportunityId: "job-123",
      workerId: "wp-456",
      status: "PENDING",
      appliedAt: new Date().toISOString(),
    }),
  },
}));

describe("Phase 13: Agent-Assisted Job Access Module", () => {
  const agentUserId = "agent-user-001";
  const agentProfileId = "agent-profile-001";
  const workerUserId = "worker-user-002";
  const workerProfileId = "worker-profile-002";
  const workerPhone = "+919876543210";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Agent Profile Management", () => {
    it("should fetch agent profile by user ID", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: agentProfileId,
            user_id: agentUserId,
            full_name: "Ramesh Agent",
            phone: "+919999900000",
            assigned_area: "Indiranagar, Bangalore",
            description: "Helping local trade workers find quick work.",
            languages: ["Kannada", "Hindi", "English"],
            address_approximate: "Indiranagar",
            verified_workers_count: 5,
            active_status: true,
            created_at: new Date().toISOString(),
          },
        ],
      } as any);

      const profile = await agentsService.getMyProfile(agentUserId);
      expect(profile.id).toBe(agentProfileId);
      expect(profile.fullName).toBe("Ramesh Agent");
      expect(profile.assignedArea).toBe("Indiranagar, Bangalore");
      expect(profile.languages).toContain("Kannada");
    });

    it("should throw 404 if agent profile not found", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);
      await expect(agentsService.getMyProfile("non-existent")).rejects.toThrow(AppError);
    });
  });

  describe("Agent-Worker Consent Flow", () => {
    it("should allow agent to request access to worker by phone number", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: agentProfileId }] } as any;
        }
        if (sql.includes("FROM users u") && sql.includes("JOIN worker_profiles")) {
          return {
            rowCount: 1,
            rows: [
              {
                worker_id: workerProfileId,
                user_id: workerUserId,
                full_name: "Suresh Worker",
                phone: workerPhone,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM agent_worker_relationships WHERE agent_id")) {
          return { rowCount: 0, rows: [] } as any; // No existing relationship
        }
        if (sql.includes("INSERT INTO agent_worker_relationships")) {
          return { rowCount: 1, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO notifications")) {
          return { rowCount: 1, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO agent_assistance")) {
          return { rowCount: 1, rows: [] } as any;
        }
        // getRelationship helper query
        return {
          rowCount: 1,
          rows: [
            {
              id: "rel-101",
              agent_id: agentProfileId,
              worker_id: workerProfileId,
              status: "PENDING",
              requested_at: new Date().toISOString(),
              accepted_at: null,
              revoked_at: null,
              worker_user_id: workerUserId,
              worker_full_name: "Suresh Worker",
              worker_phone: workerPhone,
            },
          ],
        } as any;
      });

      const rel = await agentsService.requestWorkerAccess(agentUserId, workerPhone);
      expect(rel.status).toBe("PENDING");
      expect(rel.workerFullName).toBe("Suresh Worker");
      expect(rel.agentId).toBe(agentProfileId);
    });

    it("should allow worker to accept a pending agent request", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT id FROM worker_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: workerProfileId }] } as any;
        }
        if (sql.includes("UPDATE agent_worker_relationships") && sql.includes("SET status = 'ACTIVE'")) {
          return { rowCount: 1, rows: [{ agent_id: agentProfileId }] } as any;
        }
        if (sql.includes("SELECT user_id FROM agent_profiles WHERE id")) {
          return { rowCount: 1, rows: [{ user_id: agentUserId }] } as any;
        }
        if (sql.includes("SELECT full_name FROM users WHERE id")) {
          return { rowCount: 1, rows: [{ full_name: "Suresh Worker" }] } as any;
        }
        if (sql.includes("INSERT INTO notifications")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 1, rows: [{ id: workerProfileId }] } as any;
      });

      await expect(workersService.acceptAgentRequest(workerUserId, "rel-101")).resolves.not.toThrow();
    });

    it("should allow worker to revoke an active agent relationship", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT id FROM worker_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: workerProfileId }] } as any;
        }
        if (sql.includes("UPDATE agent_worker_relationships") && sql.includes("SET status = 'REVOKED'")) {
          return { rowCount: 1, rows: [{ agent_id: agentProfileId }] } as any;
        }
        if (sql.includes("SELECT user_id FROM agent_profiles WHERE id")) {
          return { rowCount: 1, rows: [{ user_id: agentUserId }] } as any;
        }
        if (sql.includes("SELECT full_name FROM users WHERE id")) {
          return { rowCount: 1, rows: [{ full_name: "Suresh Worker" }] } as any;
        }
        if (sql.includes("INSERT INTO notifications")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 1, rows: [{ id: workerProfileId }] } as any;
      });

      await expect(workersService.revokeAgent(workerUserId, "rel-101")).resolves.not.toThrow();
    });
  });

  describe("Consent Enforcement & Security", () => {
    it("should reject agent access if worker consent is NOT active", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: agentProfileId }] } as any;
        }
        if (sql.includes("FROM agent_worker_relationships")) {
          return { rowCount: 1, rows: [{ status: "REVOKED" }] } as any; // Revoked consent!
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(agentsService.getWorkerForAgent(agentUserId, workerProfileId)).rejects.toThrow(
        /active consent/
      );
    });

    it("should reject assisted discovery if worker has revoked consent", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: agentProfileId }] } as any;
        }
        if (sql.includes("FROM agent_worker_relationships")) {
          return { rowCount: 0, rows: [] } as any; // No consent at all
        }
        return { rowCount: 0, rows: [] } as any;
      });

      await expect(agentsService.getWorkForWorker(agentUserId, workerProfileId, {})).rejects.toThrow(
        /active consent/
      );
    });
  });

  describe("Assisted Actions: Discovery, Application & Audit", () => {
    it("should allow assisted discovery when consent is ACTIVE and record audit", async () => {
      let auditRecorded = false;
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: agentProfileId }] } as any;
        }
        if (sql.includes("FROM agent_worker_relationships")) {
          return { rowCount: 1, rows: [{ status: "ACTIVE" }] } as any;
        }
        if (sql.includes("SELECT ST_Y(location::geometry)")) {
          return {
            rowCount: 1,
            rows: [{ latitude: 12.9716, longitude: 77.5946, service_radius_km: 5.0 }],
          } as any;
        }
        if (sql.includes("SELECT user_id FROM worker_profiles")) {
          return { rowCount: 1, rows: [{ user_id: workerUserId }] } as any;
        }
        if (sql.includes("INSERT INTO agent_assistance") || sql.includes("INSERT INTO audit_logs")) {
          auditRecorded = true;
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const result: any = await agentsService.getWorkForWorker(agentUserId, workerProfileId, {});
      expect(result.opportunities).toBeDefined();
      expect(result.opportunities.length).toBe(1);
      expect(auditRecorded).toBe(true);
    });

    it("should submit assisted application owned by worker and record audit", async () => {
      let taggedWithAgent = false;
      let auditRecorded = false;

      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM agent_profiles WHERE user_id")) {
          return { rowCount: 1, rows: [{ id: agentProfileId }] } as any;
        }
        if (sql.includes("FROM agent_worker_relationships")) {
          return { rowCount: 1, rows: [{ status: "ACTIVE" }] } as any;
        }
        if (sql.includes("SELECT user_id FROM worker_profiles")) {
          return { rowCount: 1, rows: [{ user_id: workerUserId }] } as any;
        }
        if (sql.includes("UPDATE applications SET assisted_by_agent_id = $1")) {
          taggedWithAgent = true;
          return { rowCount: 1, rows: [] } as any;
        }
        if (sql.includes("SELECT full_name FROM users WHERE id")) {
          return { rowCount: 1, rows: [{ full_name: "Ramesh Agent" }] } as any;
        }
        if (sql.includes("INSERT INTO notifications")) {
          return { rowCount: 1, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO agent_assistance") || sql.includes("INSERT INTO audit_logs")) {
          auditRecorded = true;
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const app: any = await agentsService.submitAssistedApplication(
        agentUserId,
        workerProfileId,
        "job-123",
        850,
        "Worker is skilled and punctual",
        true
      );

      expect(app.id).toBe("app-999");
      expect(app.workerId).toBe("wp-456");
      expect(taggedWithAgent).toBe(true);
      expect(auditRecorded).toBe(true);
    });
  });
});
