import { z } from "zod";
import {
  WorkType,
  UrgencyLevel,
  PaymentType,
  WorkOpportunityStatus,
} from "@nearvia/types";
import { geoCoordinatesSchema } from "./geo.schema.js";

export const workTypeSchema = z.nativeEnum(WorkType);
export const urgencyLevelSchema = z.nativeEnum(UrgencyLevel);
export const paymentTypeSchema = z.nativeEnum(PaymentType);
export const workOpportunityStatusSchema = z.nativeEnum(WorkOpportunityStatus);

export const requiredSkillItemSchema = z.object({
  skillId: z.string().min(1, "Skill ID is required"),
  isRequired: z.boolean().default(true),
  minExperienceYears: z.number().min(0).default(0),
});

export const createWorkOpportunitySchema = z
  .object({
    workType: workTypeSchema,
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(150, "Title cannot exceed 150 characters"),
    categoryId: z.string().min(1, "Category is required"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(3000, "Description cannot exceed 3000 characters"),
    urgency: urgencyLevelSchema.default(UrgencyLevel.NORMAL),
    workersNeeded: z
      .number()
      .int()
      .min(1, "At least 1 worker is required")
      .max(100, "Cannot exceed 100 workers")
      .default(1),
    location: geoCoordinatesSchema,
    addressApproximate: z.string().min(3, "Address is required").max(200),
    workDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Work date must be in YYYY-MM-DD format"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    durationHours: z
      .number()
      .positive("Duration must be greater than 0")
      .max(24, "Single work duration cannot exceed 24 hours"),
    paymentAmount: z.number().positive("Payment amount must be greater than 0"),
    paymentType: paymentTypeSchema,
    currency: z.string().length(3).default("INR"),
    minExperienceYears: z.number().min(0).default(0),
    responsibilities: z.string().max(2000).optional().nullable(),
    instructions: z.string().max(2000).optional().nullable(),
    toolsProvided: z.boolean().default(false),
    orientationProvided: z.boolean().default(false),
    skills: z.array(requiredSkillItemSchema).optional().default([]),
    status: workOpportunityStatusSchema
      .optional()
      .default(WorkOpportunityStatus.DRAFT),
  })
  .refine(
    (data) => {
      // If ISO strings, compare timestamps; if simple HH:mm strings on same day, compare lexical
      if (data.startTime.includes("T") && data.endTime.includes("T")) {
        return (
          new Date(data.endTime).getTime() > new Date(data.startTime).getTime()
        );
      }
      return data.endTime > data.startTime;
    },
    {
      message: "End time must be strictly after start time",
      path: ["endTime"],
    },
  );

export const updateWorkOpportunitySchema = z
  .object({
    workType: workTypeSchema.optional(),
    title: z.string().min(3).max(150).optional(),
    categoryId: z.string().min(1).optional(),
    description: z.string().min(10).max(3000).optional(),
    urgency: urgencyLevelSchema.optional(),
    workersNeeded: z.number().int().min(1).max(100).optional(),
    location: geoCoordinatesSchema.optional(),
    addressApproximate: z.string().min(3).max(200).optional(),
    workDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional(),
    durationHours: z.number().positive().max(24).optional(),
    paymentAmount: z.number().positive().optional(),
    paymentType: paymentTypeSchema.optional(),
    currency: z.string().length(3).optional(),
    minExperienceYears: z.number().min(0).optional(),
    responsibilities: z.string().max(2000).optional().nullable(),
    instructions: z.string().max(2000).optional().nullable(),
    toolsProvided: z.boolean().optional(),
    orientationProvided: z.boolean().optional(),
    skills: z.array(requiredSkillItemSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        if (data.startTime.includes("T") && data.endTime.includes("T")) {
          return (
            new Date(data.endTime).getTime() >
            new Date(data.startTime).getTime()
          );
        }
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: "End time must be strictly after start time",
      path: ["endTime"],
    },
  );

export type RequiredSkillItemInput = z.infer<typeof requiredSkillItemSchema>;
export type CreateWorkOpportunityInput = z.infer<
  typeof createWorkOpportunitySchema
>;
export type UpdateWorkOpportunityInput = z.infer<
  typeof updateWorkOpportunitySchema
>;
