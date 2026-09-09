/**
 * System Constants for NEARVIA
 */

export const NEARVIA_CONFIG = {
  APP_NAME: "NEARVIA",
  TAGLINE: "Work Within Reach",
  VERSION: "0.1.0",
  DEFAULT_API_PORT: 4000,
  DEFAULT_WEB_PORT: 3000,
  API_PREFIX: "/api/v1",

  // Hyperlocal Search Defaults
  HYPERLOCAL: {
    DEFAULT_RADIUS_KM: 5,
    MAX_RADIUS_KM: 15,
    MIN_RADIUS_KM: 1,
    EARTH_RADIUS_KM: 6371,
  },

  // Pagination Defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Matching Weights (Deterministic Multi-Factor Scoring)
  MATCHING_WEIGHTS: {
    SKILL_COMPATIBILITY: 0.35,
    AVAILABILITY_FIT: 0.25,
    DISTANCE_PROXIMITY: 0.2,
    DURATION_PREFERENCE: 0.1,
    CATEGORY_PREFERENCE: 0.05,
    URGENCY_RELEVANCE: 0.05,
  },

  // Work Execution & Attendance Defaults (Phase 10, Phase 12)
  WORK_EXECUTION: {
    CHECK_IN_WINDOW_BEFORE_MINUTES: 120, // Can check in up to 2 hours before scheduled start
    CHECK_IN_WINDOW_AFTER_MINUTES: 240, // Can check in up to 4 hours after scheduled start
    MAX_CHECK_IN_PROXIMITY_METERS: 1000, // 1 km allowed check-in radius around workplace
    MAX_CHECK_OUT_PROXIMITY_METERS: 1500, // 1.5 km allowed check-out radius around workplace
    MAX_JOB_PIN_ATTEMPTS: 5, // Maximum failed Job PIN attempts before lockout
    NO_SHOW_GRACE_PERIOD_MINUTES: 30, // Can only be marked NO_SHOW 30 min after start time
  },

  // Progressive Phone OTP Configuration (Phase 4D)
  OTP: {
    DEFAULT_PROVIDER: "mock" as const,
    EXPIRY_MINUTES: 10,
    MAX_ATTEMPTS: 3,
    RESEND_COOLDOWN_SECONDS: 60,
    MAX_RESENDS_PER_WINDOW: 4,
    RATE_LIMIT_WINDOW_MINUTES: 10,
    MOCK_OTP_CODE: "123456",
  },

  // Phase 5 Real-Time Marketplace & Workforce Radar
  WORKFORCE_RADAR: {
    DEFAULT_CLUSTER_RADIUS_KM: 2.0,
    PRIVACY_MASK_MIN_COUNT: 1,
    MAX_SEARCH_RADIUS_KM: 20,
  },

  RELIABILITY: {
    MIN_TASKS_FOR_SCORE: 3,
    NO_SHOW_PENALTY_MULTIPLIER: 2.0,
    CANCELLATION_PENALTY_MULTIPLIER: 1.0,
  },

  // Operational Feature Flags & Kill-Switches (Phase 12)
  FEATURE_FLAGS: {
    ONLINE_PAYMENTS_ENABLED: false, // Default false for pilot (physical cash direct settlement)
    AI_ASSISTANT_ENABLED: true,     // Emergency kill switch
    RECOMMENDATIONS_ENABLED: true,  // Algorithmic matching kill switch
    INSTANT_JOBS_ENABLED: true,     // Instant broadcast kill switch
    VOICE_FEATURES_ENABLED: true,   // Web Speech / voice kill switch
    NOTIFICATIONS_ENABLED: true,    // Push/SMS notification kill switch
  },
} as const;
