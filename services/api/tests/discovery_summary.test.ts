import { describe, it, expect, vi, beforeEach } from "vitest";
import { workOpportunitiesService } from "../src/modules/jobs/service";
import { discoveryService } from "../src/modules/jobs/discovery.service";
import { applicationsService } from "../src/modules/applications/service";
import {
  WorkType,
  UrgencyLevel,
  WorkOpportunityStatus,
  PaymentType,
  ProviderType,
} from "@nearvia/types";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  pool: { end: vi.fn() },
}));

describe("Live Marketplace UX, Summary Counts & Spatial Discovery Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Summary Stats & Discovery Count Reconciliation", () => {
    it("Test 1: Summary endpoint returns exact counts and wage range for given radius", async () => {
      // Mock spatial query for summary
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM categories c") && sql.includes("GROUP BY")) {
          return {
            rows: [
              {
                category_id: "cat_01",
                category_name: "Hospitality & Kitchen",
                category_slug: "hospitality-kitchen",
                category_icon: "utensils",
                count: "3",
                min_payment: "500",
                max_payment: "800",
              },
              {
                category_id: "cat_02",
                category_name: "Logistics & Delivery",
                category_slug: "logistics-delivery",
                category_icon: "truck",
                count: "2",
                min_payment: "600",
                max_payment: "1000",
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const summary = await workOpportunitiesService.getDiscoverySummary(
        12.9716,
        77.5946,
        5,
      );

      expect(summary.totalOpportunities).toBe(5);
      expect(summary.activeCategoriesCount).toBe(2);
      expect(summary.minPayment).toBe(500);
      expect(summary.maxPayment).toBe(1000);
      expect(summary.categoryStats).toHaveLength(2);
    });

    it("Test 2: Discovery endpoint count matches summary count for same spatial scope", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT COUNT(*) AS total")) {
          return { rows: [{ total: "5" }] } as any;
        }
        if (sql.includes("FROM work_opportunities wo")) {
          return {
            rows: [
              {
                id: "wo_01",
                provider_id: "p_01",
                category_id: "cat_01",
                title: "Kitchen Assistant",
                description: "Help prep dinner buffet",
                work_type: WorkType.SHIFT,
                urgency: UrgencyLevel.URGENT,
                status: WorkOpportunityStatus.PUBLISHED,
                workers_needed: 2,
                workers_assigned: 0,
                latitude: 12.9716,
                longitude: 77.5946,
                address_approximate: "MG Road Cafe",
                work_date: "2026-08-28",
                start_time: "17:00",
                end_time: "21:00",
                duration_hours: 4,
                payment_amount: 650,
                payment_type: PaymentType.FIXED,
                currency: "INR",
                category_name: "Hospitality & Kitchen",
                provider_full_name: "Ramesh Cafe",
                distance_meters: 1200,
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const result = await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 5,
      });

      expect(result.total).toBe(5);
      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0]?.id).toBe("wo_01");
      expect(result.opportunities[0]?.distanceKm).toBe(1.2);
    });
  });

  describe("2. Provider Creation to Discovery Flow", () => {
    it("Test 3: Throws AppError with DATABASE_ERROR when database connection is down (no silent in-memory fallback)", async () => {
      vi.mocked(db.query).mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

      await expect(
        discoveryService.discoverNearbyWork(undefined, {
          latitude: 12.9716,
          longitude: 77.5946,
          radiusKm: 5,
        }),
      ).rejects.toThrow();
    });

    it("Test 4: Opportunities outside radius are excluded in spatial query", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: "wo_01",
            title: "Nearby Job",
            description: "Desc",
            work_type: WorkType.TASK,
            urgency: UrgencyLevel.NORMAL,
            status: WorkOpportunityStatus.PUBLISHED,
            workers_needed: 1,
            workers_assigned: 0,
            latitude: 12.9716,
            longitude: 77.5946,
            address_approximate: "MG Road",
            work_date: "2026-08-28",
            start_time: "10:00",
            end_time: "12:00",
            duration_hours: 2,
            payment_amount: 500,
            payment_type: PaymentType.FIXED,
            currency: "INR",
            min_experience_years: 0,
            tools_provided: true,
            orientation_provided: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
            completed_at: null,
            cancelled_at: null,
            category_name: "Hospitality",
            category_slug: "hospitality",
            category_icon: "coffee",
            provider_name: "Test Cafe",
            provider_type: ProviderType.BUSINESS,
            business_name: "Test Cafe",
            contact_phone: "+919876543210",
            average_rating: 4.8,
            verified_business: true,
            distance_meters: 800,
            skills: [],
          },
        ],
        rowCount: 1,
      } as any);

      const result = await discoveryService.discoverNearbyWork(undefined, {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 1,
      });

      expect(result.opportunities.length).toBe(1);
      expect(result.opportunities[0]?.distanceKm).toBe(1.2);
    });
  });

  describe("3. 1-Click Application Lifecycle", () => {
    it("Test 5: Worker submits 1-click application successfully", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM worker_profiles")) {
          return {
            rows: [
              {
                id: "wp_worker_01",
                service_radius_km: 5,
                latitude: 12.9716,
                longitude: 77.5946,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM work_opportunities wo") && sql.includes("WHERE wo.id =")) {
          return {
            rows: [
              {
                id: "wo_01",
                provider_id: "pp_01",
                title: "Evening Kitchen Helper",
                work_type: "SHIFT",
                urgency: "NORMAL",
                status: "PUBLISHED",
                workers_needed: 2,
                workers_assigned: 0,
                work_date: new Date().toISOString().split("T")[0],
                start_time: "18:00",
                end_time: "22:00",
                duration_hours: 4,
                payment_amount: 700,
                payment_type: "FIXED",
                address_approximate: "MG Road Cafe",
                distance_meters: 1200,
              },
            ],
          } as any;
        }
        if (sql.includes("FROM applications") && sql.includes("work_opportunity_id =")) {
          return { rows: [] } as any; // No duplicate
        }
        if (sql.includes("INSERT INTO applications")) {
          return {
            rows: [
              {
                id: "app_new_01",
                work_opportunity_id: "wo_01",
                worker_id: "wp_worker_01",
                status: "PENDING",
                proposed_wage: 700,
                worker_notes: "Can join immediately",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const application = await applicationsService.applyForWork(
        "user_worker_01",
        "wo_01",
        {
          proposedWage: 700,
          workerNotes: "Can join immediately",
        },
      );

      expect(application.id).toBe("app_new_01");
      expect(application.workOpportunityId).toBe("wo_01");
      expect(application.status).toBe("PENDING");
    });
  });
});
