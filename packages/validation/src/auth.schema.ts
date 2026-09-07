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

export const registerRequestSchema = z.object({
  authId: z.string().min(1, "Auth ID is required"),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format"),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(120),
  email: z.string().email("Invalid email address").optional(),
  role: publicUserRoleSchema, // Strictly requires WORKER, PROVIDER, or AGENT
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
});

export const loginRequestSchema = z.object({
  emailOrPhone: z.string().min(3, "Email or Phone is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type UserRoleInput = z.infer<typeof userRoleSchema>;
export type PublicUserRoleInput = z.infer<typeof publicUserRoleSchema>;
export type PhoneVerificationInput = z.infer<typeof phoneVerificationSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
