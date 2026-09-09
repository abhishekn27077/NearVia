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

export const phoneVerificationSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid international phone number format"),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid international phone number format"),
  token: z.string().min(4).max(8, "OTP token must be 4-8 digits"),
});

export const registerRequestSchema = z
  .object({
    authId: z.string().min(1, "Auth ID is required"),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format")
      .optional(),
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
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format")
      .optional(),
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
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format")
      .optional(),
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
