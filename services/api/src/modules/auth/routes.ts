/**
 * Auth Module Routes
 * /api/v1/auth/*
 */

import { Router } from "express";
import {
  signupRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  updateProfileSchema,
  confirmEmailSchema,
  resendVerificationEmailSchema,
  syncGoogleProfileSchema,
  verifyIdentitySchema,
} from "@nearvia/validation";
import { validateRequest, authenticateUser, authLimiter, otpLimiter } from "../../middleware";
import { authController } from "./controller";

const router = Router();

// Direct Unified Sign Up (Creates Supabase Auth + Application User)
router.post(
  "/signup",
  authLimiter,
  validateRequest(signupRequestSchema),
  (req, res, next) => authController.signUp(req, res, next),
);

// Unified Email/Password Login
router.post(
  "/login",
  authLimiter,
  validateRequest(loginRequestSchema),
  (req, res, next) => authController.login(req, res, next),
);

// Resend Supabase Email Verification Link (Rate-limited)
router.post(
  "/resend-verification-email",
  authLimiter,
  validateRequest(resendVerificationEmailSchema),
  (req, res, next) => authController.resendVerificationEmail(req, res, next),
);

// Auto-confirm email if unconfirmed (Non-production demo only)
router.post(
  "/confirm-email",
  authLimiter,
  validateRequest(confirmEmailSchema),
  (req, res, next) => authController.confirmEmail(req, res, next),
);

// Public User Registration (Synchronizes Supabase account with NEARVIA application user)
router.post(
  "/register",
  authLimiter,
  validateRequest(registerRequestSchema),
  (req, res, next) => authController.register(req, res, next),
);

// Synchronize Google OAuth user with local database profile
router.post(
  "/sync-google-profile",
  authLimiter,
  validateRequest(syncGoogleProfileSchema),
  (req, res, next) => authController.syncGoogleProfile(req, res, next),
);

// Protected: Get current authenticated user profile
router.get("/me", authenticateUser, (req, res, next) =>
  authController.getMe(req, res, next),
);

// Protected: Send OTP for progressive phone verification
router.post("/send-otp", authenticateUser, otpLimiter, (req, res, next) =>
  authController.sendOtp(req, res, next),
);

// Protected: Verify OTP code
router.post("/verify-otp", authenticateUser, otpLimiter, (req, res, next) =>
  authController.verifyOtp(req, res, next),
);

// Protected: Resend OTP code with cooldown
router.post("/resend-otp", authenticateUser, otpLimiter, (req, res, next) =>
  authController.resendOtp(req, res, next),
);

// Protected: Verify mobile (backward compatibility)
router.post("/verify-mobile", authenticateUser, otpLimiter, (req, res, next) =>
  authController.verifyMobile(req, res, next),
);

// Protected: Verify identity (Demo KYC)
router.post(
  "/verify-identity",
  authenticateUser,
  validateRequest(verifyIdentitySchema),
  (req, res, next) => authController.verifyIdentity(req, res, next),
);

// Protected: Update profile (Strictly rejects non-whitelisted / privileged fields)
router.put(
  "/profile",
  authenticateUser,
  validateRequest(updateProfileSchema),
  (req, res, next) => authController.updateProfile(req, res, next),
);

// Protected: Logout acknowledgment
router.post("/logout", authenticateUser, (req, res, next) =>
  authController.logout(req, res, next),
);

export const authRouter: Router = router;
