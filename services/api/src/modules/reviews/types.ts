import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(1000).optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export interface TrustProfile {
  id: string;
  role: string;
  fullName: string;
  averageRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  verified: boolean;
  avatarUrl?: string;
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
