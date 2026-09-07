/**
 * Location Routes
 * Hyperlocal spatial queries, PostGIS integration, and proximity calculations
 */

import { Router } from "express";
import { locationController } from "./controller";

const router = Router();

router.get("/status", (req, res, next) =>
  locationController.getStatus(req, res, next),
);

export const locationRouter: Router = router;
