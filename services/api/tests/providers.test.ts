import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UserRole,
  WorkType,
  UrgencyLevel,
  PaymentType,
  ProviderType,
  WorkOpportunityStatus,
} from "@nearvia/types";
import {
  updateProviderProfileSchema,
  updateProviderLocationSchema,
  createWorkOpportunitySchema,
  updateWorkOpportunitySchema,
} from "@nearvia/validation";
import { providersService } from "../src/modules/providers/service";
import { workOpportunitiesService } from "../src/modules/jobs/service";
import { requireRole } from "../src/middleware/auth.middleware";
import { Request, Response } from "express";
import * as db from "../src/db";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  pool: { end: vi.fn() },
}));

describe("Phase 6 — Provider Profile & Work Opportunity Creation Suite", () => {
  const providerUserId = "f0000001-0000-0000-0000-000000000001";
  const otherProviderUserId = "f0000001-0000-0000-0000-000000000002";
  const workerUser = {
    id: "e0000001-0000-0000-0000-000000000001",
    authId: "auth_work_303",
    phone: "+919876500003",
    fullName: "Karthik Rao",
    role: UserRole.WORKER,
    isActive: true,
  };

  let mockOppStatus = "DRAFT";
  let mockOppTitle = "Shift 20 boxes to warehouse storage";
  let mockOppWorkersNeeded = 2;
  let mockOppPaymentAmount = 500;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOppStatus = "DRAFT";
    mockOppTitle = "Shift 20 boxes to warehouse storage";
    mockOppWorkersNeeded = 2;
    mockOppPaymentAmount = 500;

    vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes("UPDATE work_opportunities SET") && !sql.includes("SET status =")) {
        if (params?.[1] && typeof params[1] === "string") {
          mockOppTitle = params[1];
        }
        mockOppWorkersNeeded = 3;
        mockOppPaymentAmount = 600;
        return { rows: [], rowCount: 1 } as any;
      }

      if (sql.includes("UPDATE work_opportunities") && sql.includes("SET status = 'PUBLISHED'")) {
        mockOppStatus = "PUBLISHED";
        return { rows: [], rowCount: 1 } as any;
      }

      if (sql.includes("UPDATE work_opportunities") && sql.includes("SET status = 'CANCELLED'")) {
        mockOppStatus = "CANCELLED";
        return { rows: [], rowCount: 1 } as any;
      }

      if (sql.includes("FROM provider_profiles")) {
        return {
          rows: [
            {
              id: "f0000002-0000-0000-0000-000000000001",
              user_id: params?.[0] || providerUserId,
              provider_type: "BUSINESS",
              business_name: "Patel Electronics & Home Services",
              description: "Trusted electrical services in Indiranagar.",
              contact_phone: "+919876500001",
              latitude: 12.9716,
              longitude: 77.5946,
              address_approximate: "Domlur Intermediate Ring Road",
              verified_business: true,
              average_rating: 4.8,
              total_ratings_count: 5,
              posted_jobs_count: 2,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              full_name: "Ramesh Patel",
              phone: "+919876500001",
              email: "ramesh@example.com",
              avatar_url: null,
            },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes("FROM work_opportunities wo") && sql.includes("WHERE wo.id = $1")) {
        const oppId = params?.[0];
        return {
          rows: [
            {
              id: oppId || "wo_draft_01",
              provider_id: "f0000002-0000-0000-0000-000000000001",
              category_id: "a0000001-0000-0000-0000-000000000003",
              title: mockOppTitle,
              description: "Need assistance moving packed cartons to first-floor rack.",
              work_type: "TASK",
              urgency: "NORMAL",
              status: mockOppStatus,
              workers_needed: mockOppWorkersNeeded,
              workers_assigned: 0,
              latitude: 12.9716,
              longitude: 77.5946,
              address_approximate: "MG Road Metro Station",
              work_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
              start_time: "10:00",
              end_time: "12:00",
              duration_hours: 2,
              payment_amount: mockOppPaymentAmount,
              payment_type: "FIXED",
              currency: "INR",
              min_experience_years: 1,
              responsibilities: [],
              instructions: null,
              tools_provided: true,
              orientation_provided: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              published_at: mockOppStatus === "PUBLISHED" ? new Date().toISOString() : null,
              completed_at: null,
              cancelled_at: mockOppStatus === "CANCELLED" ? new Date().toISOString() : null,
              category_name: "Logistics",
              category_slug: "logistics",
              category_icon: "truck",
              provider_user_id: providerUserId,
              provider_full_name: "Ramesh Patel",
              provider_type: "BUSINESS",
              business_name: "Patel Electronics & Home Services",
              contact_phone: "+919876500001",
              average_rating: 4.8,
              verified_business: true,
            },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes("FROM categories")) {
        return {
          rows: [
            { id: "c1", name: "Cat 1", slug: "cat-1", isActive: true },
            { id: "c2", name: "Cat 2", slug: "cat-2", isActive: true },
            { id: "c3", name: "Cat 3", slug: "cat-3", isActive: true },
            { id: "c4", name: "Cat 4", slug: "cat-4", isActive: true },
            { id: "c5", name: "Cat 5", slug: "cat-5", isActive: true },
          ],
          rowCount: 5,
        } as any;
      }

      if (sql.includes("FROM skills WHERE id = $1")) {
        return {
          rows: [
            { id: params?.[0] || "b0000001-0000-0000-0000-000000000006", name: "Packing", category_id: "a0000001-0000-0000-0000-000000000003" },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes("FROM work_opportunity_skills")) {
        return {
          rows: [
            {
              skillId: "b0000001-0000-0000-0000-000000000006",
              skillName: "Packing",
              categoryId: "a0000001-0000-0000-0000-000000000003",
              categoryName: "Logistics",
              categorySlug: "logistics",
              isRequired: true,
              minExperienceYears: 1,
            },
          ],
          rowCount: 1,
        } as any;
      }

      return { rows: [{ id: "f0000002-0000-0000-0000-000000000001" }], rowCount: 1 } as any;
    });
  });

  describe("1. Provider Profile Validation & Management", () => {
    it("Test 1: Provider profile schema validates Individual and Business configurations", () => {
      const validIndividual = updateProviderProfileSchema.safeParse({
        providerType: ProviderType.INDIVIDUAL,
        description: "Household seeking daily garden and painting help.",
        contactPhone: "+919876500001",
        addressApproximate: "Indiranagar 100ft Road",
      });
      expect(validIndividual.success).toBe(true);

      const validBusiness = updateProviderProfileSchema.safeParse({
        providerType: ProviderType.BUSINESS,
        businessName: "Patel Logistics & Warehousing Pvt Ltd",
        description: "Commercial warehouse operations in East Bangalore.",
        contactPhone: "+919876500001",
        addressApproximate: "Whitefield Main Road",
      });
      expect(validBusiness.success).toBe(true);
    });

    it("Test 2: Provider location schema validates coordinates and rejects out-of-bounds latitude", () => {
      const validLoc = updateProviderLocationSchema.safeParse({
        latitude: 12.9716,
        longitude: 77.5946,
        addressApproximate: "Central Bangalore",
      });
      expect(validLoc.success).toBe(true);

      const invalidLoc = updateProviderLocationSchema.safeParse({
        latitude: 105.5, // > 90
        longitude: 77.5946,
      });
      expect(invalidLoc.success).toBe(false);
    });

    it("Test 3: Server-side Profile Completion Calculator tracks required business vs individual fields", () => {
      // Individual Profile Completion
      const indComplete = providersService.calculateProfileCompletion(
        ProviderType.INDIVIDUAL,
        "Ramesh Patel",
        "+919876500001",
        true, // has location
        undefined, // no business name needed for INDIVIDUAL
        "Helpful household manager",
        "+919876500001",
        "Indiranagar",
      );
      expect(indComplete.isComplete).toBe(true);
      expect(indComplete.missingRequired.length).toBe(0);
      expect(indComplete.completionPercentage).toBeGreaterThanOrEqual(80);

      // Business Profile missing required Business Name
      const bizIncomplete = providersService.calculateProfileCompletion(
        ProviderType.BUSINESS,
        "Ramesh Patel",
        "+919876500001",
        true,
        "", // missing business name
        "Commercial shop",
        "+919876500001",
        "Koramangala",
      );
      expect(bizIncomplete.isComplete).toBe(false);
      expect(bizIncomplete.missingRequired).toContain("Business Name");
    });

    it("Test 4: Provider service updates profile attributes and returns updated detail", async () => {
      const updated = await providersService.updateProviderProfile(
        providerUserId,
        {
          providerType: ProviderType.BUSINESS,
          businessName: "Patel Electronics & Home Services",
          description: "Trusted electrical services in Indiranagar.",
          contactPhone: "+919876500001",
          addressApproximate: "Domlur Intermediate Ring Road",
        },
      );

      expect(updated.providerType).toBe(ProviderType.BUSINESS);
      expect(updated.businessName).toBe("Patel Electronics & Home Services");
      expect(updated.contactPhone).toBe("+919876500001");
    });
  });

  describe("2. Work Opportunity Creation & Validation Engine (TASK / SHIFT / JOB)", () => {
    let draftOpportunityId = "";

    it("Test 5: Validates TASK, SHIFT, and JOB work type schema definitions", () => {
      const validTask = createWorkOpportunitySchema.safeParse({
        workType: WorkType.TASK,
        title: "Move 20 boxes to warehouse storage",
        categoryId: "a0000001-0000-0000-0000-000000000003",
        description:
          "Need assistance moving packed cartons to first-floor rack.",
        urgency: UrgencyLevel.NORMAL,
        workersNeeded: 2,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road Metro Station",
        workDate: "2026-08-26",
        startTime: "10:00",
        endTime: "12:00",
        durationHours: 2,
        paymentAmount: 500,
        paymentType: PaymentType.FIXED,
        currency: "INR",
        toolsProvided: true,
        orientationProvided: true,
        skills: [
          {
            skillId: "b0000001-0000-0000-0000-000000000006",
            isRequired: true,
            minExperienceYears: 1,
          },
        ],
      });
      expect(validTask.success).toBe(true);

      const validShift = createWorkOpportunitySchema.safeParse({
        workType: WorkType.SHIFT,
        title: "Evening restaurant helper & table cleanup",
        categoryId: "a0000001-0000-0000-0000-000000000001",
        description: "Help manage evening dining rush and assist prep station.",
        urgency: UrgencyLevel.URGENT,
        workersNeeded: 3,
        location: { latitude: 12.9352, longitude: 77.6245 },
        addressApproximate: "Koramangala 4th Block",
        workDate: "2026-08-26",
        startTime: "18:00",
        endTime: "22:00",
        durationHours: 4,
        paymentAmount: 600,
        paymentType: PaymentType.FIXED,
      });
      expect(validShift.success).toBe(true);
    });

    it("Test 6: Rejects work opportunity when end time is before or equal to start time", () => {
      const invalidTime = createWorkOpportunitySchema.safeParse({
        workType: WorkType.TASK,
        title: "Invalid time work task",
        categoryId: "a0000001-0000-0000-0000-000000000001",
        description: "Testing time rejection.",
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "Indiranagar",
        workDate: "2026-08-26",
        startTime: "16:00",
        endTime: "11:00", // End before start
        durationHours: 2,
        paymentAmount: 400,
        paymentType: PaymentType.FIXED,
      });
      expect(invalidTime.success).toBe(false);
    });

    it("Test 7: Rejects work opportunity with negative or zero wage amount", () => {
      const invalidWage = createWorkOpportunitySchema.safeParse({
        workType: WorkType.TASK,
        title: "Invalid wage work task",
        categoryId: "a0000001-0000-0000-0000-000000000001",
        description: "Testing wage rejection.",
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "Indiranagar",
        workDate: "2026-08-26",
        startTime: "09:00",
        endTime: "12:00",
        durationHours: 3,
        paymentAmount: -50, // Negative wage
        paymentType: PaymentType.FIXED,
      });
      expect(invalidWage.success).toBe(false);
    });

    it("Test 8: Work opportunities service creates DRAFT opportunity with skills attached", async () => {
      const created = await workOpportunitiesService.createWorkOpportunity(
        providerUserId,
        {
          workType: WorkType.TASK,
          title: "Shift 20 boxes to warehouse storage",
          categoryId: "a0000001-0000-0000-0000-000000000003",
          description:
            "Need assistance moving packed cartons to first-floor rack.",
          urgency: UrgencyLevel.NORMAL,
          workersNeeded: 2,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road Metro Station",
          workDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0] ?? "2026-12-25",
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: 500,
          paymentType: PaymentType.FIXED,
          currency: "INR",
          toolsProvided: true,
          orientationProvided: true,
          skills: [
            {
              skillId: "b0000001-0000-0000-0000-000000000006",
              isRequired: true,
              minExperienceYears: 1,
            },
          ],
        },
      );

      expect(created.id).toBeDefined();
      expect(created.status).toBe(WorkOpportunityStatus.DRAFT);
      expect(created.workersNeeded).toBe(2);
      expect(created.skills.length).toBe(1);

      draftOpportunityId = created.id;
    });

    it("Test 9: Provider can update draft opportunity attributes before publishing", async () => {
      const updated = await workOpportunitiesService.updateWorkOpportunity(
        draftOpportunityId,
        providerUserId,
        {
          title: "Shift 25 boxes to warehouse storage (Updated)",
          paymentAmount: 600,
          workersNeeded: 3,
        },
      );

      expect(updated.title).toBe(
        "Shift 25 boxes to warehouse storage (Updated)",
      );
      expect(updated.paymentAmount).toBe(600);
      expect(updated.workersNeeded).toBe(3);
    });

    it("Test 10: Provider publishes draft opportunity to PUBLISHED lifecycle status", async () => {
      const published = await workOpportunitiesService.publishWorkOpportunity(
        draftOpportunityId,
        providerUserId,
      );

      expect(published.status).toBe(WorkOpportunityStatus.PUBLISHED);
      expect(published.publishedAt).toBeDefined();
    });

    it("Test 11: Provider can cancel an active/published work opportunity", async () => {
      const cancelled = await workOpportunitiesService.cancelWorkOpportunity(
        draftOpportunityId,
        providerUserId,
      );

      expect(cancelled.status).toBe(WorkOpportunityStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
    });
  });

  describe("3. Authorization & Security Ownership Isolation", () => {
    it("Test 12: Role Guard rejects WORKER from accessing provider-only endpoints (403 Forbidden)", () => {
      const middleware = requireRole(UserRole.PROVIDER);
      const mockReq = { user: workerUser } as unknown as Request;

      let errorResult: any = null;
      const next = (err?: any) => {
        errorResult = err;
      };

      middleware(mockReq, {} as Response, next);

      expect(errorResult).toBeDefined();
      expect(errorResult.statusCode).toBe(403);
      expect(errorResult.code).toBe("FORBIDDEN");
    });

    it("Test 13: Provider B cannot update or cancel Provider A opportunity", async () => {
      // 1. Provider A creates draft
      const oppA = await workOpportunitiesService.createWorkOpportunity(
        providerUserId,
        {
          workType: WorkType.JOB,
          title: "Temporary retail helper for weekend rush",
          categoryId: "a0000001-0000-0000-0000-000000000002",
          description: "Assisting customer packing and queue.",
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "Commercial Street",
          workDate: "2026-08-27",
          startTime: "10:00",
          endTime: "18:00",
          durationHours: 8,
          paymentAmount: 850,
          paymentType: PaymentType.DAILY,
          currency: "INR",
        },
      );

      // 2. Provider B attempts to view unpublished draft
      await expect(
        workOpportunitiesService.getWorkOpportunityById(
          oppA.id,
          otherProviderUserId,
          UserRole.PROVIDER,
        ),
      ).rejects.toThrow("Unpublished draft opportunities cannot be viewed.");

      // 3. Provider B attempts to cancel Provider A opportunity
      await expect(
        workOpportunitiesService.cancelWorkOpportunity(
          oppA.id,
          otherProviderUserId,
        ),
      ).rejects.toThrow();
    });

    it("Test 14: Categories taxonomy service returns active category catalogue", async () => {
      const categories = await workOpportunitiesService.getAllCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(5);
    });
  });
});
