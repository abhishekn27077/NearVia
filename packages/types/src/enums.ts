/**
 * NEARVIA Official Domain Enums
 * Authoritative type definitions for state machines, roles, and lifecycles.
 */

export enum UserRole {
  WORKER = "WORKER",
  PROVIDER = "PROVIDER",
  AGENT = "AGENT",
  ADMIN = "ADMIN",
}

export enum WorkType {
  TASK = "TASK", // Micro-task: 1-2 hours (e.g. unload delivery crates, shift boxes)
  SHIFT = "SHIFT", // Short shift: 3-6 hours (e.g. restaurant helper, cashier relief)
  JOB = "JOB", // Full-day / multi-day engagement (e.g. store assistant, skilled trade)
}

export enum UrgencyLevel {
  NORMAL = "NORMAL",
  URGENT = "URGENT",
  IMMEDIATE = "IMMEDIATE",
}

export enum PaymentType {
  HOURLY = "HOURLY",
  FIXED = "FIXED",
  DAILY = "DAILY",
}

export enum ProviderType {
  INDIVIDUAL = "INDIVIDUAL",
  BUSINESS = "BUSINESS",
}

export enum WorkOpportunityStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  MATCHING = "MATCHING",
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  FILLED = "FILLED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum ApplicationStatus {
  PENDING = "PENDING",
  SHORTLISTED = "SHORTLISTED",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
  EXPIRED = "EXPIRED",
}

export enum AssignmentStatus {
  ASSIGNED = "ASSIGNED",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
  REPLACED = "REPLACED",
}

export enum VerificationTarget {
  WORKER = "WORKER",
  PROVIDER = "PROVIDER",
  BUSINESS = "BUSINESS",
  AGENT = "AGENT",
  SKILL = "SKILL",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export enum AvailabilityStatus {
  OFFLINE = "OFFLINE",
  AVAILABLE_NOW = "AVAILABLE_NOW",
  AVAILABLE_LATER = "AVAILABLE_LATER",
  BUSY = "BUSY",
}

export enum PaymentMethod {
  CASH = "CASH",
  ONLINE = "ONLINE",
  UPI = "UPI",
  CARD = "CARD",
  NETBANKING = "NETBANKING",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  DISPUTED = "DISPUTED",
  REFUNDED = "REFUNDED",
  SETTLED = "SETTLED",
}

export enum DisputeStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}

export enum ReportStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  ACTION_TAKEN = "ACTION_TAKEN",
  DISMISSED = "DISMISSED",
}

export enum NotificationChannel {
  IN_APP = "IN_APP",
  SMS = "SMS",
  PUSH = "PUSH",
}
