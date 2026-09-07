import { z } from "zod";
import { ProviderType } from "@nearvia/types";
import { geoCoordinatesSchema } from "./geo.schema.js";

export const providerTypeSchema = z.nativeEnum(ProviderType);

export const updateProviderProfileSchema = z.object({
  providerType: providerTypeSchema.optional(),
  businessName: z
    .string()
    .max(200, "Business name cannot exceed 200 characters")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional()
    .nullable(),
  contactPhone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .nullable(),
  addressApproximate: z
    .string()
    .max(200, "Address cannot exceed 200 characters")
    .optional()
    .nullable(),
  location: geoCoordinatesSchema.optional(),
});

export const updateProviderLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180)
    .max(180, "Longitude must be between -180 and 180"),
  addressApproximate: z.string().max(200).optional().nullable(),
});

export type UpdateProviderProfileInput = z.infer<
  typeof updateProviderProfileSchema
>;
export type UpdateProviderLocationInput = z.infer<
  typeof updateProviderLocationSchema
>;
