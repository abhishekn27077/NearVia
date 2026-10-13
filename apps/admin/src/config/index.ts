export const adminConfig = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD
      ? "https://nearvia-api.onrender.com/api/v1"
      : "http://localhost:4000/api/v1"),
  appName: "NEARVIA Admin Console",
  tagline: "Platform Operations & Oversight",
  isProduction: import.meta.env.PROD,
};
