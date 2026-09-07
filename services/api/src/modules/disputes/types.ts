/**
 * Disputes Module - Types & Contracts (Phase 15)
 */

import { z } from "zod";

export const DisputeReason = {
  WORK_NOT_COMPLETED: "WORK_NOT_COMPLETED",
  PAYMENT_DISAGREEMENT: "PAYMENT_DISAGREEMENT",
  WORK_DESCRIPTION_MISMATCH: "WORK_DESCRIPTION_MISMATCH",
  CANCELLATION_ISSUE: "CANCELLATION_ISSUE",
  ATTENDANCE_DISAGREEMENT: "ATTENDANCE_DISAGREEMENT",
  INAPPROPRIATE_BEHAVIOR: "INAPPROPRIATE_BEHAVIOR",
  OTHER: "OTHER",
} as const;

export type DisputeReason = (typeof DisputeReason)[keyof typeof DisputeReason];

export const DisputeStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
} as const;

export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const createDisputeSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment UUID"),
  reason: z.enum([
    "WORK_NOT_COMPLETED",
    "PAYMENT_DISAGREEMENT",
    "WORK_DESCRIPTION_MISMATCH",
    "CANCELLATION_ISSUE",
    "ATTENDANCE_DISAGREEMENT",
    "INAPPROPRIATE_BEHAVIOR",
    "OTHER",
  ]),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  evidenceUrls: z.array(z.string().url("Invalid evidence URL")).max(5, "Max 5 evidence attachments").optional(),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const updateDisputeStatusSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
  resolutionNotes: z.string().min(5, "Resolution notes must be at least 5 characters").max(2000),
});

export type UpdateDisputeStatusInput = z.infer<typeof updateDisputeStatusSchema>;

export interface DisputeRecord {
  id: string;
  assignmentId: string;
  initiatorId: string;
  respondentId: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls?: string[];
  status: DisputeStatus;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Enriched context
  workOpportunityId?: string;
  opportunityTitle?: string;
  workType?: string;
  agreedWage?: number;
  paymentStatus?: string;
  initiatorName?: string;
  respondentName?: string;
}

export interface IDisputesState {
  module: "disputes";
  status: "initialized";
  description: string;
}
