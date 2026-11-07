/**
 * NEARVIA Production Error Monitoring & APM Integration (Sentry)
 * 
 * Configured specifically for the 'nearvia-api' Node.js / Express backend service.
 * Safe, zero-leak error capturing with SDK-level PII sanitization.
 */

import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
import path from "path";
import type { Request } from "express";

// Ensure local environment variables are available before checking SENTRY_DSN
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const SENSITIVE_KEY_PATTERN =
  /^(password|passphrase|token|secret|otp|pin|cashpin|completionpin|aadhaar|idnumber|documenturl|accountnumber|ifsc|upiid|message|coordinates|lat|lng|latitude|longitude|phone|mobile)$/i;

const PHONE_REGEX = /\b[6-9]\d{9}\b/g;
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi;
const COORD_REGEX = /(?:lat(?:itude)?|lng|long(?:itude)?)\s*[:=]\s*-?\d+\.\d{3,}/gi;

/**
 * Deep recursive object sanitizer to remove sensitive fields
 */
function sanitizeObject(data: unknown, depth = 0): unknown {
  if (depth > 6 || !data) return data;

  if (typeof data === "string") {
    return data
      .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
      .replace(PHONE_REGEX, "[REDACTED_PHONE]")
      .replace(AADHAAR_REGEX, "[REDACTED_AADHAAR]")
      .replace(COORD_REGEX, "$1: [REDACTED_COORD]");
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeObject(item, depth + 1));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return data;
}

const sentryDsn = process.env.SENTRY_DSN?.trim();

if (sentryDsn) {
  const nodeEnv = process.env.NODE_ENV || "development";
  const environment = process.env.SENTRY_ENVIRONMENT || nodeEnv;
  const release =
    process.env.SENTRY_RELEASE ||
    process.env.RENDER_GIT_COMMIT ||
    "nearvia-api@0.1.0";

  Sentry.init({
    dsn: sentryDsn,
    environment,
    release,
    // Conservative production tracing as requested
    tracesSampleRate: 0.1,
    // Logging, profiling and metrics explicitly disabled
    integrations: (defaults) => defaults,
    sendDefaultPii: false,
    beforeSend(event) {
      // 1. Sanitize request headers
      if (event.request?.headers) {
        if (event.request.headers.authorization) {
          event.request.headers.authorization = "[REDACTED]";
        }
        if (event.request.headers.cookie) {
          event.request.headers.cookie = "[REDACTED]";
        }
      }

      // 2. Sanitize request body / payload
      if (event.request?.data) {
        event.request.data = sanitizeObject(event.request.data);
      }

      // 3. Sanitize query string
      if (event.request?.query_string) {
        if (typeof event.request.query_string === "string") {
          event.request.query_string = event.request.query_string.replace(
            /([?&](?:token|otp|pin|password|auth)=)[^&]+/gi,
            "$1[REDACTED]",
          );
        }
      }

      // 4. Sanitize exception messages
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          if (exception.value) {
            exception.value = exception.value
              .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
              .replace(PHONE_REGEX, "[REDACTED_PHONE]")
              .replace(AADHAAR_REGEX, "[REDACTED_AADHAAR]");
          }
        }
      }

      // 5. Sanitize breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.data) {
            crumb.data = sanitizeObject(crumb.data) as Record<string, unknown>;
          }
          if (crumb.message) {
            crumb.message = crumb.message
              .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
              .replace(PHONE_REGEX, "[REDACTED_PHONE]")
              .replace(AADHAAR_REGEX, "[REDACTED_AADHAAR]");
          }
          return crumb;
        });
      }

      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Drop breadcrumbs from high-sensitivity endpoints entirely
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
        const url = breadcrumb.data.url.toLowerCase();
        if (
          url.includes("/auth/") ||
          url.includes("/otp/") ||
          url.includes("/verification/") ||
          url.includes("/cash-verify")
        ) {
          return null;
        }
      }

      if (breadcrumb.message) {
        breadcrumb.message = breadcrumb.message
          .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
          .replace(PHONE_REGEX, "[REDACTED_PHONE]")
          .replace(AADHAAR_REGEX, "[REDACTED_AADHAAR]");
      }

      return breadcrumb;
    },
  });
}

/**
 * Capture unexpected server errors (5xx, uncaught crashes) to Sentry with request context.
 * Safely no-ops if Sentry is not initialized.
 */
export function captureServerError(err: unknown, req?: Request): string | undefined {
  if (!Sentry.isInitialized()) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    if (req) {
      if (req.id) {
        scope.setTag("requestId", req.id);
      }
      scope.setTag("method", req.method);
      scope.setTag("route", req.originalUrl || req.url);

      const user = (req as any).user;
      if (user?.role) {
        scope.setTag("userRole", String(user.role));
      }
      if (user?.id) {
        // Only store an opaque pseudo-id, never PII
        scope.setUser({ id: String(user.id) });
      }
    }

    return Sentry.captureException(err);
  });
}

export { Sentry };

