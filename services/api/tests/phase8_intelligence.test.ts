import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("../src/db", () => ({
  query: vi.fn((sql: string) => {
    if (sql.includes("FROM skills")) {
      return Promise.resolve({
        rows: [
          { id: "skill-1", name: "Packing", category_id: "cat-2" },
          { id: "skill-2", name: "Cooking", category_id: "cat-1" },
          { id: "skill-3", name: "Floor Cleaning", category_id: "cat-3" },
          { id: "skill-4", name: "Electrician", category_id: "cat-4" },
        ],
      });
    }
    if (sql.includes("FROM categories")) {
      return Promise.resolve({
        rows: [
          { id: "cat-1", name: "Restaurant & Hospitality" },
          { id: "cat-2", name: "Retail & Shop Assistance" },
          { id: "cat-3", name: "Cleaning & Housekeeping" },
          { id: "cat-4", name: "Skilled Local Trades" },
        ],
      });
    }
    if (sql.includes("work_opportunities") && sql.includes("GROUP BY")) {
      return Promise.resolve({
        rows: [
          {
            location_name: "Indiranagar",
            latitude: 12.97,
            longitude: 77.64,
            active_jobs: "5",
            top_categories: ["cat-1"],
          },
        ],
      });
    }
    if (sql.includes("worker_profiles") && sql.includes("GROUP BY")) {
      return Promise.resolve({
        rows: [
          {
            latitude: 12.97,
            longitude: 77.64,
            active_workers: "3",
          },
        ],
      });
    }
    return Promise.resolve({ rows: [] });
  }),
  withTransaction: vi.fn((cb) => cb({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
}));

import { nlJobParser } from "../src/modules/intelligence/nlParser";
import { candidateMatchingEngine } from "../src/modules/intelligence/candidateMatching";
import { voiceAssistanceEngine } from "../src/modules/intelligence/voiceAssistance";
import { marketIntelligenceEngine } from "../src/modules/intelligence/marketIntelligence";
import { WorkType, PaymentType, UrgencyLevel } from "@nearvia/types";

describe("Phase 8 Intelligence Layer: Unit Tests", () => {
  describe("1. Deterministic Natural-Language Job Drafter", () => {
    beforeAll(() => {
      vi.spyOn(nlJobParser, "getTaxonomy").mockResolvedValue({
        categories: [
          { id: "cat-1", name: "Restaurant & Hospitality" },
          { id: "cat-2", name: "Retail & Shop Assistance" },
          { id: "cat-3", name: "Cleaning & Housekeeping" },
          { id: "cat-4", name: "Skilled Local Trades" },
        ],
        skills: [
          { id: "skill-1", name: "Packing", categoryId: "cat-2" },
          { id: "skill-2", name: "Cooking", categoryId: "cat-1" },
          { id: "skill-3", name: "Floor Cleaning", categoryId: "cat-3" },
          { id: "skill-4", name: "Electrician", categoryId: "cat-4" },
        ],
      });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it("should parse English task descriptions and extract structured fields", async () => {
      const input = {
        text: "Need 2 workers for sweet box packing tomorrow from 9am to 5pm in Jayanagar, offering 800 rupees per day",
      };

      const result = await nlJobParser.parseJobDescription(input);

      expect(result.suggestedWage).toBe(800);
      expect(result.paymentType).toBe(PaymentType.DAILY);
      expect(result.startTime).toBe("09:00:00");
      expect(result.endTime).toBe("17:00:00");
      expect(result.durationHours).toBe(8);
      expect(result.requiredSkills.length).toBeGreaterThan(0);
      expect(result.categoryName).toBe("Retail & Shop Assistance");
      expect(result.responsibilities.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should parse Hinglish descriptions and extract schedule and wage accurately", async () => {
      const input = {
        text: "Kal subah 10 baje se 4 baje tak catering cook chahiye Shivajinagar me 750 rupay",
      };

      const result = await nlJobParser.parseJobDescription(input);

      expect(result.detectedLanguage).toContain("hi-IN");
      expect(result.suggestedWage).toBe(750);
      expect(result.startTime).toBe("10:00:00");
      expect(result.endTime).toBe("16:00:00");
      expect(result.durationHours).toBe(6);
      expect(result.categoryName).toBe("Restaurant & Hospitality");
    });

    it("should flag missing wage or location fields", async () => {
      const input = {
        text: "Need someone for cleaning",
      };

      const result = await nlJobParser.parseJobDescription(input);

      expect(result.missingFields).toContain("location");
      expect(result.clarificationsNeeded.length).toBeGreaterThan(0);
    });
  });

  describe("2. Voice-First & Low-Literacy Processing", () => {
    it("should detect JOB_SEARCH intent and generate spoken Hindi readout", async () => {
      const result = await voiceAssistanceEngine.processVoiceInput(undefined, {
        transcript: "Mujhe aaj safai ka kaam dikhao",
      });

      expect(result.detectedIntent).toBe("JOB_SEARCH");
      expect(result.languageCode).toBe("hi-IN");
      expect(result.spokenResponse.length).toBeGreaterThan(10);
      expect(result.lowLiteracyCards.length).toBeGreaterThan(0);
      expect(result.lowLiteracyCards[0].actionType).toBe("NAVIGATE");
    });

    it("should detect JOB_CREATE intent for employer voice commands", async () => {
      const result = await voiceAssistanceEngine.processVoiceInput(undefined, {
        transcript: "Need 2 helpers for packing boxes tomorrow morning 800 rs",
        mode: "JOB_CREATE",
      });

      expect(result.detectedIntent).toBe("JOB_CREATE");
      expect(result.structuredAction.type).toBe("DRAFT_JOB");
      expect(result.lowLiteracyCards[0].subtitle).toContain("800");
    });
  });

  describe("3. Hyperlocal Market Intelligence", () => {
    it("should generate balanced hotspot distributions with fallback clusters", async () => {
      const hotspots = await marketIntelligenceEngine.getDemandHotspots(12.9716, 77.5946, 10);

      expect(hotspots.length).toBeGreaterThan(0);
      expect(hotspots[0]).toHaveProperty("locationName");
      expect(hotspots[0]).toHaveProperty("activeOpportunitiesCount");
      expect(hotspots[0]).toHaveProperty("supplyDemandRatio");
      expect(hotspots[0]).toHaveProperty("urgencyTier");
    });
  });
});
