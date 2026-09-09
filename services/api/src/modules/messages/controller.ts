import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { messagesService } from "./service";
import { UserRole } from "@nearvia/types";

const createConversationSchema = z.object({
  workOpportunityId: z.string().uuid("Invalid workOpportunityId format"),
  workerUserId: z.string().uuid("Invalid workerUserId format").optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content cannot be empty").max(2000, "Message exceeds 2000 characters"),
});

export class MessagesController {
  public async getOrCreateConversation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role as UserRole;
      const parsed = createConversationSchema.parse(req.body);

      const conversation = await messagesService.getOrCreateConversation(
        userId,
        userRole,
        parsed.workOpportunityId,
        parsed.workerUserId,
      );

      res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getMyConversations(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role as UserRole;

      const conversations = await messagesService.getMyConversations(
        userId,
        userRole,
      );

      res.status(200).json({
        success: true,
        data: conversations,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getConversationById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const convId = z.string().uuid("Invalid conversation ID format").parse(req.params.id);

      const conversation = await messagesService.getConversationById(userId, convId);

      res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getMessages(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const convId = z.string().uuid("Invalid conversation ID format").parse(req.params.id);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

      const messages = await messagesService.getMessages(userId, convId, limit, offset);

      res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (err) {
      next(err);
    }
  }

  public async sendMessage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const convId = z.string().uuid("Invalid conversation ID format").parse(req.params.id);
      const { content } = sendMessageSchema.parse(req.body);

      const message = await messagesService.sendMessage(userId, convId, content);

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const messagesController = new MessagesController();
