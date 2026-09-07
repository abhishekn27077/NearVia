import { z } from "zod";

export const checkInSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional(),
  manualFallback: z.boolean().optional(),
});

export const startWorkSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional(),
});

export const completeWorkSchema = z.object({
  completionNotes: z
    .string()
    .trim()
    .max(500, "Completion notes cannot exceed 500 characters")
    .optional(),
  hoursWorked: z
    .number()
    .positive("Hours worked must be greater than 0")
    .max(24, "Hours worked cannot exceed 24 hours")
    .optional(),
});

export const confirmCompletionSchema = z.object({
  feedback: z
    .string()
    .trim()
    .max(500, "Feedback cannot exceed 500 characters")
    .optional(),
  finalWagePaid: z
    .number()
    .positive("Final wage paid must be positive")
    .optional(),
});

export const cancelAssignmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Cancellation reason is required (min 3 chars)")
    .max(500, "Cancellation reason cannot exceed 500 characters"),
});

export const noShowSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type StartWorkInput = z.infer<typeof startWorkSchema>;
export type CompleteWorkInput = z.infer<typeof completeWorkSchema>;
export type ConfirmCompletionInput = z.infer<typeof confirmCompletionSchema>;
export type CancelAssignmentInput = z.infer<typeof cancelAssignmentSchema>;
export type NoShowInput = z.infer<typeof noShowSchema>;
