import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoveryService } from "../src/modules/jobs/discovery.service";
import {
  WorkType,
  UrgencyLevel,
  WorkOpportunityStatus,
  PaymentType,
} from "@nearvia/types";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  pool: { end: vi.fn() },
}));

describe("Phase 7 — Hyperlocal Discovery & 5 KM Spatial Search Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. PostGIS Spatial Radius & Distance Calculations", () => {
    it("Test 1: Returns published work opportunity located within 5 km radius", async () => {
      // Mock worker location query (Indiranagar: 12.9784, 77.6408)
      vi.mocked(db.query).mockImplementation(
        async (sql: string, params?: any[]) => {
          if (sql.includes("FROM worker_profiles")) {
            return { rows: [{ latitude: 12.9784, longitude: 77.6408 }] } as any;
          }
          if (sql.includes("SELECT COUNT(*) AS total")) {
            return { rows: [{ total: "1" }] } as any;
          }
          if (sql.includes("FROM work_opportunities wo")) {
            return {
              rows: [
                {
                  id: "wo_nearby_01",
                  provider_id: "p_01",
                  category_id: "cat_01",
                  title: "Retail inventory helper",
                  description: "Organize shelves and label items",
                  work_type: WorkType.TASK,
                  urgency: UrgencyLevel.NORMAL,
                  status: WorkOpportunityStatus.PUBLISHED,
                  workers_needed: 2,
                  workers_assigned: 0,
                  latitude: 12.9716,
                  longitude: 77.5946,
                  address_approximate: "MG Road Metro Station",
                  work_date: "2026-08-26",
                  start_time: "10:00",
                  end_time: "12:00",
                  duration_hours: 2,
                  payment_amount: 500,
                  payment_type: PaymentType.FIXED,
                  currency: "INR",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  category_name: "Retail & Grocery",
                  provider_full_name: "Ramesh Store",
                  distance_meters: 1850, // 1.85 km
                },
              ],
            } as any;
          }
          if (sql.includes("FROM work_opportunity_skills")) {
            return { rows: [] } as any;
          }
          return { rows: [] } as any;
        },
      );

      const result = await discoveryService.discoverNearbyWork(
        "usr_worker_01",
        {
          radiusKm: 5,
        },
      );

      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].id).toBe("wo_nearby_01");
      expect(result.opportunities[0].distanceKm).toBe(1.9); // 1850m rounded to 1.9 km
      expect(result.total).toBe(1);
      expect(result.radiusKm).toBe(5);
    });

    it("Test 2: Excludes work opportunities beyond specified radius", async () => {
      // Mock SQL returning 0 rows when PostGIS ST_DWithin excludes faraway jobs (e.g. 25 km away)
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT COUNT(*) AS total")) {
          return { rows: [{ total: "0" }] } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const result = await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 5,
      });

      expect(result.opportunities).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("2. Work Visibility & Status Guards", () => {
    it("Test 3: PostGIS query strictly excludes DRAFT and CANCELLED work opportunities", async () => {
      let executedSql = "";
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        executedSql = sql;
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: "0" }] } as any;
        }
        return { rows: [] } as any;
      });

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 5,
      });

      expect(executedSql).toContain("wo.status = 'PUBLISHED'");
      expect(executedSql).toContain("wo.work_date >= CURRENT_DATE");
    });
  });

  describe("3. Multi-Filter & Search Engine", () => {
    it("Test 4: Date filter applies TODAY and STARTING_SOON conditions", async () => {
      let executedSql = "";
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        executedSql = sql;
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: "0" }] } as any;
        }
        return { rows: [] } as any;
      });

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        dateFilter: "TODAY",
      });

      expect(executedSql).toContain("wo.work_date = CURRENT_DATE");

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        dateFilter: "STARTING_SOON",
      });

      expect(executedSql).toContain("wo.start_time >= CURRENT_TIME");
    });

    it("Test 5: Work Type filter isolates TASK vs SHIFT vs JOB", async () => {
      let capturedParams: any[] = [];
      vi.mocked(db.query).mockImplementation(
        async (sql: string, params?: any[]) => {
          if (sql.includes("FROM work_opportunities wo")) {
            capturedParams = params || [];
          }
          if (sql.includes("COUNT(*)")) {
            return { rows: [{ total: "0" }] } as any;
          }
          return { rows: [] } as any;
        },
      );

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        workType: WorkType.SHIFT,
      });

      expect(capturedParams).toContain("SHIFT");
    });

    it("Test 6: Category filter applies category UUID condition", async () => {
      let capturedParams: any[] = [];
      vi.mocked(db.query).mockImplementation(
        async (sql: string, params?: any[]) => {
          if (sql.includes("FROM work_opportunities wo")) {
            capturedParams = params || [];
          }
          if (sql.includes("COUNT(*)")) {
            return { rows: [{ total: "0" }] } as any;
          }
          return { rows: [] } as any;
        },
      );

      const categoryUuid = "c1111111-1111-1111-1111-111111111111";
      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        categoryId: categoryUuid,
      });

      expect(capturedParams).toContain(categoryUuid);
    });

    it("Test 7: Full text search queries title, description, category, and skills", async () => {
      let executedSql = "";
      let capturedParams: any[] = [];
      vi.mocked(db.query).mockImplementation(
        async (sql: string, params?: any[]) => {
          executedSql = sql;
          capturedParams = params || [];
          if (sql.includes("COUNT(*)")) {
            return { rows: [{ total: "0" }] } as any;
          }
          return { rows: [] } as any;
        },
      );

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        search: "warehouse loading",
      });

      expect(executedSql).toContain("wo.title ILIKE");
      expect(executedSql).toContain("wo.description ILIKE");
      expect(executedSql).toContain("work_opportunity_skills");
      expect(capturedParams).toContain("%warehouse loading%");
    });
  });

  describe("4. Sorting & Ordering Capabilities", () => {
    it("Test 8: Default sorting orders by NEAREST distance ascending", async () => {
      let executedSql = "";
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("ORDER BY")) {
          executedSql = sql;
        }
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: "0" }] } as any;
        }
        return { rows: [] } as any;
      });

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        sort: "NEAREST",
      });

      expect(executedSql).toContain("ORDER BY distance_meters ASC");
    });

    it("Test 9: Sorting by HIGHEST_PAY orders by payment_amount descending", async () => {
      let executedSql = "";
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("ORDER BY")) {
          executedSql = sql;
        }
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: "0" }] } as any;
        }
        return { rows: [] } as any;
      });

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        sort: "HIGHEST_PAY",
      });

      expect(executedSql).toContain(
        "ORDER BY wo.payment_amount DESC, distance_meters ASC",
      );
    });

    it("Test 10: Sorting by STARTING_SOON orders by work_date and start_time ascending", async () => {
      let executedSql = "";
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("ORDER BY")) {
          executedSql = sql;
        }
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: "0" }] } as any;
        }
        return { rows: [] } as any;
      });

      await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        sort: "STARTING_SOON",
      });

      expect(executedSql).toContain(
        "ORDER BY wo.work_date ASC, wo.start_time ASC, distance_meters ASC",
      );
    });
  });

  describe("5. Edge Cases & Location Resolution", () => {
    it("Test 11: Caps search radius at maximum 15 km", async () => {
      const result = await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 50, // Requesting oversized radius
      });

      expect(result.radiusKm).toBe(15);
    });

    it("Test 12: Throws LOCATION_REQUIRED error when worker has no location configured", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return { rows: [{ latitude: null, longitude: null }] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        discoveryService.discoverNearbyWork("usr_unlocated_worker", {}),
      ).rejects.toThrow("Worker location has not been configured");
    });

    it("Test 13: Pagination calculates totalPages and respects limit constraints", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ total: "45" }] } as any;
        }
        return { rows: [] } as any;
      });

      const result = await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        page: 2,
        limit: 10,
      });

      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });
  });
});
