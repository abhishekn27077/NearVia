import { z } from "zod";
import { kycUploadUrlSchema, kycSubmitSchema, KycUploadUrlInput, KycSubmitInput } from "@nearvia/validation";

export { kycUploadUrlSchema, kycSubmitSchema };
export type { KycUploadUrlInput, KycSubmitInput };

export const verificationSubmitSchema = z.object({
  targetType: z.enum(["WORKER", "PROVIDER", "BUSINESS", "AGENT", "SKILL"]),
  verificationType: z.string().min(1).max(50),
  documentRef: z.string().max(255).optional(),
  storagePath: z.string().min(5).max(500).optional(),
}).refine((data) => Boolean(data.storagePath || data.documentRef), {
  message: "Either a document storage path or reference is required",
  path: ["storagePath"],
});

export type VerificationSubmitInput = z.infer<typeof verificationSubmitSchema>;

export interface VerificationRecord {
  id: string;
  targetType: string;
  targetId: string;
  verificationType: string;
  documentRef?: string;
  storagePath?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "RESUBMISSION_REQUIRED" | "EXPIRED";
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  notes?: string;
}
