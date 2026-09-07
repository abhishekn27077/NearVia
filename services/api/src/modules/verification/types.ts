import { z } from "zod";

export const verificationSubmitSchema = z.object({
  targetType: z.enum(["WORKER", "PROVIDER", "BUSINESS", "AGENT", "SKILL"]),
  verificationType: z.string().min(1).max(50),
  documentRef: z.string().max(255).optional(),
});

export type VerificationSubmitInput = z.infer<typeof verificationSubmitSchema>;

export interface VerificationRecord {
  id: string;
  targetType: string;
  targetId: string;
  verificationType: string;
  documentRef?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  submittedAt: string;
  rejectionReason?: string;
}
