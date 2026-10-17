import { z } from "zod";
import { UserRole } from "@nearvia/types";

export const userRoleSchema = z.nativeEnum(UserRole);

// Publicly selectable roles for self-registration (ADMIN is strictly prohibited)
export const publicUserRoleSchema = z.enum(
  [UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT],
  {
    errorMap: () => ({
      message:
        "Role must be WORKER, PROVIDER, or AGENT. ADMIN cannot be self-selected.",
    }),
  },
);

/**
 * Validates international and Indian phone formats:
 * - 10-digit Indian mobile numbers starting with 6, 7, 8, or 9 (e.g. 9876543210)
 * - Indian E.164 format (+91 followed by 10 digits starting with 6-9, e.g. +919876543210)
 * - Standard international E.164 format (+ followed by 7 to 15 digits)
 */
export const strictPhoneSchema = z
  .string()
  .trim()
  .refine(
    (val) =>
      /^[6-9]\d{9}$/.test(val) ||
      /^\+91[6-9]\d{9}$/.test(val) ||
      /^\+[1-9]\d{7,14}$/.test(val),
    {
      message:
        "Please enter a valid 10-digit mobile number (e.g. 9876543210) or international format (+919876543210)",
    },
  );

/**
 * Optional phone number schema.
 * Allows undefined, null, or empty string. If provided, strictly validates format.
 */
export const optionalPhoneSchema = z
  .union([strictPhoneSchema, z.literal("")])
  .optional()
  .transform((val) => (val && val.length > 0 ? val : undefined));

export const phoneVerificationSchema = z.object({
  phone: strictPhoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: strictPhoneSchema,
  token: z.string().min(4).max(8, "OTP token must be 4-8 digits"),
});

export const registerRequestSchema = z
  .object({
    authId: z.string().min(1, "Auth ID is required"),
    phone: optionalPhoneSchema,
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(120),
    email: z.string().email("Invalid email address").optional(),
    role: publicUserRoleSchema, // Strictly requires WORKER, PROVIDER, or AGENT
    avatarUrl: z.string().url("Invalid avatar URL").optional(),
  })
  .strict();

export const signupRequestSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(120, "Full name too long"),
    phone: optionalPhoneSchema,
    role: publicUserRoleSchema, // Strictly WORKER, PROVIDER, AGENT only (ADMIN rejected)
  })
  .strict();

export const loginRequestSchema = z
  .object({
    emailOrPhone: z.string().min(3, "Email or Phone is required").optional(),
    email: z.string().email("Invalid email address").optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
  })
  .refine((data) => !!(data.email || data.emailOrPhone), {
    message: "Email or phone is required",
    path: ["emailOrPhone"],
  });

export const syncGoogleProfileSchema = z
  .object({
    authId: z.string().optional(),
    email: z.string().email("Invalid email address").optional(),
    fullName: z.string().min(1).max(120).optional(),
    avatarUrl: z.string().url("Invalid avatar URL").optional(),
    phone: optionalPhoneSchema,
    role: publicUserRoleSchema.optional(), // Default WORKER, strictly WORKER, PROVIDER, AGENT only
  })
  .strict();

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Full name cannot be empty")
      .max(120, "Full name too long")
      .optional(),
    phone: optionalPhoneSchema,
    language: z.string().min(2).max(10).optional(),
    locationText: z.string().max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict();

export const verifyIdentitySchema = z.object({
  type: z.enum(["AADHAAR", "PAN", "DRIVING_LICENSE", "OTHER"]).optional(),
  reference: z.string().min(4).max(100).optional(),
  documentUrl: z.string().url("Invalid document URL").optional(),
});

export const confirmEmailSchema = z
  .object({
    email: z.string().email("Invalid email address"),
  })
  .strict();

export const resendVerificationEmailSchema = z
  .object({
    email: z.string().email("Invalid email address"),
  })
  .strict();

export const kycUploadUrlSchema = z
  .object({
    targetType: z.enum(["WORKER", "PROVIDER", "BUSINESS", "AGENT", "SKILL"]).optional().default("WORKER"),
    fileType: z.string().min(1),
    fileName: z.string().min(1).max(255),
    fileSizeBytes: z
      .number()
      .positive("File size must be positive")
      .max(5 * 1024 * 1024, "File size must not exceed 5MB")
      .optional(),
    fileSize: z
      .number()
      .positive("File size must be positive")
      .max(5 * 1024 * 1024, "File size must not exceed 5MB")
      .optional(),
  })
  .refine((data) => data.fileSizeBytes !== undefined || data.fileSize !== undefined, {
    message: "File size is required",
    path: ["fileSizeBytes"],
  });

export const kycSubmitSchema = z
  .object({
    targetType: z.enum(["WORKER", "PROVIDER", "BUSINESS", "AGENT", "SKILL"]),
    verificationType: z.string().min(1).max(50),
    storagePath: z
      .string()
      .min(5)
      .max(500)
      .regex(/^kyc\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/, "Invalid KYC storage path structure")
      .optional(),
    documentRef: z.string().max(255).optional(),
  })
  .refine((data) => Boolean(data.storagePath || data.documentRef), {
    message: "Either a document storage path or reference is required",
    path: ["storagePath"],
  });

export const requestResubmissionSchema = z
  .object({
    reason: z
      .string()
      .min(5, "Resubmission instructions must be at least 5 characters")
      .max(500)
      .optional(),
    instructions: z
      .string()
      .min(5, "Resubmission instructions must be at least 5 characters")
      .max(500)
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.reason && data.reason.trim().length >= 5) ||
        (data.instructions && data.instructions.trim().length >= 5),
      ),
    {
      message: "Resubmission instructions/reason must be at least 5 characters",
      path: ["reason"],
    },
  )
  .transform((data) => ({
    reason: (data.reason || data.instructions)!.trim(),
    instructions: (data.instructions || data.reason)!.trim(),
  }));

export type UserRoleInput = z.infer<typeof userRoleSchema>;
export type PublicUserRoleInput = z.infer<typeof publicUserRoleSchema>;
export type PhoneVerificationInput = z.infer<typeof phoneVerificationSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type SignupRequestInput = z.infer<typeof signupRequestSchema>;
export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type SyncGoogleProfileInput = z.infer<typeof syncGoogleProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type VerifyIdentityInput = z.infer<typeof verifyIdentitySchema>;
export type ConfirmEmailInput = z.infer<typeof confirmEmailSchema>;
export type ResendVerificationEmailInput = z.infer<typeof resendVerificationEmailSchema>;
export type KycUploadUrlInput = z.infer<typeof kycUploadUrlSchema>;
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;
export type RequestResubmissionInput = z.infer<typeof requestResubmissionSchema>;
