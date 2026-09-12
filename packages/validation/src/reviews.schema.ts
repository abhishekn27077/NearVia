import { z } from "zod";

export const reviewSchema = z.object({
  rating: z
    .number()
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  comments: z
    .string()
    .max(1000, "Review comments cannot exceed 1000 characters")
    .optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
