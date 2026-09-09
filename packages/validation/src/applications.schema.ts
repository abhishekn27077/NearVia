import { z } from "zod";

export const applyWorkSchema = z
  .object({
    proposedWage: z
      .number()
      .positive("Proposed wage must be greater than 0")
      .optional(),
    workerNotes: z
      .string()
      .trim()
      .max(500, "Worker message cannot exceed 500 characters")
      .optional(),
    workerLatitude: z.number().min(-90).max(90).optional(),
    workerLongitude: z.number().min(-180).max(180).optional(),
  })
  .strict();

export const applicationDecisionSchema = z
  .object({
    decisionNotes: z
      .string()
      .trim()
      .max(500, "Decision notes cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export const withdrawApplicationSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500, "Withdrawal reason cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export type ApplyWorkInput = z.infer<typeof applyWorkSchema>;
export type ApplicationDecisionInput = z.infer<
  typeof applicationDecisionSchema
>;
export type WithdrawApplicationInput = z.infer<
  typeof withdrawApplicationSchema
>;
