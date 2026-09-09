/**
 * Availability Module - Types & Contracts
 */

import { AvailabilityStatus, GeoCoordinates } from "@nearvia/types";

export interface WorkerAvailabilityState {
  available: boolean;
  status: "ONLINE" | "OFFLINE";
  isAvailableNow: boolean;
  availabilityStatus: AvailabilityStatus;
  isFresh: boolean;
  availableUntil: string | null;
  serviceRadiusKm: number;
  location?: GeoCoordinates;
  addressApproximate: string | null;
  preferredJobTypes: string[];
  preferredCategories: string[];
  preferredSkills: string[];
  updatedAt: string;
  lastUpdated: string;
  workerId: string;
  userId: string;
}

export interface GoOnlinePayload {
  availableHours?: number;
  availableUntil?: string;
  serviceRadiusKm?: number;
  latitude?: number;
  longitude?: number;
  preferredJobTypes?: string[];
  preferredCategories?: string[];
  preferredSkills?: string[];
}

export interface GoOfflinePayload {}

export interface ToggleAvailabilityPayload {
  isAvailableNow: boolean;
  availableHours?: number;
  availableUntil?: string;
  serviceRadiusKm?: number;
  preferredJobTypes?: string[];
  preferredCategories?: string[];
  preferredSkills?: string[];
  latitude?: number;
  longitude?: number;
}
