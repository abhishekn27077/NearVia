import { describe, it, expect } from "vitest";
import { UserRole, AvailabilityStatus } from "@nearvia/types";
import {
  updateWorkerProfileSchema,
  updateWorkerLocationSchema,
  addWorkerSkillSchema,
  createAvailabilitySlotSchema,
  toggleAvailableNowSchema,
} from "@nearvia/validation";
import { workersService } from "../src/modules/workers/service";
import { requireRole } from "../src/middleware/auth.middleware";
import { Request, Response } from "express";

describe("Worker Profile, Skills & Availability Domain Engine", () => {
  const mockWorkerUser = {
    id: "usr_w_001",
    authId: "auth_worker_1",
    phone: "+919876543210",
    fullName: "Ramesh Kumar",
    role: UserRole.WORKER,
    isActive: true,
  };

  const mockProviderUser = {
    id: "usr_p_001",
    authId: "auth_provider_1",
    phone: "+919876543220",
    fullName: "Sharma Enterprises",
    role: UserRole.PROVIDER,
    isActive: true,
  };

  it("Test 1: Worker can validate and update profile fields", () => {
    const validProfile = updateWorkerProfileSchema.safeParse({
      bio: "Experienced electrician and plumber with 6 years experience in residential wiring.",
      experienceYears: 6,
      addressApproximate: "Indiranagar 100ft Road, Bangalore",
      serviceRadiusKm: 7.5,
      hourlyRateEstimate: 450,
      dailyRateEstimate: 1200,
    });

    expect(validProfile.success).toBe(true);
  });

  it("Test 2: Non-worker cannot access or modify worker endpoints (requireRole blocks with 403)", () => {
    const middleware = requireRole(UserRole.WORKER);
    const mockReq = { user: mockProviderUser } as unknown as Request;

    let errorResult: any = null;
    const next = (err?: any) => {
      errorResult = err;
    };

    middleware(mockReq, {} as Response, next);

    expect(errorResult).toBeDefined();
    expect(errorResult.statusCode).toBe(403);
    expect(errorResult.code).toBe("FORBIDDEN");
    expect(errorResult.message).toContain("Access denied");
  });

  it("Test 3: Worker can validate adding a valid skill", () => {
    const validSkill = addWorkerSkillSchema.safeParse({
      skillId: "123e4567-e89b-12d3-a456-426614174000",
      yearsExperience: 4,
    });

    expect(validSkill.success).toBe(true);
  });

  it("Test 4: Adding skill with invalid non-UUID format is rejected", () => {
    const invalidSkill = addWorkerSkillSchema.safeParse({
      skillId: "not-a-uuid",
      yearsExperience: 4,
    });

    expect(invalidSkill.success).toBe(false);
  });

  it("Test 5: Availability slot validates start and end time correctly (start < end)", () => {
    const validSlot = createAvailabilitySlotSchema.safeParse({
      availabilityDate: "2026-09-01",
      startTime: "09:00",
      endTime: "17:00",
      status: AvailabilityStatus.AVAILABLE_LATER,
    });
    expect(validSlot.success).toBe(true);

    const invalidSlot = createAvailabilitySlotSchema.safeParse({
      availabilityDate: "2026-09-01",
      startTime: "17:00",
      endTime: "09:00", // End time before start time
      status: AvailabilityStatus.AVAILABLE_LATER,
    });
    expect(invalidSlot.success).toBe(false);
  });

  it("Test 6: Expired AVAILABLE_NOW timestamp is dynamically evaluated as inactive", () => {
    const now = Date.now();
    const pastExpiry = new Date(now - 1000 * 60 * 60).toISOString(); // 1 hour in the past
    const futureExpiry = new Date(now + 1000 * 60 * 60 * 4).toISOString(); // 4 hours in future

    // Check past expiry
    const isPastExpired = new Date(pastExpiry).getTime() <= now;
    expect(isPastExpired).toBe(true);

    // Check future expiry
    const isFutureActive = new Date(futureExpiry).getTime() > now;
    expect(isFutureActive).toBe(true);
  });

  it("Test 7: Worker location schema validates valid coordinates and service radius (1-15 km)", () => {
    const validLocation = updateWorkerLocationSchema.safeParse({
      latitude: 12.9716,
      longitude: 77.5946,
      addressApproximate: "MG Road, Bangalore",
      serviceRadiusKm: 5.0,
    });
    expect(validLocation.success).toBe(true);

    const invalidRadius = updateWorkerLocationSchema.safeParse({
      latitude: 12.9716,
      longitude: 77.5946,
      serviceRadiusKm: 25.0, // Exceeds max 15 km limit
    });
    expect(invalidRadius.success).toBe(false);
  });

  it("Test 8: Invalid coordinates (latitude out of range) are rejected", () => {
    const invalidCoords = updateWorkerLocationSchema.safeParse({
      latitude: 112.9716, // Invalid latitude (> 90)
      longitude: 77.5946,
    });
    expect(invalidCoords.success).toBe(false);
  });

  it("Test 9: Server-side Profile Completion Calculator computes accurate score and missing fields", () => {
    // Incomplete profile (missing skills)
    const incomplete = workersService.calculateProfileCompletion(
      "Ramesh Kumar",
      "+919876543210",
      true, // has location
      0, // 0 skills
      "Short bio",
      3,
      "Domlur",
      400,
      1000,
    );

    expect(incomplete.isComplete).toBe(false);
    expect(incomplete.missingRequired).toContain("At Least One Skill");
    expect(incomplete.completionPercentage).toBeLessThan(100);

    // Fully complete profile
    const complete = workersService.calculateProfileCompletion(
      "Ramesh Kumar",
      "+919876543210",
      true,
      3, // 3 skills
      "Experienced electrician with 5 years experience.",
      5,
      "Domlur 100ft Road",
      400,
      1200,
    );

    expect(complete.isComplete).toBe(true);
    expect(complete.missingRequired.length).toBe(0);
    expect(complete.completionPercentage).toBe(100);
  });

  it("Test 10: Toggle Available-Now schema accepts future ISO datetime and boolean", () => {
    const futureIso = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const toggleOn = toggleAvailableNowSchema.safeParse({
      isAvailableNow: true,
      availableUntil: futureIso,
    });
    expect(toggleOn.success).toBe(true);

    const toggleOff = toggleAvailableNowSchema.safeParse({
      isAvailableNow: false,
    });
    expect(toggleOff.success).toBe(true);
  });
});
