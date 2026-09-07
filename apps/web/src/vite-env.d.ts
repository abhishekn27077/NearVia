/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_TAGLINE?: string;
  readonly VITE_DEFAULT_RADIUS_KM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
