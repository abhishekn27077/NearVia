import { z } from "zod";
import { reviewSchema as valReviewSchema } from "@nearvia/validation";

export const reviewSchema = valReviewSchema;
export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReputationStatus = "NEW" | "ESTABLISHED" | "VETERAN";

export interface TrustProfile {
  id: string;
  role: string;
  fullName: string;
  avatarUrl?: string;
  // Real rating signals (null / 0 if no reviews exist)
  averageRating: number | null;
  totalRatingsCount: number;
  hasRatingHistory: boolean;
  // Authoritative completion & reliability signals
  completedTasksCount: number;
  completedJobs: number;
  completionRate: number | null;
  reliabilityScore: number | null;
  onTimeCheckInRate?: number | null;
  reputationStatus: ReputationStatus;
  // Identity & verification
  verified: boolean;
  skills?: string[];
  memberSince: string;
}

export interface ReviewResponse {
  id: string;
  assignmentId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comments?: string;
  createdAt: string;
  reviewer?: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
  };
}
