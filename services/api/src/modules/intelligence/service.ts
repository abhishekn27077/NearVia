/**
 * Unified Domain Intelligence Service
 * Facade coordinating Deterministic Matching, Natural-Language Job Drafting,
 * Provider Candidate Recommendations, Voice Assistance, and Market Intelligence.
 */

import {
  NLJobParseInput,
  NLJobParseResult,
  VoiceAssistanceInput,
  VoiceAssistanceResponse,
  CandidateRecommendation,
  MarketWageBenchmark,
  MarketDemandHotspot,
  DiscoveryQueryParams,
  DiscoveryQueryResult,
} from "@nearvia/types";
import { nlJobParser } from "./nlParser";
import { candidateMatchingEngine } from "./candidateMatching";
import { voiceAssistanceEngine } from "./voiceAssistance";
import { marketIntelligenceEngine } from "./marketIntelligence";
import { matchingService } from "../matching/service";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

export class IntelligenceService {
  /**
   * 1. Natural-Language Job Parser & Auto-Drafter
   */
  async parseNLJob(input: NLJobParseInput): Promise<NLJobParseResult> {
    if (!input.text || input.text.trim().length === 0) {
      throw new AppError("Job description text cannot be empty", 400, ErrorCode.VALIDATION_ERROR);
    }
    return await nlJobParser.parseJobDescription(input);
  }

  /**
   * 2. Voice-First & Low-Literacy Processing
   */
  async processVoice(
    userId: string | undefined,
    input: VoiceAssistanceInput
  ): Promise<VoiceAssistanceResponse> {
    return await voiceAssistanceEngine.processVoiceInput(userId, input);
  }

  /**
   * 3. Provider-Side Candidate Recommendations
   */
  async getRecommendedCandidates(
    providerUserId: string,
    workOpportunityId: string,
    limit = 10
  ): Promise<CandidateRecommendation[]> {
    // Validate provider owns or has access to this opportunity
    const checkRes = await query<{ id: string }>(
      `SELECT wo.id 
       FROM work_opportunities wo
       JOIN provider_profiles pp ON wo.provider_id = pp.id
       WHERE wo.id = $1 AND pp.user_id = $2`,
      [workOpportunityId, providerUserId]
    );

    if (!checkRes.rows[0]) {
      throw new AppError(
        "Work opportunity not found or you are not authorized to view candidates for it",
        403,
        ErrorCode.FORBIDDEN
      );
    }

    return await candidateMatchingEngine.getRecommendedCandidates(workOpportunityId, limit);
  }

  /**
   * 4. Worker-Side Recommended Opportunities (Deterministic Matching)
   */
  async getWorkerRecommendedJobs(
    workerUserId: string,
    params: DiscoveryQueryParams = {}
  ): Promise<DiscoveryQueryResult> {
    return await matchingService.matchWorkOpportunitiesForWorker(workerUserId, {
      ...params,
      sort: "RECOMMENDED",
    });
  }

  /**
   * 5. Market Wage Analytics & Benchmarks
   */
  async getWageBenchmarks(categoryId?: string): Promise<MarketWageBenchmark[]> {
    return await marketIntelligenceEngine.getWageBenchmarks(categoryId);
  }

  /**
   * 6. Hyperlocal Demand & Supply Hotspots
   */
  async getDemandHotspots(
    lat?: number,
    lng?: number,
    radiusKm?: number
  ): Promise<MarketDemandHotspot[]> {
    return await marketIntelligenceEngine.getDemandHotspots(lat, lng, radiusKm);
  }
}

export const intelligenceService = new IntelligenceService();
