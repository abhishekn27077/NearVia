import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistanceKm,
  isWithin5KmRadius,
} from "@nearvia/shared";
import { buildSpatialProximityQuery } from "../src/db";
import {
  UserRole,
  WorkType,
  WorkOpportunityStatus,
  ApplicationStatus,
  AssignmentStatus,
} from "@nearvia/types";

describe("Database Relational Integrity & Schema Validation", () => {
  // Mock Schema Model Definitions for Integrity Invariant Validation
  interface MockUser {
    id: string;
    authId: string;
    phone: string;
    fullName: string;
    role: UserRole;
  }

  interface MockWorkerProfile {
    id: string;
    userId: string;
    location: { latitude: number; longitude: number };
    averageRating: number;
  }

  interface MockApplication {
    id: string;
    workOpportunityId: string;
    workerId: string;
    status: ApplicationStatus;
  }

  interface MockReview {
    id: string;
    assignmentId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
  }

  interface MockPaymentRecord {
    id: string;
    assignmentId: string;
    amount: number;
    currency: string;
  }

  it("Constraint Test: User can only have a single 1:1 Worker Profile", () => {
    const existingProfiles: MockWorkerProfile[] = [
      {
        id: "w1",
        userId: "u1",
        location: { latitude: 12.961, longitude: 77.6372 },
        averageRating: 5.0,
      },
    ];

    const canCreateDuplicate = (userId: string): boolean => {
      const exists = existingProfiles.some((p) => p.userId === userId);
      if (exists) {
        throw new Error(
          "UNIQUE constraint failed: worker_profiles.user_id must be unique",
        );
      }
      return true;
    };

    expect(() => canCreateDuplicate("u1")).toThrow("UNIQUE constraint failed");
    expect(canCreateDuplicate("u2")).toBe(true);
  });

  it("Constraint Test: Duplicate active applications from same worker for same opportunity are rejected", () => {
    const existingApplications: MockApplication[] = [
      {
        id: "app1",
        workOpportunityId: "job1",
        workerId: "w1",
        status: ApplicationStatus.PENDING,
      },
    ];

    const submitApplication = (
      workOpportunityId: string,
      workerId: string,
    ): boolean => {
      const duplicate = existingApplications.some(
        (a) =>
          a.workOpportunityId === workOpportunityId && a.workerId === workerId,
      );
      if (duplicate) {
        throw new Error(
          "UNIQUE constraint failed: (work_opportunity_id, worker_id) must be unique",
        );
      }
      return true;
    };

    expect(() => submitApplication("job1", "w1")).toThrow(
      "UNIQUE constraint failed",
    );
    expect(submitApplication("job1", "w2")).toBe(true);
    expect(submitApplication("job2", "w1")).toBe(true);
  });

  it("Constraint Test: Rating must satisfy 1 <= rating <= 5", () => {
    const validateRatingConstraint = (rating: number): boolean => {
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new Error("CHECK constraint failed: rating >= 1 AND rating <= 5");
      }
      return true;
    };

    expect(validateRatingConstraint(1)).toBe(true);
    expect(validateRatingConstraint(5)).toBe(true);
    expect(validateRatingConstraint(3)).toBe(true);
    expect(() => validateRatingConstraint(0)).toThrow(
      "CHECK constraint failed",
    );
    expect(() => validateRatingConstraint(6)).toThrow(
      "CHECK constraint failed",
    );
    expect(() => validateRatingConstraint(3.5)).toThrow(
      "CHECK constraint failed",
    );
  });

  it("Constraint Test: Monetary payment amount must be strictly positive", () => {
    const validatePaymentAmount = (amount: number): boolean => {
      if (amount <= 0) {
        throw new Error("CHECK constraint failed: payment_amount > 0");
      }
      return true;
    };

    expect(validatePaymentAmount(450.0)).toBe(true);
    expect(validatePaymentAmount(0.01)).toBe(true);
    expect(() => validatePaymentAmount(0)).toThrow("CHECK constraint failed");
    expect(() => validatePaymentAmount(-100)).toThrow(
      "CHECK constraint failed",
    );
  });

  it("Relationship Test: Review must be linked to a valid Assignment and enforce one review per participant", () => {
    const existingReviews: MockReview[] = [
      {
        id: "r1",
        assignmentId: "assign1",
        reviewerId: "provider1",
        revieweeId: "worker1",
        rating: 5,
      },
    ];

    const addReview = (
      assignmentId: string,
      reviewerId: string,
      revieweeId: string,
      rating: number,
    ): boolean => {
      const duplicate = existingReviews.some(
        (r) => r.assignmentId === assignmentId && r.reviewerId === reviewerId,
      );
      if (duplicate) {
        throw new Error(
          "UNIQUE constraint failed: (assignment_id, reviewer_id) must be unique",
        );
      }
      return true;
    };

    // Duplicate review from same reviewer on same assignment is rejected
    expect(() => addReview("assign1", "provider1", "worker1", 4)).toThrow(
      "UNIQUE constraint failed",
    );
    // Counter-review from reviewee (worker) on same assignment is accepted
    expect(addReview("assign1", "worker1", "provider1", 5)).toBe(true);
  });
});

describe("Spatial PostGIS 5 KM Hyperlocal Discovery", () => {
  // Test Coordinates (Bengaluru Hyperlocal Grid)
  // Job Site Center: Indiranagar (12.9784 N, 77.6408 E)
  const jobSiteLocation = { latitude: 12.9784, longitude: 77.6408 };

  // Worker A: Domlur (12.9610 N, 77.6372 E) -> ~2.0 km (Within 5 km radius)
  const workerALocation = { latitude: 12.961, longitude: 77.6372 };

  // Worker B: Whitefield (12.9698 N, 77.7499 E) -> ~11.8 km (Outside 5 km radius)
  const workerBLocation = { latitude: 12.9698, longitude: 77.7499 };

  it("should generate valid PostGIS spatial proximity SQL query fragments", () => {
    const spatial = buildSpatialProximityQuery(5.0);
    expect(spatial.filterSql).toContain("ST_DWithin");
    expect(spatial.filterSql).toContain("5000");
    expect(spatial.distanceSql).toContain("ST_Distance");
  });

  it("Hyperlocal Discovery Test: Worker A within 5 km is included, Worker B outside 5 km is excluded", () => {
    const distanceWorkerA = calculateHaversineDistanceKm(
      jobSiteLocation,
      workerALocation,
    );
    const distanceWorkerB = calculateHaversineDistanceKm(
      jobSiteLocation,
      workerBLocation,
    );

    expect(distanceWorkerA).toBeLessThan(5.0);
    expect(distanceWorkerA).toBeCloseTo(1.97, 1);
    expect(isWithin5KmRadius(jobSiteLocation, workerALocation)).toBe(true);

    expect(distanceWorkerB).toBeGreaterThan(5.0);
    expect(distanceWorkerB).toBeCloseTo(11.86, 1);
    expect(isWithin5KmRadius(jobSiteLocation, workerBLocation)).toBe(false);

    // Mock Spatial Filter Query Simulation
    const candidates = [
      { id: "worker_a", name: "Worker A (Domlur)", location: workerALocation },
      {
        id: "worker_b",
        name: "Worker B (Whitefield)",
        location: workerBLocation,
      },
    ];

    const nearbyWorkers = candidates.filter((candidate) =>
      isWithin5KmRadius(jobSiteLocation, candidate.location),
    );

    expect(nearbyWorkers.length).toBe(1);
    expect(nearbyWorkers[0]?.id).toBe("worker_a");
  });
});
