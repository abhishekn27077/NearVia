import { z } from "zod";
import { AvailabilityStatus } from "@nearvia/types";

export const updateAvailabilitySchema = z.object({
  status: z.nativeEnum(AvailabilityStatus),
  isAvailableNow: z.boolean(),
  serviceRadiusKm: z.number().min(1).max(15).default(5),
});

export const updateWorkerProfileSchema = z.object({
  bio: z.string().max(1000, "Bio cannot exceed 1000 characters").optional(),
  experienceYears: z
    .number()
    .min(0)
    .max(50, "Experience must be between 0 and 50 years")
    .default(0),
  addressApproximate: z
    .string()
    .max(200, "Approximate address cannot exceed 200 characters")
    .optional(),
  serviceRadiusKm: z
    .number()
    .min(1)
    .max(15, "Service radius must be between 1 and 15 km")
    .default(5),
  hourlyRateEstimate: z
    .number()
    .positive("Hourly rate must be positive")
    .optional()
    .nullable(),
  dailyRateEstimate: z
    .number()
    .positive("Daily rate must be positive")
    .optional()
    .nullable(),
});

export const updateWorkerLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180)
    .max(180, "Longitude must be between -180 and 180"),
  addressApproximate: z.string().max(200).optional(),
  serviceRadiusKm: z.number().min(1).max(15).optional(),
});

export const addWorkerSkillSchema = z.object({
  skillId: z.string().uuid("Invalid Skill ID format"),
  yearsExperience: z
    .number()
    .min(0)
    .max(50, "Experience must be between 0 and 50 years")
    .default(1),
});

export const toggleAvailableNowSchema = z.object({
  isAvailableNow: z.boolean(),
  availableUntil: z
    .string()
    .datetime({
      message: "availableUntil must be a valid ISO 8601 date string",
    })
    .optional()
    .nullable(),
});

export const createAvailabilitySlotSchema = z
  .object({
    availabilityDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    startTime: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
        "Start time must be in HH:MM format",
      ),
    endTime: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
        "End time must be in HH:MM format",
      ),
    status: z
      .nativeEnum(AvailabilityStatus)
      .default(AvailabilityStatus.AVAILABLE_LATER),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be strictly after start time",
    path: ["endTime"],
  });

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type UpdateWorkerProfileInput = z.infer<
  typeof updateWorkerProfileSchema
>;
export type UpdateWorkerLocationInput = z.infer<
  typeof updateWorkerLocationSchema
>;
export type AddWorkerSkillInput = z.infer<typeof addWorkerSkillSchema>;
export type ToggleAvailableNowInput = z.infer<typeof toggleAvailableNowSchema>;
export type CreateAvailabilitySlotInput = z.infer<
  typeof createAvailabilitySlotSchema
>;
