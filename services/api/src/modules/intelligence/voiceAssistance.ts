/**
 * Voice-First & Low-Literacy Assistance Engine
 * Normalizes voice transcripts, identifies intents in multilingual inputs (Hindi/English/Kannada/Tamil),
 * and produces TTS audio readouts and simplified pictorial action cards for low-literacy users.
 */

import {
  VoiceAssistanceInput,
  VoiceAssistanceResponse,
  LowLiteracyCard,
} from "@nearvia/types";
import { query } from "../../db";
import { nlJobParser } from "./nlParser";

export class VoiceAssistanceEngine {
  /**
   * Processes voice input and generates structured actions with TTS response
   */
  async processVoiceInput(
    userId: string | undefined,
    input: VoiceAssistanceInput
  ): Promise<VoiceAssistanceResponse> {
    const raw = (input.transcript || "").trim();
    const lower = raw.toLowerCase();

    // 1. Detect Language
    let languageCode = input.languageCode || "en-IN";
    if (/\b(chahiye|kaam|kaha|kitna|rupay|batao|dikhao|madad|karna|hai|mera|kab)\b/i.test(lower)) {
      languageCode = "hi-IN";
    } else if (/\b(kelasa|beku|elli|eshtu|nodi|sahaya)\b/i.test(lower)) {
      languageCode = "kn-IN"; // Kannada
    } else if (/\b(velai|thevai|enga|evvalavu|udhavi)\b/i.test(lower)) {
      languageCode = "ta-IN"; // Tamil
    }

    // 2. Classify Intent
    const intent = this.classifyIntent(lower, input.mode, input.userRole);

    let spokenResponse = "";
    let structuredAction: VoiceAssistanceResponse["structuredAction"] = {
      type: "UNKNOWN",
      payload: {},
    };
    const lowLiteracyCards: LowLiteracyCard[] = [];

    // 3. Handle Intents
    if (intent === "JOB_SEARCH") {
      // Extract search parameters (e.g. category, radius)
      let searchKeyword = "";
      if (/clean|safai/i.test(lower)) searchKeyword = "Cleaning";
      else if (/cook|food|khana/i.test(lower)) searchKeyword = "Catering";
      else if (/pack|box/i.test(lower)) searchKeyword = "Packing";
      else if (/delivery|driver/i.test(lower)) searchKeyword = "Delivery";

      structuredAction = {
        type: "SEARCH_OPPORTUNITIES",
        payload: { search: searchKeyword, radiusKm: 5 },
      };

      if (languageCode === "hi-IN") {
        spokenResponse = searchKeyword
          ? `Aapke paas ${searchKeyword} ke naye kaam dhoondhe gaye hain. Neeche diye gaye button par click karein.`
          : "Aapke 5 kilometer ke daayre me uplabdh kaam dikhaye jaa rahe hain.";
      } else {
        spokenResponse = searchKeyword
          ? `Searching available ${searchKeyword} opportunities near you within 5 kilometers.`
          : "Showing all available shifts near your current location.";
      }

      lowLiteracyCards.push({
        icon: "Briefcase",
        title: searchKeyword ? `${searchKeyword} Work` : "All Nearby Work",
        subtitle: "Tap to view list with audio",
        actionType: "NAVIGATE",
        actionPayload: { route: `/find-work?search=${encodeURIComponent(searchKeyword)}` },
        audioText: spokenResponse,
      });
    } else if (intent === "JOB_CREATE") {
      // Pass through natural-language job drafter
      const draft = await nlJobParser.parseJobDescription({ text: raw });

      structuredAction = {
        type: "DRAFT_JOB",
        payload: draft,
      };

      if (languageCode === "hi-IN") {
        spokenResponse = `Maine aapke liye ${draft.title} ka draft tayyar kiya hai, ₹${draft.suggestedWage} pratidin ke hisaab se.`;
      } else {
        spokenResponse = `Drafted ${draft.title} scheduled for ${draft.workDate} at ₹${draft.suggestedWage}.`;
      }

      lowLiteracyCards.push({
        icon: "FileCheck",
        title: draft.title,
        subtitle: `₹${draft.suggestedWage} • ${draft.durationHours} Hours`,
        actionType: "NAVIGATE",
        actionPayload: { route: "/jobs/create", draft },
        audioText: spokenResponse,
      });
    } else if (intent === "STATUS") {
      structuredAction = {
        type: "VIEW_ASSIGNMENT",
        payload: {},
      };

      if (languageCode === "hi-IN") {
        spokenResponse = "Aapki active shifts aur aane wale kaam ki jaankari load ki jaa rahi hai.";
      } else {
        spokenResponse = "Opening your active shift console and schedule.";
      }

      lowLiteracyCards.push({
        icon: "Clock",
        title: "Active Shifts",
        subtitle: "View work status & PINs",
        actionType: "NAVIGATE",
        actionPayload: { route: "/worker/assignments" },
        audioText: spokenResponse,
      });
    } else {
      // General Help / Support
      structuredAction = {
        type: "CONTACT_SUPPORT",
        payload: {},
      };

      if (languageCode === "hi-IN") {
        spokenResponse = "NEARVIA sahayata kendra me aapka swagat hai. Kaam dhoondhne ke liye 'Kaam Dikhao' bolein.";
      } else {
        spokenResponse = "Welcome to NEARVIA voice assistant. Say 'Find Work' or 'Post a Job' to get started.";
      }

      lowLiteracyCards.push(
        {
          icon: "Briefcase",
          title: "Find Work (Kaam Khojo)",
          subtitle: "Tap to find nearby jobs",
          actionType: "NAVIGATE",
          actionPayload: { route: "/find-work" },
          audioText: "Tap here to find nearby work.",
        },
        {
          icon: "ShieldCheck",
          title: "Safety & Help",
          subtitle: "Emergency & support line",
          actionType: "CALL",
          actionPayload: { phone: "112" },
          audioText: "Emergency assistance line.",
        }
      );
    }

    // 4. Audit Log Ingestion
    try {
      await query(
        `INSERT INTO voice_assistance_logs (
          user_id, language_code, input_type, raw_input, detected_intent,
          extracted_entities, confidence_score
        ) VALUES ($1, $2, 'TRANSCRIPT', $3, $4, $5, 0.95)`,
        [
          userId || null,
          languageCode,
          raw,
          intent,
          JSON.stringify(structuredAction.payload),
        ]
      );
    } catch {}

    return {
      detectedIntent: intent,
      languageCode,
      transcribedText: raw,
      spokenResponse,
      audioText: spokenResponse,
      structuredAction,
      lowLiteracyCards,
    };
  }

  private classifyIntent(
    text: string,
    modeHint?: string,
    userRole?: string
  ): "JOB_SEARCH" | "JOB_CREATE" | "STATUS" | "HELP" {
    if (modeHint === "JOB_SEARCH") return "JOB_SEARCH";
    if (modeHint === "JOB_CREATE") return "JOB_CREATE";
    if (modeHint === "STATUS") return "STATUS";
    if (modeHint === "HELP") return "HELP";

    // Worker seeking work: "kaam chahiye", "kaam dikhao", "find work"
    if (/kaam chahiye|job chahiye|kaam dikhao|work chahiye|find work|search jobs/i.test(text)) {
      return "JOB_SEARCH";
    }

    // Provider seeking candidates: "helper chahiye", "worker chahiye", "2 log chahiye"
    if (
      userRole === "PROVIDER" ||
      /helper chahiye|worker chahiye|log chahiye|bande chahiye|post job|create job|hire/i.test(text)
    ) {
      return "JOB_CREATE";
    }

    if (/kaam|jobs|work|shift|find|search|dikhao|kaha hai/i.test(text)) {
      return "JOB_SEARCH";
    }

    if (/status|schedule|next shift|kab hai|time|paisa|earning/i.test(text)) {
      return "STATUS";
    }

    return "HELP";
  }
}

export const voiceAssistanceEngine = new VoiceAssistanceEngine();
