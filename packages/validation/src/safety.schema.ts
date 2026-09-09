import { z } from "zod";

export const REPORT_CATEGORIES = [
  "FRAUD",
  "HARASSMENT",
  "UNSAFE_WORK",
  "MISLEADING_INFORMATION",
  "PAYMENT_PROBLEM",
  "NO_SHOW",
  "ABUSIVE_BEHAVIOR",
  "INAPPROPRIATE_CONTENT",
  "OTHER",
] as const;

export const REPORT_TARGET_TYPES = [
  "USER",
  "WORK_OPPORTUNITY",
  "ASSIGNMENT",
  "REVIEW",
] as const;

export const DISPUTE_REASONS = [
  "WORK_NOT_COMPLETED",
  "PAYMENT_DISAGREEMENT",
  "WORK_DESCRIPTION_MISMATCH",
  "CANCELLATION_ISSUE",
  "ATTENDANCE_DISAGREEMENT",
  "INAPPROPRIATE_BEHAVIOR",
  "OTHER",
] as const;

export const submitReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().uuid("Invalid target UUID"),
  category: z.enum(REPORT_CATEGORIES),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(100),
  description: z.string().max(2000, "Description cannot exceed 2000 characters").optional(),
  evidenceUrls: z
    .array(z.string().url("Invalid evidence URL"))
    .max(5, "Maximum 5 evidence attachments allowed")
    .optional(),
});

export type SubmitReportInput = z.infer<typeof submitReportSchema>;

export const updateReportStatusSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
  resolution: z.string().min(5, "Resolution notes must be at least 5 characters").max(2000),
});

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;

export const createDisputeSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment UUID"),
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  evidenceUrls: z
    .array(z.string().url("Invalid evidence URL"))
    .max(5, "Maximum 5 evidence attachments allowed")
    .optional(),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const updateDisputeStatusSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
  resolutionNotes: z.string().min(5, "Resolution notes must be at least 5 characters").max(2000),
});

export type UpdateDisputeStatusInput = z.infer<typeof updateDisputeStatusSchema>;
