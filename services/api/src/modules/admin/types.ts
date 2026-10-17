/**
 * Admin Module - Types & Contracts (Phase 16)
 */

import { z } from "zod";
import { UserRole } from "@nearvia/types";

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(["WORKER", "PROVIDER", "AGENT", "ADMIN"]),
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const approveVerificationSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type ApproveVerificationInput = z.infer<typeof approveVerificationSchema>;

export const rejectVerificationSchema = z.object({
  rejectionReason: z.string().min(5, "Rejection reason must be at least 5 characters").max(500),
  notes: z.string().max(500).optional(),
});

export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;

export const requestResubmissionSchema = z.object({
  reason: z.string().min(5, "Resubmission instructions must be at least 5 characters").max(500).optional(),
  instructions: z.string().min(5, "Resubmission instructions must be at least 5 characters").max(500).optional(),
  notes: z.string().max(500).optional(),
}).refine((data) => Boolean((data.reason && data.reason.trim().length >= 5) || (data.instructions && data.instructions.trim().length >= 5)), {
  message: "Resubmission instructions/reason must be at least 5 characters",
  path: ["reason"],
}).transform((data) => ({
  reason: (data.reason || data.instructions)!.trim(),
  instructions: (data.instructions || data.reason)!.trim(),
  notes: data.notes,
}));

export type RequestResubmissionInput = z.infer<typeof requestResubmissionSchema>;

export const moderateWorkSchema = z.object({
  reason: z.string().min(5, "Moderation reason must be at least 5 characters").max(500),
});

export type ModerateWorkInput = z.infer<typeof moderateWorkSchema>;

export interface AdminDashboardMetrics {
  totalUsers: number;
  totalWorkers: number;
  totalProviders: number;
  totalAgents: number;
  totalAdmins: number;
  publishedWorkCount: number;
  cumulativePublishedCount: number;
  completedWorkCount: number;
  cancelledWorkCount: number;
  totalApplicationsCount: number;
  activeAssignmentsCount: number;
  completedAssignmentsCount: number;
  pendingVerificationsCount: number;
  openReportsCount: number;
  openDisputesCount: number;
  confirmedPaymentsVolumePaise: number;
  confirmedPaymentsVolume: number;
  cashSettledVolume: number;
  sandboxSettledVolume: number;
  pendingPaymentsCount: number;
  recentAuditLogs: any[];
}

export interface AdminUserListItem {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  workerProfile?: any;
  providerProfile?: any;
  agentProfile?: any;
  verifications?: any[];
  assignedCount?: number;
  completedCount?: number;
}

export interface IAdminState {
  module: "admin";
  status: "initialized";
  description: string;
}
