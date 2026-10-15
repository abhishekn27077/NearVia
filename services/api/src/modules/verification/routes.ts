import { Router } from "express";
import { verificationController } from "./controller";
import { authenticateUser } from "../../middleware/auth.middleware";

const router = Router();

// All verification routes require authentication
router.use(authenticateUser);

// Get my verifications
router.get("/me", verificationController.getMyVerifications);

// Request pre-signed upload URL for KYC document image
router.post("/upload-url", verificationController.createUploadUrl);

// Submit a new verification
router.post("/submit", verificationController.submitVerification);

export const verificationRouter = router;
