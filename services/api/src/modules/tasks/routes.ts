/**
 * Tasks Routes
 * Micro-tasks and short-duration work assignment definitions
 */

import { Router } from "express";
import { tasksController } from "./controller";

const router = Router();

router.get("/status", (req, res, next) =>
  tasksController.getStatus(req, res, next),
);

export const tasksRouter: Router = router;
