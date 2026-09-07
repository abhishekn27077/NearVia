/**
 * Availability Module - Types & Contracts
 */

import { AvailabilityStatus, GeoCoordinates } from "@nearvia/types";

export interface WorkerAvailabilityState {
  workerId: string;
  userId: string;
  isAvailableNow: boolean;
  availabilityStatus: AvailabilityStatus;
  availableUntil: string | null;
  serviceRadiusKm: number;
  location: GeoCoordinates;
  addressApproximate: string | null;
  preferredJobTypes: string[];
  preferredCategories: string[];
  preferredSkills: string[];
  lastUpdated: string;
}

export interface ToggleAvailabilityPayload {
  isAvailableNow: boolean;
  availableUntil?: string;
  serviceRadiusKm?: number;
  preferredJobTypes?: string[];
  preferredCategories?: string[];
  preferredSkills?: string[];
  latitude?: number;
  longitude?: number;
}
