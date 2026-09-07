/**
 * Pure Deterministic Natural-Language Job Parser & Drafter
 * Extracts structured job fields (Title, Category, Skills, Schedule, Wage, Urgency, Responsibilities)
 * from free-text English, Hinglish, and regional transliterated descriptions.
 * Zero hard AI dependency — guaranteed deterministic baseline with optional AI enhancement.
 */

import {
  NLJobParseInput,
  NLJobParseResult,
  WorkType,
  PaymentType,
  UrgencyLevel,
} from "@nearvia/types";
import { query } from "../../db";

interface KnownTaxonomy {
  categories: Array<{ id: string; name: string; slug?: string }>;
  skills: Array<{ id: string; name: string; categoryId: string }>;
}

export class NLJobParser {
  private cachedTaxonomy: KnownTaxonomy | null = null;
  private lastTaxonomyFetch = 0;

  /**
   * Fetches category and trade skills taxonomy with caching.
   */
  async getTaxonomy(): Promise<KnownTaxonomy> {
    const now = Date.now();
    if (this.cachedTaxonomy && now - this.lastTaxonomyFetch < 60000) {
      return this.cachedTaxonomy;
    }

    const [catRes, skillRes] = await Promise.all([
      query<{ id: string; name: string }>(`SELECT id, name FROM categories ORDER BY name ASC`),
      query<{ id: string; name: string; category_id: string }>(
        `SELECT id, name, category_id FROM skills ORDER BY name ASC`
      ),
    ]);

    this.cachedTaxonomy = {
      categories: catRes.rows,
      skills: skillRes.rows.map((s) => ({
        id: s.id,
        name: s.name,
        categoryId: s.category_id,
      })),
    };
    this.lastTaxonomyFetch = now;
    return this.cachedTaxonomy;
  }

  /**
   * Main deterministic parsing pipeline
   */
  async parseJobDescription(input: NLJobParseInput): Promise<NLJobParseResult> {
    const rawText = (input.text || "").trim();
    const taxonomy = await this.getTaxonomy();

    const lower = rawText.toLowerCase();

    // 1. Detect Language / Dialect
    const isHinglish =
      /\b(chahiye|hoga|baje|kaam|kal|aaj|parso|rupay|rupaye|subah|shaam|dopahar|madad|ladke|log)\b/i.test(
        lower
      );
    const detectedLanguage = isHinglish ? "hi-IN (Hinglish/Hindi)" : "en-IN (English)";

    // 2. Extract Category & Trade Skills
    let matchedCategory = this.extractCategory(lower, taxonomy.categories);
    const matchedSkills = this.extractSkills(lower, taxonomy.skills, matchedCategory?.id);

    // If category wasn't directly matched but a skill was, infer category from skill
    if (!matchedCategory && matchedSkills.length > 0) {
      const primarySkill = matchedSkills[0];
      if (primarySkill) {
        matchedCategory = taxonomy.categories.find((c) => c.id === primarySkill.categoryId);
      }
    }

    // Default to general category if still unknown
    if (!matchedCategory && taxonomy.categories.length > 0) {
      matchedCategory =
        taxonomy.categories.find((c) => /general|other|helper|labor/i.test(c.name)) ||
        taxonomy.categories[0];
    }

    // 3. Extract Schedule (Date, Start Time, End Time, Duration)
    const schedule = this.extractSchedule(lower);

    // 4. Extract Payment & Wage
    const payment = this.extractPayment(lower);

    // 5. Extract Urgency
    const urgency = this.extractUrgency(lower);

    // 6. Extract Work Type
    const workType = this.extractWorkType(lower, schedule.durationHours);

    // 7. Generate Descriptive Title
    const title = this.generateTitle(rawText, matchedCategory?.name, matchedSkills);

    // 8. Generate Checklist & Responsibilities
    const responsibilities = this.extractResponsibilities(rawText, matchedSkills);

    // 9. Check Missing Fields & Missing Constraints
    const missingFields: string[] = [];
    const clarificationsNeeded: string[] = [];

    if (!payment.amount || payment.amount <= 0) {
      missingFields.push("wage_amount");
      clarificationsNeeded.push("Please specify the offered wage amount (e.g. ₹800/day).");
    }
    if (!input.locationHint?.addressApproximate && !this.hasLocationMention(lower)) {
      missingFields.push("location");
      clarificationsNeeded.push("Please select or confirm the exact job site location on the map.");
    }

    let confidence = 0.85;
    if (matchedSkills.length > 0) confidence += 0.1;
    if (missingFields.length > 0) confidence -= 0.15;
    confidence = Math.min(Math.max(confidence, 0.4), 0.98);

    return {
      title,
      description: rawText,
      workType,
      categoryId: matchedCategory?.id,
      categoryName: matchedCategory?.name,
      requiredSkills: matchedSkills.map((s) => ({
        skillId: s.id,
        skillName: s.name,
        minExperienceYears: 0,
        isRequired: true,
      })),
      suggestedWage: payment.amount,
      paymentType: payment.type,
      workDate: schedule.workDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      durationHours: schedule.durationHours,
      urgency,
      responsibilities,
      instructions: "Please arrive 10 minutes prior to shift start with valid ID card.",
      addressApproximate: input.locationHint?.addressApproximate,
      confidence: Number(confidence.toFixed(2)),
      missingFields,
      detectedLanguage,
      clarificationsNeeded,
    };
  }

  // ──────────────────────────────────────────────────
  // EXTRACTION HELPERS
  // ──────────────────────────────────────────────────

  private extractCategory(
    text: string,
    categories: Array<{ id: string; name: string }>
  ): { id: string; name: string } | undefined {
    // 1. Direct name match
    for (const cat of categories) {
      if (text.includes(cat.name.toLowerCase())) {
        return cat;
      }
    }

    // 2. Keyword alias dictionary mapped to category target patterns
    const aliasRules: Array<{ categoryPattern: RegExp; keywords: string[] }> = [
      {
        categoryPattern: /restaurant|hospitality|food|catering/i,
        keywords: ["catering", "food", "kitchen", "cooking", "cook", "chef", "waiter", "serving", "khana", "halwai", "mithai", "restaurant", "hotel"],
      },
      {
        categoryPattern: /cleaning|housekeeping/i,
        keywords: ["clean", "cleaning", "sanitization", "sweeper", "mopping", "housekeeping", "safai", "jhaadu", "pocha", "dishwashing", "bartan"],
      },
      {
        categoryPattern: /delivery|courier/i,
        keywords: ["delivery", "courier", "rider", "driver", "transport", "gadi"],
      },
      {
        categoryPattern: /warehouse|logistics/i,
        keywords: ["warehouse", "logistics", "loading", "unloading", "shifting", "godown", "inventory", "stock", "boxes"],
      },
      {
        categoryPattern: /retail|shop/i,
        keywords: ["retail", "shop", "store", "counter", "billing", "packing", "packaging", "cashier", "dukaan"],
      },
      {
        categoryPattern: /events|setup/i,
        keywords: ["event", "events", "festival", "function", "wedding", "decoration", "shaadi", "party", "stage"],
      },
      {
        categoryPattern: /skilled|trade/i,
        keywords: ["electrician", "wiring", "fan", "switchboard", "light", "bijli", "plumber", "pipe", "tap", "leakage", "water", "nal", "carpenter", "wood", "furniture", "door", "badhai"],
      },
      {
        categoryPattern: /construction|labor/i,
        keywords: ["construction", "mason", "masonry", "cement", "painter", "painting", "laborer", "heavy labor"],
      },
    ];

    for (const rule of aliasRules) {
      if (rule.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(text))) {
        const found = categories.find((c) => rule.categoryPattern.test(c.name));
        if (found) return found;
      }
    }

    return undefined;
  }

  private extractSkills(
    text: string,
    skills: Array<{ id: string; name: string; categoryId: string }>,
    categoryId?: string
  ): Array<{ id: string; name: string; categoryId: string }> {
    const matched: Array<{ id: string; name: string; categoryId: string }> = [];

    // Filter to category skills if category is known, or search all
    const candidates = categoryId
      ? skills.filter((s) => s.categoryId === categoryId)
      : skills;

    for (const s of candidates) {
      const sName = s.name.toLowerCase();
      if (text.includes(sName) || new RegExp(`\\b${sName}\\b`, "i").test(text)) {
        if (!matched.some((m) => m.id === s.id)) {
          matched.push(s);
        }
      }
    }

    // Also check common synonyms
    if (matched.length === 0) {
      if (/packing|packet|box/i.test(text)) {
        const packSkill = skills.find((s) => /pack/i.test(s.name));
        if (packSkill) matched.push(packSkill);
      }
      if (/clean|safai|washing/i.test(text)) {
        const cleanSkill = skills.find((s) => /clean/i.test(s.name));
        if (cleanSkill) matched.push(cleanSkill);
      }
      if (/cooking|cook|khana/i.test(text)) {
        const cookSkill = skills.find((s) => /cook/i.test(s.name));
        if (cookSkill) matched.push(cookSkill);
      }
    }

    return matched;
  }

  private extractSchedule(text: string): {
    workDate: string;
    startTime: string;
    endTime: string;
    durationHours: number;
  } {
    const today = new Date();
    let targetDate = new Date(today);

    // Date resolution
    if (/\b(tomorrow|kal)\b/i.test(text)) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (/\b(day after tomorrow|parso)\b/i.test(text)) {
      targetDate.setDate(targetDate.getDate() + 2);
    } else {
      // Default is today or tomorrow morning if past afternoon
      if (today.getHours() >= 17) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    const workDate = (targetDate.toISOString().split("T")[0] || today.toISOString().split("T")[0]) as string;

    // Time resolution
    let startHour = 9;
    let endHour = 17;

    // Matches e.g. "9am to 5pm", "10:00 to 18:00", "9 am - 5 pm", "10 baje se 4 baje"
    const rangeMatch = text.match(
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?\s*(?:to|-|se|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?/i
    );

    if (rangeMatch && rangeMatch[1] && rangeMatch[4]) {
      let rawStart = parseInt(rangeMatch[1], 10);
      const startPeriod = (rangeMatch[3] || "").toLowerCase();
      let rawEnd = parseInt(rangeMatch[4], 10);
      const endPeriod = (rangeMatch[6] || "").toLowerCase();

      if (startPeriod === "pm" && rawStart < 12) rawStart += 12;
      if (startPeriod === "am" && rawStart === 12) rawStart = 0;

      if (endPeriod === "pm" && rawEnd < 12) rawEnd += 12;
      else if (rawEnd < rawStart && rawEnd <= 12) rawEnd += 12; // e.g. 9 to 5 -> 9 to 17

      if (rawStart >= 0 && rawStart <= 23) startHour = rawStart;
      if (rawEnd > startHour && rawEnd <= 24) endHour = rawEnd;
    } else if (/\b(morning|subah)\b/i.test(text)) {
      startHour = 8;
      endHour = 14;
    } else if (/\b(evening|shaam|night)\b/i.test(text)) {
      startHour = 16;
      endHour = 22;
    } else if (/\b(afternoon|dopahar)\b/i.test(text)) {
      startHour = 12;
      endHour = 18;
    }

    const durationHours = Math.max(1, endHour - startHour);
    const startTime = `${String(startHour).padStart(2, "0")}:00:00`;
    const endTime = `${String(endHour).padStart(2, "0")}:00:00`;

    return { workDate, startTime, endTime, durationHours };
  }

  private extractPayment(text: string): { amount: number; type: PaymentType } {
    let type: PaymentType = PaymentType.DAILY;
    let amount = 800; // Sensible default in INR

    // Regex for amounts: ₹800, Rs. 1200, 800 rupees, 150/hr, 700 rs
    const wageMatch = text.match(
      /(?:rs\.?|₹|inr|rupaye?|rupees?)?\s*(\d{3,5})\s*(?:rs\.?|₹|inr|rupaye?|rupees?|\/-\b)?(?:\s*(?:per|\/)\s*(hour|hr|day|shift|task))?/i
    );

    if (wageMatch && wageMatch[1]) {
      const parsed = parseInt(wageMatch[1], 10);
      const unit = (wageMatch[2] || "").toLowerCase();

      if (unit === "hour" || unit === "hr" || /\b(per hour|hourly|\/hr)\b/i.test(text)) {
        type = PaymentType.HOURLY;
        amount = parsed;
      } else if (unit === "task" || /\b(fixed|contract|lump sum)\b/i.test(text)) {
        type = PaymentType.FIXED;
        amount = parsed;
      } else {
        type = PaymentType.DAILY;
        amount = parsed;
      }
    } else if (/\b(\d{2,3})\s*(?:per hour|\/hr|\/hour)\b/i.test(text)) {
      const hrMatch = text.match(/(\d{2,3})\s*(?:per hour|\/hr|\/hour)/i);
      if (hrMatch && hrMatch[1]) {
        type = PaymentType.HOURLY;
        amount = parseInt(hrMatch[1], 10);
      }
    }

    return { amount, type };
  }

  private extractUrgency(text: string): UrgencyLevel {
    if (/\b(urgent|immediate|asap|turant|jaldi|emergency)\b/i.test(text)) {
      return UrgencyLevel.IMMEDIATE;
    }
    if (/\b(today|aaj|starting soon|quick)\b/i.test(text)) {
      return UrgencyLevel.URGENT;
    }
    return UrgencyLevel.NORMAL;
  }

  private extractWorkType(text: string, durationHours: number): WorkType {
    if (/\b(project|week|month|contract|multiple days)\b/i.test(text)) {
      return WorkType.JOB;
    }
    if (durationHours >= 6 || /\b(shift|full day|half day|duty)\b/i.test(text)) {
      return WorkType.SHIFT;
    }
    return WorkType.TASK;
  }

  private generateTitle(
    rawText: string,
    categoryName?: string,
    skills?: Array<{ name: string }>
  ): string {
    const firstLine = rawText.split("\n")[0]?.trim() || "";
    if (firstLine.length >= 10 && firstLine.length <= 60 && !/^(i need|we need|wanted)/i.test(firstLine)) {
      return firstLine.charAt(0).toUpperCase() + firstLine.slice(1);
    }

    if (skills && skills.length > 0) {
      return `${skills.map((s) => s.name).join(" & ")} Assistant`;
    }

    if (categoryName) {
      return `${categoryName} Support Staff`;
    }

    return "Hyperlocal Work Opportunity";
  }

  private extractResponsibilities(
    rawText: string,
    skills: Array<{ name: string }>
  ): string[] {
    const items: string[] = [];
    const lines = rawText.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.length >= 8 && line.length <= 100 && !/^\d+\s*(rs|rupay|baje|am|pm)/i.test(line)) {
        items.push(line.charAt(0).toUpperCase() + line.slice(1));
      }
    }

    if (items.length === 0) {
      if (skills.length > 0) {
        items.push(`Execute tasks related to ${skills.map((s) => s.name).join(", ")}.`);
      }
      items.push("Follow workplace safety guidelines and on-site supervisor instructions.");
      items.push("Maintain cleanliness and complete sign-off upon shift completion.");
    }

    return items.slice(0, 5);
  }

  private hasLocationMention(text: string): boolean {
    const commonBangaloreAreas = [
      "jayanagar", "indiranagar", "koramangala", "whitefield", "electronic city",
      "hsr", "btm", "malleswaram", "rajajinagar", "shivajinagar", "marathahalli",
      "yelahanka", "bellandur", "hebbal", "majestic", "mg road", "banashankari"
    ];
    return commonBangaloreAreas.some((area) => text.includes(area));
  }
}

export const nlJobParser = new NLJobParser();
