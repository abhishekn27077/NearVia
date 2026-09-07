import { z } from "zod";

export const geoCoordinatesSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

export const searchRadiusSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z
    .number()
    .positive("Search radius must be greater than 0")
    .max(15, "Maximum allowed search radius is 15 km (default is 5 km)")
    .default(5),
});

export const discoverWorkSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusKm: z
    .number()
    .positive("Radius must be positive")
    .max(15, "Maximum allowed radius is 15 km (default 5 km)")
    .default(5)
    .optional(),
  search: z.string().trim().max(100).optional(),
  workType: z.enum(["TASK", "SHIFT", "JOB"]).optional(),
  categoryId: z.string().uuid("Invalid category ID format").optional(),
  urgency: z.enum(["NORMAL", "URGENT", "IMMEDIATE"]).optional(),
  dateFilter: z
    .enum(["ALL", "TODAY", "TOMORROW", "STARTING_SOON"])
    .default("ALL")
    .optional(),
  durationFilter: z
    .enum(["ALL", "UNDER_2H", "2_TO_4H", "HALF_DAY", "FULL_DAY"])
    .default("ALL")
    .optional(),
  minPayment: z.number().nonnegative().optional(),
  maxPayment: z.number().positive().optional(),
  sort: z
    .enum(["RECOMMENDED", "NEAREST", "STARTING_SOON", "HIGHEST_PAY"])
    .default("RECOMMENDED")
    .optional(),
  page: z.number().int().positive().default(1).optional(),
  limit: z
    .number()
    .int()
    .positive()
    .max(50, "Max 50 items per page")
    .default(20)
    .optional(),
});

export type GeoCoordinatesInput = z.infer<typeof geoCoordinatesSchema>;
export type SearchRadiusInput = z.infer<typeof searchRadiusSchema>;
export type DiscoverWorkInput = z.infer<typeof discoverWorkSchema>;
