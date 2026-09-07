/**
 * NEARVIA Offline Resilience & Shift Caching Utility
 * Caches active shift details, workplace landmark, and check-in token in browser storage
 * for zero-loss operation when mobile data or cell network drops in transit.
 */

export interface OfflineShiftCache {
  assignmentId: string;
  jobTitle: string;
  providerName: string;
  providerPhone?: string;
  addressApproximate: string;
  exactAddress?: string;
  latitude: number;
  longitude: number;
  workDate: string;
  startTime: string;
  endTime: string;
  paymentAmount: number;
  paymentType: string;
  checkInCode?: string;
  status: string;
  cachedAt: string;
}

const SHIFT_CACHE_KEY = "nearvia_offline_active_shift";
const GPS_CACHE_KEY = "nearvia_user_gps";

export const saveActiveShiftToCache = (shift: OfflineShiftCache): void => {
  try {
    localStorage.setItem(SHIFT_CACHE_KEY, JSON.stringify(shift));
  } catch {
    // Storage full or unavailable
  }
};

export const getCachedActiveShift = (): OfflineShiftCache | null => {
  try {
    const raw = localStorage.getItem(SHIFT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearActiveShiftCache = (): void => {
  try {
    localStorage.removeItem(SHIFT_CACHE_KEY);
  } catch {
    //
  }
};

export const saveUserGpsToCache = (lat: number, lng: number): void => {
  try {
    localStorage.setItem(GPS_CACHE_KEY, JSON.stringify({ lat, lng, savedAt: Date.now() }));
  } catch {
    //
  }
};

export const getCachedUserGps = (): { lat: number; lng: number } | null => {
  try {
    const raw = localStorage.getItem(GPS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache valid for 2 hours
    if (Date.now() - (parsed.savedAt || 0) < 2 * 60 * 60 * 1000) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
    return null;
  } catch {
    return null;
  }
};
