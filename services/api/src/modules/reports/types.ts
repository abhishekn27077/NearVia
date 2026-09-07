import { z } from "zod";

export const ReportCategory = {
  FRAUD: "FRAUD",
  HARASSMENT: "HARASSMENT",
  UNSAFE_WORK: "UNSAFE_WORK",
  MISLEADING_INFORMATION: "MISLEADING_INFORMATION",
  PAYMENT_PROBLEM: "PAYMENT_PROBLEM",
  NO_SHOW: "NO_SHOW",
  ABUSIVE_BEHAVIOR: "ABUSIVE_BEHAVIOR",
  INAPPROPRIATE_CONTENT: "INAPPROPRIATE_CONTENT",
  OTHER: "OTHER",
} as const;

export type ReportCategory = (typeof ReportCategory)[keyof typeof ReportCategory];

export const ReportTargetType = {
  USER: "USER",
  WORK_OPPORTUNITY: "WORK_OPPORTUNITY",
  ASSIGNMENT: "ASSIGNMENT",
  REVIEW: "REVIEW",
} as const;

export type ReportTargetType = (typeof ReportTargetType)[keyof typeof ReportTargetType];

export const ReportStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;

export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const submitReportSchema = z.object({
  targetType: z.enum(["USER", "WORK_OPPORTUNITY", "ASSIGNMENT", "REVIEW"]),
  targetId: z.string().uuid("Invalid target UUID"),
  category: z.enum([
    "FRAUD",
    "HARASSMENT",
    "UNSAFE_WORK",
    "MISLEADING_INFORMATION",
    "PAYMENT_PROBLEM",
    "NO_SHOW",
    "ABUSIVE_BEHAVIOR",
    "INAPPROPRIATE_CONTENT",
    "OTHER",
  ]),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(100),
  description: z.string().max(2000, "Description cannot exceed 2000 characters").optional(),
  evidenceUrls: z.array(z.string().url("Invalid evidence URL")).max(5, "Max 5 evidence attachments").optional(),
});

export type SubmitReportInput = z.infer<typeof submitReportSchema>;

export const updateReportStatusSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
  resolution: z.string().min(5, "Resolution notes must be at least 5 characters").max(2000),
});

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  category?: string;
  reason: string;
  description?: string;
  evidenceUrls?: string[];
  status: ReportStatus;
  reviewedBy?: string | null;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
  targetSummary?: Record<string, any>;
}
