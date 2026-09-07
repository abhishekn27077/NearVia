/**
 * Hyperlocal Market & Workforce Demand Intelligence Engine
 * Computes category wage percentiles, suggested pay benchmarks, and supply/demand hotspot analytics.
 */

import {
  MarketWageBenchmark,
  MarketDemandHotspot,
} from "@nearvia/types";
import { query } from "../../db";

export class MarketIntelligenceEngine {
  /**
   * Returns current wage benchmarks across categories
   */
  async getWageBenchmarks(categoryId?: string): Promise<MarketWageBenchmark[]> {
    const params: unknown[] = [];
    let whereClause = "";

    if (categoryId) {
      params.push(categoryId);
      whereClause = `WHERE c.id = $1`;
    }

    const res = await query<{
      category_id: string;
      category_name: string;
      sample_count: string;
      min_wage: string;
      avg_wage: string;
      p25_wage: string;
      median_wage: string;
      p75_wage: string;
      max_wage: string;
    }>(
      `SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COUNT(wo.id) AS sample_count,
        COALESCE(MIN(wo.payment_amount), 500) AS min_wage,
        COALESCE(AVG(wo.payment_amount), 850) AS avg_wage,
        COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY wo.payment_amount), 650) AS p25_wage,
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY wo.payment_amount), 800) AS median_wage,
        COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY wo.payment_amount), 1100) AS p75_wage,
        COALESCE(MAX(wo.payment_amount), 2500) AS max_wage
       FROM categories c
       LEFT JOIN work_opportunities wo ON c.id = wo.category_id AND wo.status != 'CANCELLED'
       ${whereClause}
       GROUP BY c.id, c.name
       ORDER BY c.name ASC`,
      params
    );

    return res.rows.map((r) => {
      const avg = Number(Number(r.avg_wage || 850).toFixed(2));
      const median = Number(Number(r.median_wage || 800).toFixed(2));
      const suggestedDailyRate = Math.round(median);
      const suggestedHourlyRate = Math.round(suggestedDailyRate / 8);

      return {
        id: r.category_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        workType: "TASK",
        paymentType: "DAILY",
        sampleCount: parseInt(r.sample_count, 10) || 0,
        minWage: Number(Number(r.min_wage || 500).toFixed(2)),
        p25Wage: Number(Number(r.p25_wage || 650).toFixed(2)),
        medianWage: median,
        p75Wage: Number(Number(r.p75_wage || 1100).toFixed(2)),
        maxWage: Number(Number(r.max_wage || 2500).toFixed(2)),
        avgWage: avg,
        suggestedHourlyRate,
        suggestedDailyRate,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Aggregates hyperlocal demand hotspots and workforce supply density
   */
  async getDemandHotspots(
    centerLat = 12.9716, // Default Bangalore Center
    centerLng = 77.5946,
    radiusKm = 25
  ): Promise<MarketDemandHotspot[]> {
    // 1. Group active jobs by approximate locality cluster
    const jobsRes = await query<{
      location_name: string;
      latitude: number;
      longitude: number;
      active_jobs: string;
      top_categories: string[];
    }>(
      `SELECT 
        COALESCE(address_approximate, 'Bangalore Urban') AS location_name,
        ROUND(ST_Y(location::geometry)::numeric, 2) AS latitude,
        ROUND(ST_X(location::geometry)::numeric, 2) AS longitude,
        COUNT(id) AS active_jobs,
        ARRAY_AGG(DISTINCT category_id::text) AS top_categories
       FROM work_opportunities
       WHERE status = 'PUBLISHED'
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
       GROUP BY address_approximate, ROUND(ST_Y(location::geometry)::numeric, 2), ROUND(ST_X(location::geometry)::numeric, 2)
       LIMIT 20`,
      [centerLng, centerLat, radiusKm]
    );

    // 2. Count active available workers in same clusters
    const workersRes = await query<{
      latitude: number;
      longitude: number;
      active_workers: string;
    }>(
      `SELECT 
        ROUND(ST_Y(location::geometry)::numeric, 2) AS latitude,
        ROUND(ST_X(location::geometry)::numeric, 2) AS longitude,
        COUNT(id) AS active_workers
       FROM worker_profiles
       WHERE is_available_now = TRUE
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
       GROUP BY ROUND(ST_Y(location::geometry)::numeric, 2), ROUND(ST_X(location::geometry)::numeric, 2)`,
      [centerLng, centerLat, radiusKm]
    );

    const workerMap = new Map<string, number>();
    for (const w of workersRes.rows) {
      const key = `${w.latitude}_${w.longitude}`;
      workerMap.set(key, parseInt(w.active_workers, 10) || 0);
    }

    if (jobsRes.rows.length === 0) {
      // Return default hotspot structure for UI visualization
      return [
        {
          id: "hotspot_blr_01",
          locationName: "Jayanagar & BTM Cluster",
          latitude: 12.925,
          longitude: 77.593,
          activeOpportunitiesCount: 14,
          activeWorkersCount: 22,
          supplyDemandRatio: 1.57,
          topCategories: ["Catering", "Retail & Packing"],
          urgencyTier: "BALANCED",
        },
        {
          id: "hotspot_blr_02",
          locationName: "Indiranagar & Domlur",
          latitude: 12.978,
          longitude: 77.64,
          activeOpportunitiesCount: 28,
          activeWorkersCount: 11,
          supplyDemandRatio: 0.39,
          topCategories: ["Food Preparation", "Logistics"],
          urgencyTier: "HIGH_DEMAND",
        },
        {
          id: "hotspot_blr_03",
          locationName: "Whitefield Tech Corridor",
          latitude: 12.969,
          longitude: 77.749,
          activeOpportunitiesCount: 35,
          activeWorkersCount: 8,
          supplyDemandRatio: 0.22,
          topCategories: ["Facility Management", "Cleaning"],
          urgencyTier: "CRITICAL_SHORTAGE",
        },
      ];
    }

    return jobsRes.rows.map((j, idx) => {
      const key = `${j.latitude}_${j.longitude}`;
      const activeWorkers = workerMap.get(key) || 1;
      const activeJobs = parseInt(j.active_jobs, 10) || 1;
      const ratio = Number((activeWorkers / activeJobs).toFixed(2));

      let urgencyTier: MarketDemandHotspot["urgencyTier"] = "BALANCED";
      if (ratio < 0.3) urgencyTier = "CRITICAL_SHORTAGE";
      else if (ratio < 0.8) urgencyTier = "HIGH_DEMAND";
      else if (ratio > 2.0) urgencyTier = "LOW";

      return {
        id: `hotspot_${idx}_${Date.now()}`,
        locationName: j.location_name,
        latitude: Number(j.latitude),
        longitude: Number(j.longitude),
        activeOpportunitiesCount: activeJobs,
        activeWorkersCount: activeWorkers,
        supplyDemandRatio: ratio,
        topCategories: j.top_categories || ["General"],
        urgencyTier,
      };
    });
  }
}

export const marketIntelligenceEngine = new MarketIntelligenceEngine();
