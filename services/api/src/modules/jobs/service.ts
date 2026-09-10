/**
 * Unified Work Opportunities Domain Service (TASK / SHIFT / JOB)
 * Handles Work Opportunity Creation, Skill Associations, PostGIS Spatial Storage,
 * Draft/Preview/Publish Lifecycle, and Provider Ownership Isolation.
 */

import {
  WorkOpportunityDetail,
  WorkOpportunitySkillDetail,
  WorkOpportunityStatus,
  WorkType,
  UrgencyLevel,
  PaymentType,
  ProviderType,
  Category,
  DiscoverySummaryResponse,
  DiscoverySummaryCategoryStat,
} from "@nearvia/types";
import {
  CreateWorkOpportunityInput,
  UpdateWorkOpportunityInput,
} from "@nearvia/validation";
import { ErrorCode, NEARVIA_CONFIG } from "@nearvia/config";
import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { providersService } from "../providers/service";
import { notificationsService } from "../notifications/service";

interface DbWorkOppRow {
  id: string;
  provider_id: string;
  category_id: string;
  title: string;
  description: string;
  work_type: WorkType;
  urgency: UrgencyLevel;
  status: WorkOpportunityStatus;
  workers_needed: number;
  workers_assigned: number;
  latitude: number;
  longitude: number;
  address_approximate: string;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_hours: string | number;
  payment_amount: string | number;
  payment_type: PaymentType;
  currency: string;
  min_experience_years: string | number;
  responsibilities: string | null;
  instructions: string | null;
  tools_provided: boolean;
  orientation_provided: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  category_name?: string;
  category_slug?: string;
  category_icon?: string;
  provider_full_name?: string;
  provider_type?: ProviderType;
  business_name?: string;
  contact_phone?: string;
  average_rating?: string | number;
  verified_business?: boolean;
  schedule_type?: string;
  recurring_pattern?: string;
  recurring_days?: string[];
  is_instant?: boolean;
}

export const SEED_CATEGORIES: Category[] = [
  {
    id: "a0000001-0000-0000-0000-000000000001",
    name: "Restaurant & Hospitality",
    slug: "restaurant-hospitality",
    description: "Kitchen helper, server, dishwashing, catering assistant",
    icon: "utensils",
    displayOrder: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000002",
    name: "Retail & Shop Assistance",
    slug: "retail-shop-assistance",
    description: "Store helper, inventory arrangement, billing counter assist",
    icon: "store",
    displayOrder: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000003",
    name: "Warehouse & Logistics",
    slug: "warehouse-logistics",
    description: "Loading/unloading trucks, packaging, stock sorting",
    icon: "package",
    displayOrder: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000004",
    name: "Events & Setup",
    slug: "events-setup",
    description:
      "Venue decoration setup, chairs/tables arrangement, registration",
    icon: "calendar-check",
    displayOrder: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000005",
    name: "Cleaning & Housekeeping",
    slug: "cleaning-housekeeping",
    description: "Commercial cleaning, floor sanitization, post-event cleanup",
    icon: "sparkles",
    displayOrder: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000006",
    name: "Delivery & Courier",
    slug: "delivery-courier",
    description: "Local parcel pickup/dropoff, document transport",
    icon: "truck",
    displayOrder: 6,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000007",
    name: "Skilled Local Trades",
    slug: "skilled-trades",
    description: "Electrician helper, plumbing repair, carpentry, painting",
    icon: "wrench",
    displayOrder: 7,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000008",
    name: "Office & Admin Support",
    slug: "office-admin",
    description: "Document scanning, filing, data entry, front desk relief",
    icon: "file-text",
    displayOrder: 8,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000009",
    name: "Construction & Labor",
    slug: "construction-labor",
    description: "Site cleanup, material carrying, digging, masonry helper",
    icon: "hammer",
    displayOrder: 9,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000001-0000-0000-0000-000000000010",
    name: "Local Community Services",
    slug: "community-services",
    description: "Elderly assistance, flyer distribution, queue management",
    icon: "users",
    displayOrder: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class WorkOpportunitiesService {
  /**
   * Retrieves live discovery summary statistics (counts, wage range, category breakdown)
   * within a specific geographic center and radius.
   */
  public async getDiscoverySummary(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
  ): Promise<DiscoverySummaryResponse> {
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new AppError(
        "Latitude must be a valid number between -90 and 90 degrees.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError(
        "Longitude must be a valid number between -180 and 180 degrees.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (isNaN(radiusKm) || radiusKm < 0.5 || radiusKm > NEARVIA_CONFIG.HYPERLOCAL.MAX_RADIUS_KM) {
      throw new AppError(
        `Search radius must be between 0.5 km and ${NEARVIA_CONFIG.HYPERLOCAL.MAX_RADIUS_KM} km.`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const radiusMeters = radiusKm * 1000;
    try {
      const sql = `
        SELECT 
          c.id AS category_id,
          c.name AS category_name,
          c.slug AS category_slug,
          c.icon AS category_icon,
          COUNT(wo.id) AS count,
          COALESCE(MIN(wo.payment_amount), 0) AS min_payment,
          COALESCE(MAX(wo.payment_amount), 0) AS max_payment
        FROM categories c
        LEFT JOIN work_opportunities wo 
          ON wo.category_id = c.id 
          AND wo.status = 'PUBLISHED' 
          AND wo.work_date >= CURRENT_DATE 
          AND ST_DWithin(wo.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.name, c.slug, c.icon, c.display_order
        ORDER BY c.display_order ASC, c.name ASC
      `;

      const result = await query<{
        category_id: string;
        category_name: string;
        category_slug: string;
        category_icon: string | null;
        count: string;
        min_payment: string;
        max_payment: string;
      }>(sql, [longitude, latitude, radiusMeters]);

      let totalOpportunities = 0;
      let overallMinPayment = 0;
      let overallMaxPayment = 0;
      const categoryStats: DiscoverySummaryCategoryStat[] = [];

      for (const row of result.rows) {
        const count = parseInt(row.count || "0", 10);
        const minPay = Number(row.min_payment || 0);
        const maxPay = Number(row.max_payment || 0);
        totalOpportunities += count;

        if (count > 0) {
          if (overallMinPayment === 0 || (minPay > 0 && minPay < overallMinPayment)) {
            overallMinPayment = minPay;
          }
          if (maxPay > overallMaxPayment) {
            overallMaxPayment = maxPay;
          }
        }

        categoryStats.push({
          categoryId: row.category_id,
          categoryName: row.category_name,
          categorySlug: row.category_slug,
          categoryIcon: row.category_icon || undefined,
          count,
          minPayment: minPay,
          maxPayment: maxPay,
        });
      }

      const activeCategoriesCount = categoryStats.filter((c) => c.count > 0).length;

      return {
        totalOpportunities,
        activeCategoriesCount,
        minPayment: overallMinPayment || 500,
        maxPayment: overallMaxPayment || 1200,
        searchCenter: { latitude, longitude },
        radiusKm,
        categoryStats,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to fetch discovery summary: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Retrieves all active platform work categories.
   */
  public async getAllCategories(): Promise<Category[]> {
    const sql = `
      SELECT id, name, slug, description, icon, display_order AS "displayOrder", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM categories
      WHERE is_active = TRUE
      ORDER BY display_order ASC, name ASC
    `;
    const result = await query<Category>(sql);
    return result.rows;
  }

  /**
   * Get all work opportunities posted by the authenticated provider.
   */
  public async getProviderWorkOpportunities(
    providerUserId: string,
    statusFilter?: WorkOpportunityStatus,
  ): Promise<WorkOpportunityDetail[]> {
    const providerId =
      await providersService.getOrCreateProviderProfile(providerUserId);

    const conditions: string[] = ["wo.provider_id = $1"];
    const params: unknown[] = [providerId];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`wo.status = $${params.length}`);
    }

    const sql = `
      SELECT 
        wo.id,
        wo.provider_id,
        wo.category_id,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.status,
        wo.workers_needed,
        wo.workers_assigned,
        ST_Y(wo.location::geometry) AS latitude,
        ST_X(wo.location::geometry) AS longitude,
        wo.address_approximate,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.payment_amount,
        wo.payment_type,
        wo.currency,
        wo.min_experience_years,
        wo.responsibilities,
        wo.instructions,
        wo.tools_provided,
        wo.orientation_provided,
        wo.created_at,
        wo.updated_at,
        wo.published_at,
        wo.completed_at,
        wo.cancelled_at,
        c.name AS category_name,
        c.slug AS category_slug,
        c.icon AS category_icon,
        u.full_name AS provider_full_name,
        pp.provider_type,
        pp.business_name,
        pp.contact_phone,
        pp.average_rating,
        pp.verified_business,
        wo.schedule_type,
        wo.recurring_pattern,
        wo.recurring_days,
        wo.is_instant
      FROM work_opportunities wo
      JOIN categories c ON wo.category_id = c.id
      JOIN provider_profiles pp ON wo.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY wo.created_at DESC
    `;

    const result = await query<DbWorkOppRow>(sql, params);

    // Map rows and attach skills
    const opportunities: WorkOpportunityDetail[] = [];
    for (const row of result.rows) {
      const skills = await this.getWorkOpportunitySkills(row.id);
      opportunities.push(this.formatOpportunityDetail(row, skills));
    }

    return opportunities;
  }

  /**
   * Creates a new Work Opportunity (defaults to DRAFT or PUBLISHED).
   */
  public async createWorkOpportunity(
    providerUserId: string,
    input: CreateWorkOpportunityInput,
  ): Promise<WorkOpportunityDetail> {
    const providerId =
      await providersService.getOrCreateProviderProfile(providerUserId);

    try {
      // 1. Verify category exists
      const catCheck = await query<{ id: string; name: string }>(
        "SELECT id, name FROM categories WHERE id = $1 AND is_active = TRUE",
        [input.categoryId],
      );
      if (
        catCheck.rows.length === 0 &&
        !SEED_CATEGORIES.some((c) => c.id === input.categoryId)
      ) {
        throw new AppError(
          "Invalid category ID.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const status = input.status || WorkOpportunityStatus.DRAFT;
      const publishedAt =
        status === WorkOpportunityStatus.PUBLISHED
          ? new Date().toISOString()
          : null;

      const insertSql = `
        INSERT INTO work_opportunities (
          provider_id, category_id, title, description, work_type, urgency, status,
          workers_needed, location, address_approximate, work_date, start_time, end_time,
          duration_hours, payment_amount, payment_type, currency, min_experience_years,
          responsibilities, instructions, tools_provided, orientation_provided, published_at,
          schedule_type, recurring_pattern, recurring_days, is_instant
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27, $28
        )
        RETURNING id
      `;

      const formatTimestamp = (dateStr: string, timeStr: string): string => {
        if (timeStr.includes("T") || timeStr.includes("-")) return timeStr;
        const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
        return `${dateStr}T${normalizedTime}Z`;
      };

      const params = [
        providerId,
        input.categoryId,
        input.title,
        input.description,
        input.workType,
        input.urgency || UrgencyLevel.NORMAL,
        status,
        input.workersNeeded || 1,
        input.location?.longitude ?? (input as any).longitude ?? 77.6408,
        input.location?.latitude ?? (input as any).latitude ?? 12.9784,
        input.addressApproximate,
        input.workDate,
        formatTimestamp(input.workDate, input.startTime),
        formatTimestamp(input.workDate, input.endTime),
        input.durationHours,
        input.paymentAmount,
        input.paymentType,
        input.currency || "INR",
        input.minExperienceYears || 0,
        input.responsibilities || null,
        input.instructions || null,
        input.toolsProvided || false,
        input.orientationProvided || false,
        publishedAt,
        (input as any).scheduleType || "ONE_TIME",
        (input as any).recurringPattern || null,
        (input as any).recurringDays || null,
        Boolean((input as any).isInstant),
      ];

      const result = await query<{ id: string }>(insertSql, params);
      const newId = result.rows[0]?.id;

      if (!newId) {
        throw new AppError(
          "Failed to create work opportunity.",
          500,
          ErrorCode.INTERNAL_SERVER_ERROR,
        );
      }

      // 2. Attach skills
      if (input.skills && input.skills.length > 0) {
        for (const skill of input.skills) {
          await query(
            `INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required, min_experience_years)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (work_opportunity_id, skill_id) DO UPDATE SET
               is_required = EXCLUDED.is_required,
               min_experience_years = EXCLUDED.min_experience_years`,
            [
              newId,
              skill.skillId,
              skill.isRequired ?? true,
              skill.minExperienceYears ?? 0,
            ],
          );
        }
      }

      // 3. Increment provider posted_jobs_count
      await query(
        "UPDATE provider_profiles SET posted_jobs_count = posted_jobs_count + 1 WHERE id = $1",
        [providerId],
      );

      return this.getWorkOpportunityById(newId, providerUserId);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to create work opportunity: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Fetch single Work Opportunity by ID with security isolation for drafts.
   */
  public async getWorkOpportunityById(
    opportunityId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
  ): Promise<WorkOpportunityDetail> {
    const sql = `
      SELECT 
        wo.id,
        wo.provider_id,
        wo.category_id,
        wo.title,
        wo.description,
        wo.work_type,
        wo.urgency,
        wo.status,
        wo.workers_needed,
        wo.workers_assigned,
        ST_Y(wo.location::geometry) AS latitude,
        ST_X(wo.location::geometry) AS longitude,
        wo.address_approximate,
        wo.work_date,
        wo.start_time,
        wo.end_time,
        wo.duration_hours,
        wo.payment_amount,
        wo.payment_type,
        wo.currency,
        wo.min_experience_years,
        wo.responsibilities,
        wo.instructions,
        wo.tools_provided,
        wo.orientation_provided,
        wo.created_at,
        wo.updated_at,
        wo.published_at,
        wo.completed_at,
        wo.cancelled_at,
        c.name AS category_name,
        c.slug AS category_slug,
        c.icon AS category_icon,
        u.id AS provider_user_id,
        u.full_name AS provider_full_name,
        pp.provider_type,
        pp.business_name,
        pp.contact_phone,
        pp.average_rating,
        pp.verified_business,
        wo.schedule_type,
        wo.recurring_pattern,
        wo.recurring_days,
        wo.is_instant
      FROM work_opportunities wo
      JOIN categories c ON wo.category_id = c.id
      JOIN provider_profiles pp ON wo.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE wo.id = $1
    `;

    const result = await query<DbWorkOppRow & { provider_user_id: string }>(
      sql,
      [opportunityId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new AppError(
        "Work opportunity not found.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    // Security Isolation for DRAFT opportunities
    if (row.status === WorkOpportunityStatus.DRAFT) {
      const isOwner =
        requestingUserId && row.provider_user_id === requestingUserId;
      const isAdmin = requestingUserRole === "ADMIN";
      if (!isOwner && !isAdmin) {
        throw new AppError(
          "Unpublished draft opportunities cannot be viewed.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const skills = await this.getWorkOpportunitySkills(row.id);
    return this.formatOpportunityDetail(row, skills);
  }

  /**
   * Updates an existing Work Opportunity (only permitted for DRAFT opportunities owned by provider).
   */
  public async updateWorkOpportunity(
    opportunityId: string,
    providerUserId: string,
    input: UpdateWorkOpportunityInput,
  ): Promise<WorkOpportunityDetail> {
    const existing = await this.getWorkOpportunityById(
      opportunityId,
      providerUserId,
    );

    const providerId =
      await providersService.getOrCreateProviderProfile(providerUserId);
    if (existing.providerId !== providerId) {
      throw new AppError(
        "You do not own this work opportunity.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    if (existing.status !== WorkOpportunityStatus.DRAFT) {
      throw new AppError(
        "Only opportunities in DRAFT status can be modified.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    try {
      const updateFields: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [opportunityId];

      if (input.title !== undefined) {
        params.push(input.title);
        updateFields.push(`title = $${params.length}`);
      }
      if (input.description !== undefined) {
        params.push(input.description);
        updateFields.push(`description = $${params.length}`);
      }
      if (input.workType !== undefined) {
        params.push(input.workType);
        updateFields.push(`work_type = $${params.length}`);
      }
      if (input.urgency !== undefined) {
        params.push(input.urgency);
        updateFields.push(`urgency = $${params.length}`);
      }
      if (input.categoryId !== undefined) {
        params.push(input.categoryId);
        updateFields.push(`category_id = $${params.length}`);
      }
      if (input.workersNeeded !== undefined) {
        params.push(input.workersNeeded);
        updateFields.push(`workers_needed = $${params.length}`);
      }
      if (input.addressApproximate !== undefined) {
        params.push(input.addressApproximate);
        updateFields.push(`address_approximate = $${params.length}`);
      }
      if (input.location !== undefined) {
        params.push(input.location.longitude);
        const lngIdx = params.length;
        params.push(input.location.latitude);
        const latIdx = params.length;
        updateFields.push(
          `location = ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography`,
        );
      }
      if (input.workDate !== undefined) {
        params.push(input.workDate);
        updateFields.push(`work_date = $${params.length}`);
      }
      if (input.startTime !== undefined) {
        params.push(input.startTime);
        updateFields.push(`start_time = $${params.length}`);
      }
      if (input.endTime !== undefined) {
        params.push(input.endTime);
        updateFields.push(`end_time = $${params.length}`);
      }
      if (input.durationHours !== undefined) {
        params.push(input.durationHours);
        updateFields.push(`duration_hours = $${params.length}`);
      }
      if (input.paymentAmount !== undefined) {
        params.push(input.paymentAmount);
        updateFields.push(`payment_amount = $${params.length}`);
      }
      if (input.paymentType !== undefined) {
        params.push(input.paymentType);
        updateFields.push(`payment_type = $${params.length}`);
      }
      if (input.responsibilities !== undefined) {
        params.push(input.responsibilities);
        updateFields.push(`responsibilities = $${params.length}`);
      }
      if (input.instructions !== undefined) {
        params.push(input.instructions);
        updateFields.push(`instructions = $${params.length}`);
      }
      if (input.toolsProvided !== undefined) {
        params.push(input.toolsProvided);
        updateFields.push(`tools_provided = $${params.length}`);
      }
      if (input.orientationProvided !== undefined) {
        params.push(input.orientationProvided);
        updateFields.push(`orientation_provided = $${params.length}`);
      }

      const sql = `UPDATE work_opportunities SET ${updateFields.join(", ")} WHERE id = $1 AND status = 'DRAFT'`;
      const updateResult = await query(sql, params);
      if (updateResult.rowCount === 0) {
        throw new AppError(
          "Only opportunities in DRAFT status can be modified.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      // Update skills if provided
      if (input.skills !== undefined) {
        await query(
          "DELETE FROM work_opportunity_skills WHERE work_opportunity_id = $1",
          [opportunityId],
        );
        for (const skill of input.skills) {
          await query(
            `INSERT INTO work_opportunity_skills (work_opportunity_id, skill_id, is_required, min_experience_years)
             VALUES ($1, $2, $3, $4)`,
            [
              opportunityId,
              skill.skillId,
              skill.isRequired ?? true,
              skill.minExperienceYears ?? 0,
            ],
          );
        }
      }

      return this.getWorkOpportunityById(opportunityId, providerUserId);
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to update work opportunity: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Transitions a DRAFT opportunity to PUBLISHED.
   */
  public async publishWorkOpportunity(
    opportunityId: string,
    providerUserId: string,
  ): Promise<WorkOpportunityDetail> {
    const opp = await this.getWorkOpportunityById(
      opportunityId,
      providerUserId,
    );

    const providerId =
      await providersService.getOrCreateProviderProfile(providerUserId);
    if (opp.providerId !== providerId) {
      throw new AppError(
        "You do not own this work opportunity.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    if (opp.status !== WorkOpportunityStatus.DRAFT) {
      throw new AppError(
        `Cannot publish opportunity currently in ${opp.status} status.`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Comprehensive field validation before publishing
    if (!opp.title || opp.title.trim().length < 3) {
      throw new AppError(
        "A valid title (at least 3 characters) is required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (!opp.description || opp.description.trim().length < 10) {
      throw new AppError(
        "A valid description (at least 10 characters) is required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (!opp.categoryId) {
      throw new AppError(
        "A valid category is required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (!opp.paymentAmount || opp.paymentAmount <= 0) {
      throw new AppError(
        "A positive payment amount is required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (!opp.workersNeeded || opp.workersNeeded < 1) {
      throw new AppError(
        "At least 1 worker is required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (
      !opp.location ||
      typeof opp.location.latitude !== "number" ||
      typeof opp.location.longitude !== "number" ||
      opp.location.latitude < -90 ||
      opp.location.latitude > 90 ||
      opp.location.longitude < -180 ||
      opp.location.longitude > 180
    ) {
      throw new AppError(
        "Valid location coordinates are required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    if (!opp.workDate) {
      throw new AppError(
        "Work date is required to publish.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    const todayStr = new Date().toISOString().split("T")[0] ?? "";
    if (opp.workDate < todayStr) {
      throw new AppError(
        "Cannot publish a work opportunity with a past date.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const sql = `
      UPDATE work_opportunities
      SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'DRAFT'
    `;
    const pubResult = await query(sql, [opportunityId]);
    if (pubResult.rowCount === 0) {
      throw new AppError(
        `Cannot publish opportunity currently in ${opp.status} status.`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    return this.getWorkOpportunityById(opportunityId, providerUserId);
  }

  /**
   * Cancels a work opportunity owned by the provider.
   */
  public async cancelWorkOpportunity(
    opportunityId: string,
    providerUserId: string,
  ): Promise<WorkOpportunityDetail> {
    const opp = await this.getWorkOpportunityById(
      opportunityId,
      providerUserId,
    );

    const providerId =
      await providersService.getOrCreateProviderProfile(providerUserId);
    if (opp.providerId !== providerId) {
      throw new AppError(
        "You do not own this work opportunity.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    if (
      opp.status === WorkOpportunityStatus.COMPLETED ||
      opp.status === WorkOpportunityStatus.CANCELLED ||
      opp.status === WorkOpportunityStatus.SETTLEMENT_PENDING ||
      opp.status === WorkOpportunityStatus.PAID
    ) {
      throw new AppError(
        `Opportunity cannot be cancelled in ${opp.status.toLowerCase()} status.`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check if there are active or completed assignments (on-site work already underway)
    const activeAssignmentsRes = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM assignments 
       WHERE work_opportunity_id = $1 
         AND status IN ('CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'SETTLEMENT_PENDING')`,
      [opportunityId],
    );

    if (parseInt(activeAssignmentsRes.rows[0]?.count || "0", 10) > 0) {
      throw new AppError(
        "Cannot cancel work opportunity with active or completed work in progress. Please resolve ongoing assignments or initiate a dispute.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const cancelledWorkersToNotify: string[] = [];

    await withTransaction(async (client) => {
      // 1. Update work opportunity atomically
      const cancelRes = await client.query(
        `UPDATE work_opportunities
         SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('COMPLETED', 'SETTLEMENT_PENDING', 'PAID', 'CANCELLED')`,
        [opportunityId],
      );

      if (cancelRes.rowCount === 0) {
        throw new AppError(
          "Opportunity cannot be cancelled from its current state.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      // 2. Cancel un-started assignments (ASSIGNED, CONFIRMED)
      const cancelledAsns = await client.query<{ id: string; worker_id: string }>(
        `UPDATE assignments
         SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $2,
             cancellation_reason = 'Work opportunity cancelled by employer', updated_at = NOW()
         WHERE work_opportunity_id = $1 AND status IN ('ASSIGNED', 'CONFIRMED')
         RETURNING id, worker_id`,
        [opportunityId, providerUserId],
      );

      for (const asn of cancelledAsns.rows) {
        const wRes = await client.query<{ user_id: string }>(
          "SELECT user_id FROM worker_profiles WHERE id = $1",
          [asn.worker_id],
        );
        if (wRes.rows[0]?.user_id) {
          cancelledWorkersToNotify.push(wRes.rows[0].user_id);
        }
      }

      // 3. Mark pending and shortlisted applications as rejected
      await client.query(
        `UPDATE applications
         SET status = 'REJECTED', decision_notes = 'Work opportunity cancelled by employer',
             responded_at = NOW(), updated_at = NOW()
         WHERE work_opportunity_id = $1 AND status IN ('PENDING', 'SHORTLISTED')`,
        [opportunityId],
      );
    });

    // Notify cancelled assignment workers asynchronously
    for (const workerUserId of cancelledWorkersToNotify) {
      notificationsService
        .createNotification(
          workerUserId,
          "ASSIGNMENT_CANCELLED",
          `Shift Cancelled: ${opp.title}`,
          `The employer cancelled '${opp.title}'. Your schedule has been freed up.`,
          { workOpportunityId: opportunityId },
        )
        .catch(() => {});
    }

    return this.getWorkOpportunityById(opportunityId, providerUserId);
  }

  /**
   * Helper to fetch skill associations for an opportunity.
   */
  private async getWorkOpportunitySkills(
    opportunityId: string,
  ): Promise<WorkOpportunitySkillDetail[]> {
    try {
      const sql = `
        SELECT 
          wos.skill_id AS "skillId",
          s.name AS "skillName",
          s.category_id AS "categoryId",
          c.name AS "categoryName",
          wos.is_required AS "isRequired",
          wos.min_experience_years AS "minExperienceYears"
        FROM work_opportunity_skills wos
        JOIN skills s ON wos.skill_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE wos.work_opportunity_id = $1
      `;

      const result = await query<{
        skillId: string;
        skillName: string;
        categoryId: string;
        categoryName: string;
        isRequired: boolean;
        minExperienceYears: string | number;
      }>(sql, [opportunityId]);

      return result.rows.map((row) => ({
        skillId: row.skillId,
        skillName: row.skillName,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        isRequired: row.isRequired,
        minExperienceYears: Number(row.minExperienceYears) || 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Format database row into typed WorkOpportunityDetail object.
   */
  private formatOpportunityDetail(
    row: DbWorkOppRow,
    skills: WorkOpportunitySkillDetail[],
  ): WorkOpportunityDetail {
    return {
      id: row.id,
      providerId: row.provider_id,
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      workType: row.work_type,
      urgency: row.urgency,
      status: row.status,
      workersNeeded: Number(row.workers_needed) || 1,
      workersAssigned: Number(row.workers_assigned) || 0,
      location: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      },
      addressApproximate: row.address_approximate,
      workDate: row.work_date,
      startTime: row.start_time,
      endTime: row.end_time,
      durationHours: Number(row.duration_hours),
      paymentAmount: Number(row.payment_amount),
      paymentType: row.payment_type,
      currency: row.currency || "INR",
      minExperienceYears: Number(row.min_experience_years) || 0,
      responsibilities: row.responsibilities ?? undefined,
      instructions: row.instructions ?? undefined,
      toolsProvided: row.tools_provided,
      orientationProvided: row.orientation_provided,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      cancelledAt: row.cancelled_at ?? undefined,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      categoryIcon: row.category_icon,
      providerName: row.provider_full_name,
      providerType: row.provider_type,
      businessName: row.business_name,
      contactPhone: row.contact_phone,
      providerRating: Number(row.average_rating) || 5.0,
      providerVerified: row.verified_business,
      skills,
      scheduleType: (row as any).schedule_type || "ONE_TIME",
      recurringPattern: (row as any).recurring_pattern || undefined,
      recurringDays: (row as any).recurring_days || undefined,
      isInstant: Boolean((row as any).is_instant),
    };
  }

  /**
   * Phase 5: Create Instant Job ("Need Someone Now")
   * Starts in 30-45 mins, automatically published, notifies nearby available workers.
   */
  public async createInstantJob(
    providerUserId: string,
    payload: {
      categoryId: string;
      title: string;
      description: string;
      paymentAmount: number;
      paymentType: PaymentType;
      durationHours: number;
      addressApproximate: string;
      latitude?: number;
      longitude?: number;
      skillIds?: string[];
    },
  ): Promise<{ opportunity: WorkOpportunityDetail; notifiedWorkersCount: number }> {
    // Calculate immediate start time (+45 minutes from now)
    const now = new Date();
    const startTimeDate = new Date(now.getTime() + 45 * 60 * 1000);
    const durationHours = payload.durationHours || 2;
    const endTimeDate = new Date(startTimeDate.getTime() + durationHours * 60 * 60 * 1000);
    const workDate = startTimeDate.toISOString().split("T")[0];

    // Fallback coordinates if not provided
    let lat = payload.latitude;
    let lng = payload.longitude;
    if (!lat || !lng) {
      const pRes = await query<{ latitude: number; longitude: number }>(
        `SELECT ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude
         FROM provider_profiles WHERE user_id = $1`,
        [providerUserId],
      );
      lat = Number(pRes.rows[0]?.latitude) || 12.9716;
      lng = Number(pRes.rows[0]?.longitude) || 77.5946;
    }

    const createdOpp = await this.createWorkOpportunity(providerUserId, {
      categoryId: payload.categoryId,
      title: payload.title || "Instant Work Request",
      description: payload.description || "Immediate job required starting within 45 minutes.",
      workType: WorkType.TASK,
      urgency: UrgencyLevel.IMMEDIATE,
      status: WorkOpportunityStatus.PUBLISHED,
      workersNeeded: 1,
      paymentAmount: payload.paymentAmount,
      paymentType: payload.paymentType || PaymentType.FIXED,
      durationHours,
      workDate,
      startTime: startTimeDate.toISOString(),
      endTime: endTimeDate.toISOString(),
      addressApproximate: payload.addressApproximate || "Nearby Location",
      location: { latitude: lat, longitude: lng },
      skills: (payload.skillIds || []).map((id) => ({ skillId: id, isRequired: true })),
      scheduleType: "ONE_TIME",
      isInstant: true,
    } as any);

    // Fast-match & Notify online available workers within 5km radius
    const nearbyOnlineWorkersRes = await query<{ user_id: string }>(
      `SELECT wp.user_id
       FROM worker_profiles wp
       WHERE wp.is_available_now = TRUE
         AND (wp.available_until IS NULL OR wp.available_until > NOW())
         AND ST_DWithin(
           wp.location,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           5000
         )`,
      [lng, lat],
    );

    let notifiedCount = 0;
    for (const worker of nearbyOnlineWorkersRes.rows) {
      await query(
        `INSERT INTO notifications (recipient_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          worker.user_id,
          "INSTANT_JOB_ALERT",
          "⚡ Instant Job Alert Nearby!",
          `New instant job "${payload.title}" starting in 45m near you (₹${payload.paymentAmount}).`,
          JSON.stringify({ opportunityId: createdOpp.id, isInstant: true }),
        ],
      ).catch(() => {});
      notifiedCount++;
    }

    return {
      opportunity: createdOpp,
      notifiedWorkersCount: notifiedCount,
    };
  }
}

export const workOpportunitiesService = new WorkOpportunitiesService();
