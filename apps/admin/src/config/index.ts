export const adminConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  appName: "NEARVIA Admin Console",
  tagline: "Platform Operations & Oversight",
  isProduction: import.meta.env.PROD,
};
