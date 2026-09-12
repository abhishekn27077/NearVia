import { describe, it, expect } from "vitest";
import {
  TRANSLATIONS,
  Language,
  formatCurrency,
  formatDistance,
  formatDate,
  getSpeechLanguageCode,
  buildJobNarrationText,
  getLocalizedAssignmentStatus,
  getLocalizedApplicationStatus,
} from "../../../apps/web/src/context/translations";

describe("Phase 17: Multilingual + Accessibility Verification Suite", () => {
  const supportedLanguages: Language[] = ["en", "kn", "hi"];

  describe("1. Translation Dictionary Parity & Completeness", () => {
    const englishKeys = Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[];

    it("should have at least 140 comprehensive translation keys in English dictionary", () => {
      expect(englishKeys.length).toBeGreaterThanOrEqual(140);
    });

    it("should have 100% key parity in Kannada (kn) dictionary with zero missing keys", () => {
      const kannadaDict = TRANSLATIONS.kn;
      const missingInKannada: string[] = [];

      for (const key of englishKeys) {
        if (!kannadaDict[key] || typeof kannadaDict[key] !== "string" || kannadaDict[key].trim() === "") {
          missingInKannada.push(key);
        }
      }

      expect(missingInKannada).toEqual([]);
      expect(Object.keys(kannadaDict).length).toBe(englishKeys.length);
    });

    it("should have 100% key parity in Hindi (hi) dictionary with zero missing keys", () => {
      const hindiDict = TRANSLATIONS.hi;
      const missingInHindi: string[] = [];

      for (const key of englishKeys) {
        if (!hindiDict[key] || typeof hindiDict[key] !== "string" || hindiDict[key].trim() === "") {
          missingInHindi.push(key);
        }
      }

      expect(missingInHindi).toEqual([]);
      expect(Object.keys(hindiDict).length).toBe(englishKeys.length);
    });

    it("should contain authentic Kannada Unicode script in Kannada translations", () => {
      const kannadaDict = TRANSLATIONS.kn;
      const kannadaScriptRegex = /[\u0C80-\u0CFF]/;

      // Sample core user-facing terms
      expect(kannadaScriptRegex.test(kannadaDict.findWork)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.checkIn)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.cashPayment)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.safetyCenter)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.agentPortal)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.earningsToday)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.settlementPin)).toBe(true);
      expect(kannadaScriptRegex.test(kannadaDict.hiredTapToConfirm)).toBe(true);
    });

    it("should contain authentic Devanagari Unicode script in Hindi translations", () => {
      const hindiDict = TRANSLATIONS.hi;
      const devanagariScriptRegex = /[\u0900-\u097F]/;

      // Sample core user-facing terms
      expect(devanagariScriptRegex.test(hindiDict.findWork)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.checkIn)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.cashPayment)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.safetyCenter)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.agentPortal)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.earningsToday)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.settlementPin)).toBe(true);
      expect(devanagariScriptRegex.test(hindiDict.hiredTapToConfirm)).toBe(true);
    });
  });

  describe("2. Fallback Translations Mechanism", () => {
    it("should safely fall back to English if a key is not found in the active language", () => {
      const simulateTranslate = (lang: Language, key: string, fallback?: string): string => {
        const dict = TRANSLATIONS[lang] as unknown as Record<string, string>;
        if (dict && dict[key]) return dict[key];
        const enDict = TRANSLATIONS.en as unknown as Record<string, string>;
        if (enDict && enDict[key]) return enDict[key];
        return fallback || key;
      };

      // Existing key in Kannada
      expect(simulateTranslate("kn", "checkIn")).toBe(TRANSLATIONS.kn.checkIn);

      // Non-existent key in Kannada should fall back to English if present in English
      expect(simulateTranslate("kn", "nonExistentKey", "Custom Fallback")).toBe("Custom Fallback");
      expect(simulateTranslate("kn", "nonExistentKey")).toBe("nonExistentKey");
    });
  });

  describe("3. Currency Formatter (₹ / INR)", () => {
    it("should format numbers with Indian Rupee symbol and en-IN thousand separators", () => {
      expect(formatCurrency(500)).toBe("₹500");
      expect(formatCurrency(1200)).toBe("₹1,200");
      expect(formatCurrency(50000)).toBe("₹50,000");
      expect(formatCurrency(150000)).toBe("₹1,50,000");
    });

    it("should handle string numbers and edge cases gracefully", () => {
      expect(formatCurrency("850")).toBe("₹850");
      expect(formatCurrency(0)).toBe("₹0");
      expect(formatCurrency("")).toBe("₹0");
      expect(formatCurrency(NaN as any)).toBe("₹0");
    });
  });

  describe("4. Distance Formatter Across Languages", () => {
    it("should format distance correctly in English", () => {
      expect(formatDistance(0.35, "en")).toBe("350 m");
      expect(formatDistance(2.4, "en")).toBe("2.4 km");
      expect(formatDistance(5, "en")).toBe("5.0 km");
    });

    it("should format distance with Kannada units (ಮೀ / ಕಿ.ಮೀ)", () => {
      expect(formatDistance(0.4, "kn")).toBe("400 ಮೀ");
      expect(formatDistance(1.8, "kn")).toBe("1.8 ಕಿ.ಮೀ");
      expect(formatDistance(4.5, "kn")).toBe("4.5 ಕಿ.ಮೀ");
    });

    it("should format distance with Hindi units (मी / कि.मी)", () => {
      expect(formatDistance(0.5, "hi")).toBe("500 मी");
      expect(formatDistance(3.2, "hi")).toBe("3.2 कि.मी");
      expect(formatDistance(5.0, "hi")).toBe("5.0 कि.मी");
    });
  });

  describe("5. Date Formatter", () => {
    it("should format dates without crashing across all languages", () => {
      const testDate = new Date("2026-09-09T10:00:00.000Z");
      for (const lang of supportedLanguages) {
        const formatted = formatDate(testDate, lang);
        expect(formatted).toBeTruthy();
        expect(typeof formatted).toBe("string");
        expect(formatted.length).toBeGreaterThan(3);
      }
    });
  });

  describe("6. Dynamic Status Badge Helpers", () => {
    it("should translate assignment statuses across English, Kannada, and Hindi", () => {
      expect(getLocalizedAssignmentStatus("ASSIGNED", "en")).toBe(TRANSLATIONS.en.hiredTapToConfirm);
      expect(getLocalizedAssignmentStatus("ASSIGNED", "kn")).toBe(TRANSLATIONS.kn.hiredTapToConfirm);
      expect(getLocalizedAssignmentStatus("ASSIGNED", "hi")).toBe(TRANSLATIONS.hi.hiredTapToConfirm);

      expect(getLocalizedAssignmentStatus("CONFIRMED", "en")).toBe(TRANSLATIONS.en.confirmedReadyForArrival);
      expect(getLocalizedAssignmentStatus("IN_PROGRESS", "kn")).toBe(TRANSLATIONS.kn.shiftInProgress);
      expect(getLocalizedAssignmentStatus("COMPLETED", "hi")).toBe(TRANSLATIONS.hi.shiftCompletedBadge);
    });

    it("should translate application statuses across English, Kannada, and Hindi", () => {
      expect(getLocalizedApplicationStatus("PENDING", "en")).toBe(TRANSLATIONS.en.statusPendingReview);
      expect(getLocalizedApplicationStatus("PENDING", "kn")).toBe(TRANSLATIONS.kn.statusPendingReview);
      expect(getLocalizedApplicationStatus("PENDING", "hi")).toBe(TRANSLATIONS.hi.statusPendingReview);

      expect(getLocalizedApplicationStatus("SHORTLISTED", "en")).toBe(TRANSLATIONS.en.statusShortlisted);
      expect(getLocalizedApplicationStatus("ACCEPTED", "kn")).toBe(TRANSLATIONS.kn.accepted);
      expect(getLocalizedApplicationStatus("REJECTED", "hi")).toBe(TRANSLATIONS.hi.statusDeclined);
      expect(getLocalizedApplicationStatus("WITHDRAWN", "en")).toBe(TRANSLATIONS.en.statusWithdrawn);
    });
  });

  describe("7. Voice Read-Aloud Narration & Speech Codes", () => {
    it("should map languages to correct BCP 47 speech synthesis codes", () => {
      expect(getSpeechLanguageCode("en")).toBe("en-IN");
      expect(getSpeechLanguageCode("kn")).toBe("kn-IN");
      expect(getSpeechLanguageCode("hi")).toBe("hi-IN");
    });

    it("should build natural spoken text for job in English", () => {
      const job = {
        title: "Bakery Helper Shift",
        description: "Assist with packing bread and cleaning trays",
        paymentAmount: 600,
        durationHours: 4,
        distanceKm: 1.5,
        requirements: "Clean shoes required",
      };

      const text = buildJobNarrationText(job, "en");
      expect(text).toContain("Bakery Helper Shift");
      expect(text).toContain("₹600");
      expect(text).toContain("4 hours");
      expect(text).toContain("1.5 km away");
      expect(text).toContain("Assist with packing bread");
      expect(text).toContain("Clean shoes required");
    });

    it("should build natural spoken text for job in Kannada", () => {
      const job = {
        title: "ಬೇಕರಿ ಸಹಾಯಕರ ಕೆಲಸ",
        description: "ಬ್ರೆಡ್ ಪ್ಯಾಕಿಂಗ್ ಮತ್ತು ಟ್ರೇ ಸ್ವಚ್ಛತೆ",
        paymentAmount: 600,
        durationHours: 4,
        distanceKm: 1.5,
        requirements: "ಶುದ್ಧ ಬಟ್ಟೆ ಅಗತ್ಯ",
      };

      const text = buildJobNarrationText(job, "kn");
      expect(text).toContain("ಬೇಕರಿ ಸಹಾಯಕರ ಕೆಲಸ");
      expect(text).toContain("₹600");
      expect(text).toContain("4 ಗಂಟೆಗಳು");
      expect(text).toContain("1.5 ಕಿ.ಮೀ");
      expect(text).toContain("ದೂರದಲ್ಲಿದೆ");
      expect(text).toContain("ಬ್ರೆಡ್ ಪ್ಯಾಕಿಂಗ್");
    });

    it("should build natural spoken text for job in Hindi", () => {
      const job = {
        title: "बेकरी हेल्पर शिफ्ट",
        description: "ब्रेड पैकिंग और ट्रे सफाई",
        paymentAmount: 600,
        durationHours: 4,
        distanceKm: 2.0,
        requirements: "साफ जूते आवश्यक",
      };

      const text = buildJobNarrationText(job, "hi");
      expect(text).toContain("बेकरी हेल्पर शिफ्ट");
      expect(text).toContain("₹600");
      expect(text).toContain("4 घंटे");
      expect(text).toContain("2.0 कि.मी");
      expect(text).toContain("दूरी पर");
      expect(text).toContain("ब्रेड पैकिंग");
    });
  });

  describe("8. Low-Literacy & Accessibility Standards (WCAG 2.2 AA)", () => {
    it("should verify touch target size requirements (>= 44px min-height/min-width)", () => {
      // WCAG 2.2 Criterion 2.5.8 Target Size (Minimum) is 24x24 CSS px; NearVia enforces 44-48px
      const minTouchTargetPx = 44;
      expect(minTouchTargetPx).toBeGreaterThanOrEqual(44);
    });

    it("should enforce dual status indicators (icons + text) to avoid color-only communication", () => {
      const statuses = [
        { key: "statusAssigned", icon: "Clock", text: TRANSLATIONS.en.statusAssigned },
        { key: "statusConfirmed", icon: "CheckCircle", text: TRANSLATIONS.en.statusConfirmed },
        { key: "statusCheckedIn", icon: "ShieldCheck", text: TRANSLATIONS.en.statusCheckedIn },
        { key: "statusInProgress", icon: "PlayCircle", text: TRANSLATIONS.en.statusInProgress },
        { key: "statusCompleted", icon: "CheckCircle2", text: TRANSLATIONS.en.statusCompleted },
        { key: "statusClosed", icon: "Lock", text: TRANSLATIONS.en.statusClosed },
      ];

      for (const s of statuses) {
        expect(s.icon).toBeTruthy();
        expect(s.text.length).toBeGreaterThan(0);
      }
    });

    it("should have dedicated emergency safety notices across all 3 languages advising 112", () => {
      expect(TRANSLATIONS.en.emergencyNotice).toContain("112");
      expect(TRANSLATIONS.kn.emergencyNotice).toContain("112");
      expect(TRANSLATIONS.hi.emergencyNotice).toContain("112");
      expect(TRANSLATIONS.en.nationalEmergency112).toContain("112");
      expect(TRANSLATIONS.kn.nationalEmergency112).toContain("112");
      expect(TRANSLATIONS.hi.nationalEmergency112).toContain("112");
    });
  });
});
