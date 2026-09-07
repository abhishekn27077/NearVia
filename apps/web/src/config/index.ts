/**
 * Web Client Environment Configuration
 * Loads and validates frontend runtime environment variables.
 */

export const webConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  appName: import.meta.env.VITE_APP_NAME || "NEARVIA",
  tagline: import.meta.env.VITE_APP_TAGLINE || "Work Within Reach",
  defaultRadiusKm: Number(import.meta.env.VITE_DEFAULT_RADIUS_KM) || 5,
  isProduction: import.meta.env.PROD,
};
