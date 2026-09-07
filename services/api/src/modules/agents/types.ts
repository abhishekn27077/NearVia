import { z } from "zod";

// ---- Agent Profile ----
export interface AgentProfileResponse {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  assignedArea: string;
  description: string | null;
  languages: string[];
  addressApproximate: string | null;
  verifiedWorkersCount: number;
  activeStatus: boolean;
  createdAt: string;
}

export const agentProfileUpdateSchema = z.object({
  assignedArea: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
  languages: z.array(z.string().max(50)).max(10).optional(),
  addressApproximate: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type AgentProfileUpdateInput = z.infer<typeof agentProfileUpdateSchema>;

// ---- Agent-Worker Relationship ----
export interface AgentWorkerRelationshipResponse {
  id: string;
  agentId: string;
  workerId: string;
  workerUserId: string;
  workerFullName: string;
  workerPhone: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  requestedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export const requestWorkerAccessSchema = z.object({
  workerPhone: z.string().min(10).max(20),
});

export type RequestWorkerAccessInput = z.infer<typeof requestWorkerAccessSchema>;

// ---- Assisted Application ----
export const assistedApplicationSchema = z.object({
  workOpportunityId: z.string().uuid(),
  proposedWage: z.number().positive().optional(),
  workerNotes: z.string().max(500).optional(),
});

export type AssistedApplicationInput = z.infer<typeof assistedApplicationSchema>;

// ---- Assisted Worker Detail ----
export interface AssistedWorkerDetail {
  workerId: string;
  workerUserId: string;
  fullName: string;
  phone: string;
  bio: string | null;
  experienceYears: number;
  addressApproximate: string | null;
  serviceRadiusKm: number;
  availabilityStatus: string;
  isAvailableNow: boolean;
  averageRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  skills: Array<{ skillId: string; skillName: string; categoryName: string; yearsExperience: number }>;
}

// ---- Legacy placeholder type (keeping for compat) ----
export interface IAgentsState {
  module: string;
  status: string;
  description: string;
}
