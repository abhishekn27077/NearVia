/**
 * Messages Routes
 */

import { Router } from "express";
import { authenticateUser } from "../../middleware/auth.middleware";
import { messagesLimiter } from "../../middleware/rateLimiter";
import { messagesController } from "./controller";

const messagesRouter = Router();

// All message routes require authenticated user
messagesRouter.use(authenticateUser);

// Conversations
messagesRouter.get("/", (req, res, next) =>
  messagesController.getMyConversations(req, res, next),
);
messagesRouter.get("/conversations", (req, res, next) =>
  messagesController.getMyConversations(req, res, next),
);
messagesRouter.post("/conversations", messagesLimiter, (req, res, next) =>
  messagesController.getOrCreateConversation(req, res, next),
);
messagesRouter.get("/conversations/:id", (req, res, next) =>
  messagesController.getConversationById(req, res, next),
);

// Message Thread & Dispatch
messagesRouter.get("/conversations/:id/messages", (req, res, next) =>
  messagesController.getMessages(req, res, next),
);
messagesRouter.post("/conversations/:id/messages", messagesLimiter, (req, res, next) =>
  messagesController.sendMessage(req, res, next),
);

export { messagesRouter };
