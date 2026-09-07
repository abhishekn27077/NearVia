/**
 * Users Routes
 * User profile management, role verification, and account settings
 */

import { Router } from "express";
import { usersController } from "./controller";

const router = Router();

router.get("/status", (req, res, next) =>
  usersController.getStatus(req, res, next),
);

export const usersRouter: Router = router;
