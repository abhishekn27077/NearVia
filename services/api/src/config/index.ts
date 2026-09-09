import dotenv from "dotenv";
import { z } from "zod";
import { NEARVIA_CONFIG } from "@nearvia/config";

// Load environment variables from .env file
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z
      .string()
      .transform(Number)
      .default(String(NEARVIA_CONFIG.DEFAULT_API_PORT)),
    API_HOST: z.string().default("localhost"),
    CORS_ORIGIN: z.string().default("*"),
    DATABASE_URL: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    MAP_DEFAULT_RADIUS_KM: z
      .string()
      .transform(Number)
      .default(String(NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM)),
    OTP_PROVIDER: z.enum(["mock", "msg91"]).default("mock"),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    MSG91_SENDER_ID: z.string().optional(),
    MSG91_API_URL: z.string().default("https://control.msg91.com/api/v5/otp"),
    ALLOW_MOCK_OTP_IN_PRODUCTION: z.string().optional(),
    PAYMENT_MODE: z.enum(["demo", "sandbox", "production"]).default("demo"),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    AI_PROVIDER: z.enum(["mock", "gemini", "openai"]).default("mock"),
    GEMINI_API_KEY: z.string().optional(),
    REDIS_URL: z.string().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.DATABASE_URL || data.DATABASE_URL.includes("placeholder")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "DATABASE_URL must be a valid PostgreSQL connection string in production.",
        });
      }
      if (!data.SUPABASE_URL || data.SUPABASE_URL.includes("placeholder")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SUPABASE_URL"],
          message: "SUPABASE_URL must be configured in production.",
        });
      }
      if (data.PAYMENT_MODE === "demo") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PAYMENT_MODE"],
          message: "PAYMENT_MODE cannot be set to 'demo' in a production environment.",
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables configuration:",
    parsedEnv.error.format(),
  );
  throw new Error("Environment configuration validation failed");
}

export const env = parsedEnv.data;
export type EnvironmentConfig = z.infer<typeof envSchema>;
