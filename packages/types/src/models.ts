/**
 * NEARVIA Domain Interfaces & Relational Data Models
 * Authoritative schema representations matching the PostgreSQL + PostGIS schema.
 */

import {
  UserRole,
  WorkType,
  UrgencyLevel,
  PaymentType,
  ProviderType,
  WorkOpportunityStatus,
  ApplicationStatus,
  AssignmentStatus,
  VerificationTarget,
  VerificationStatus,
  AvailabilityStatus,
  PaymentStatus,
  DisputeStatus,
  ReportStatus,
} from "./enums.js";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 1. Users Table Model
export interface User {
  id: string;
  authId: string;
  phone: string;
  fullName: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  language?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  mobileVerified?: boolean;
  mobileVerifiedAt?: string;
  identityVerified?: boolean;
  identityVerifiedAt?: string;
  verificationProvider?: string;
  verificationReference?: string;
  profileCompleted?: boolean;
  isDemo?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 1.1 Authenticated User Session Context
export interface AuthUserContext {
  id: string;
  authId: string;
  phone: string;
  fullName: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  language?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  mobileVerified?: boolean;
  mobileVerifiedAt?: string;
  identityVerified?: boolean;
  identityVerifiedAt?: string;
  verificationProvider?: string;
  verificationReference?: string;
  profileCompleted?: boolean;
  isDemo?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSessionState {
  user: AuthUserContext | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

// 2. Worker Profiles Table Model
export interface WorkerProfile {
  id: string;
  userId: string;
  bio?: string;
  experienceYears: number;
  location: GeoCoordinates;
  addressApproximate?: string;
  serviceRadiusKm: number;
  availabilityStatus: AvailabilityStatus;
  isAvailableNow: boolean;
  availableUntil?: string;
  hourlyRateEstimate?: number;
  dailyRateEstimate?: number;
  averageRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  assistedByAgentId?: string;
  preferredJobTypes?: string[];
  preferredCategories?: string[];
  preferredSkills?: string[];
  createdAt: string;
  updatedAt: string;
}

// 2.1 Profile Completion Status
export interface ProfileCompletionStatus {
  isComplete: boolean;
  completionPercentage: number; // 0 - 100
  completedFields: string[];
  missingRequired: string[];
  missingOptional: string[];
}

// 2.2 Worker Detailed Skill Model
export interface WorkerSkillDetail {
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  yearsExperience: number;
  isVerified: boolean;
  createdAt: string;
}

// 2.3 Detailed Worker Profile Payload
export interface WorkerProfileDetail extends WorkerProfile {
  fullName: string;
  phone: string;
  avatarUrl?: string;
  skills: WorkerSkillDetail[];
  profileCompletion: ProfileCompletionStatus;
}

// 3. Provider Profiles Table Model
export interface ProviderProfile {
  id: string;
  userId: string;
  providerType: ProviderType;
  businessName?: string;
  description?: string;
  contactPhone?: string;
  location: GeoCoordinates;
  addressApproximate?: string;
  verifiedBusiness: boolean;
  averageRating: number;
  totalRatingsCount: number;
  postedJobsCount: number;
  createdAt: string;
  updatedAt: string;
}

// 3.1 Detailed Provider Profile Payload
export interface ProviderProfileDetail extends ProviderProfile {
  fullName: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  profileCompletion: ProfileCompletionStatus;
}

// 4. Agent Profiles Table Model
export interface AgentProfile {
  id: string;
  userId: string;
  assignedArea: string;
  verifiedWorkersCount: number;
  activeStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

// 5. Categories Table Model
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 6. Skills Table Model
export interface Skill {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  categoryName?: string;
  categorySlug?: string;
}

// 7. Worker Skills Association Model
export interface WorkerSkill {
  workerId: string;
  skillId: string;
  yearsExperience: number;
  isVerified: boolean;
  createdAt: string;
}

// 8. Work Opportunities Unified Model (TASK / SHIFT / JOB)
export interface WorkOpportunity {
  id: string;
  providerId: string;
  categoryId: string;
  title: string;
  description: string;
  workType: WorkType;
  urgency: UrgencyLevel;
  status: WorkOpportunityStatus;
  workersNeeded: number;
  workersAssigned: number;
  location: GeoCoordinates;
  addressApproximate: string;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  paymentAmount: number;
  paymentType: PaymentType;
  currency: string;
  minExperienceYears: number;
  responsibilities?: string;
  instructions?: string;
  toolsProvided: boolean;
  orientationProvided: boolean;
  scheduleType?: "ONE_TIME" | "RECURRING";
  recurringPattern?: string;
  recurringDays?: string;
  isInstant?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

// 8.1 Work Opportunity Skill Requirement with Taxonomy Details
export interface WorkOpportunitySkillDetail {
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName?: string;
  isRequired: boolean;
  minExperienceYears: number;
}

// 8.2 Work Opportunity Detailed Payload
export interface WorkOpportunityDetail extends WorkOpportunity {
  categoryName?: string;
  categorySlug?: string;
  categoryIcon?: string;
  providerName?: string;
  providerType?: ProviderType;
  businessName?: string;
  contactPhone?: string;
  providerRating?: number;
  providerVerified?: boolean;
  providerPhoneVerified?: boolean;
  providerIdentityVerified?: boolean;
  providerEmailVerified?: boolean;
  providerBusinessVerified?: boolean;
  skills: WorkOpportunitySkillDetail[];
}

// 8.3 Discovered Work Opportunity (with PostGIS geodesic distance & starting soon flag)
export interface DiscoveredOpportunity extends WorkOpportunityDetail {
  distanceKm: number;
  distanceMeters: number;
  isStartingSoon: boolean;
  match?: MatchExplanation;
}

// 8.4 Matching & Explainable Scoring Models (Deterministic Multi-Factor Scoring)
export interface MatchScoreBreakdown {
  skillScore: number; // 0–100 (35% weight)
  availabilityScore: number; // 0–100 (25% weight)
  distanceScore: number; // 0–100 (20% weight)
  durationScore: number; // 0–100 (10% weight)
  categoryScore: number; // 0–100 (5% weight)
  urgencyScore: number; // 0–100 (5% weight)
}

export interface MatchExplanation {
  score: number; // Composite 0–100 compatibility score
  breakdown: MatchScoreBreakdown;
  reasons: string[]; // Positive factors (e.g. "✓ 2 of 2 required skills matched")
  limitations: string[]; // Constructive limitation notes (e.g. "3.4 km away (near 5 km radius)")
  isEligible: boolean; // Whether candidate passes all hard filter requirements
}

export interface MatchedWorkOpportunity extends DiscoveredOpportunity {
  match: MatchExplanation;
}

export type DiscoverySortOption =
  "RECOMMENDED" | "NEAREST" | "STARTING_SOON" | "HIGHEST_PAY";
export type DiscoveryDateFilter =
  "ALL" | "TODAY" | "TOMORROW" | "STARTING_SOON";
export type DiscoveryDurationFilter =
  "ALL" | "UNDER_2H" | "2_TO_4H" | "HALF_DAY" | "FULL_DAY";

export interface DiscoveryQueryParams {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  search?: string;
  workType?: WorkType;
  categoryId?: string;
  urgency?: UrgencyLevel;
  dateFilter?: DiscoveryDateFilter;
  durationFilter?: DiscoveryDurationFilter;
  minPayment?: number;
  maxPayment?: number;
  sort?: DiscoverySortOption;
  page?: number;
  limit?: number;
}

export interface DiscoveryQueryResult {
  opportunities: DiscoveredOpportunity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchCenter: GeoCoordinates;
  radiusKm: number;
}

// 9. Work Opportunity Skills Association Model
export interface WorkOpportunitySkill {
  workOpportunityId: string;
  skillId: string;
  isRequired: boolean;
  minExperienceYears: number;
}

// 10. Worker Availability Slots Model
export interface WorkerAvailability {
  id: string;
  workerId: string;
  availabilityDate: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  createdAt: string;
  updatedAt: string;
}

// 11. Applications Model
export interface Application {
  id: string;
  workOpportunityId: string;
  workerId: string;
  status: ApplicationStatus;
  proposedWage?: number;
  workerNotes?: string;
  appliedAt: string;
  respondedAt?: string;
  decisionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDetail extends Application {
  // Opportunity context
  opportunityTitle: string;
  opportunityDescription: string;
  workType: WorkType;
  urgency: UrgencyLevel;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  paymentAmount: number;
  paymentType: PaymentType;
  addressApproximate: string;
  opportunityStatus: WorkOpportunityStatus;
  categoryName?: string;
  providerBusinessName?: string;

  // Worker context (for provider view)
  workerFullName?: string;
  workerAvatarUrl?: string;
  workerRating?: number;
  workerCompletedTasks?: number;
  workerTradeSkills?: string[];
  workerDistanceKm?: number;
  workerIsAvailableNow?: boolean;

  // Match snapshot
  matchScore?: number;
  matchReasons?: string[];
}

export interface ApplicantListItem {
  applicationId: string;
  workerId: string;
  workerUserId: string;
  workerFullName: string;
  workerAvatarUrl?: string;
  workerRating: number;
  workerCompletedTasks: number;
  workerTradeSkills: string[];
  workerDistanceKm: number;
  workerIsAvailableNow: boolean;
  workerPhoneVerified?: boolean;
  workerIdentityVerified?: boolean;
  workerEmailVerified?: boolean;
  status: ApplicationStatus;
  proposedWage?: number;
  workerNotes?: string;
  appliedAt: string;
  matchScore: number;
  matchReasons: string[];
}

export interface ApplyWorkInput {
  proposedWage?: number;
  workerNotes?: string;
  workerLatitude?: number;
  workerLongitude?: number;
}

export interface ApplicationDecisionInput {
  decisionNotes?: string;
}

// 12. Assignments Model
export interface Assignment {
  id: string;
  workOpportunityId: string;
  workerId: string;
  providerId: string;
  applicationId?: string;
  status: AssignmentStatus;
  assignedAt: string;
  confirmedAt?: string;
  checkedInAt?: string;
  startedAt?: string;
  checkedOutAt?: string;
  workedMinutes?: number;
  completedAt?: string;
  cancelledAt?: string;
  noShowAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  completionNotes?: string;
  checkInDistanceMeters?: number;
  jobPin?: string;
  jobPinAttempts?: number;
  jobPinVerifiedAt?: string;
  agreedWage: number;
  finalWagePaid?: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentDetail extends Assignment {
  opportunityTitle: string;
  opportunityDescription: string;
  workType: WorkType;
  urgency: UrgencyLevel;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  addressApproximate: string;
  instructions?: string;
  responsibilities?: string;

  // Unlocked contact information
  providerFullName: string;
  providerBusinessName?: string;
  providerContactPhone: string;

  workerFullName: string;
  workerAvatarUrl?: string;
  workerContactPhone?: string;

  // Opportunity coordinates for check-in proximity validation
  opportunityLatitude?: number;
  opportunityLongitude?: number;
}

// 12.1 Attendance Record Model
export interface AttendanceRecord {
  id: string;
  assignmentId: string;
  workerId: string;
  checkInTime: string;
  checkInLocation?: GeoCoordinates;
  distanceMeters?: number;
  verifiedByProvider: boolean;
  notes?: string;
  createdAt: string;
}

// 12.2 Assignment Action Inputs (Phase 6 & 10)
export interface CheckInInput {
  latitude?: number;
  longitude?: number;
  notes?: string;
  manualFallback?: boolean;
}

export interface VerifyPinInput {
  jobPin: string;
}

export interface CheckOutInput {
  completionNotes?: string;
  latitude?: number;
  longitude?: number;
}

export type JobEvidenceType =
  | "ARRIVAL"
  | "BEFORE"
  | "AFTER"
  | "ISSUE"
  | "DAMAGE"
  | "RECEIPT"
  | "INCIDENT";

export interface JobEvidence {
  id: string;
  assignmentId: string;
  uploadedBy: string;
  uploaderName?: string;
  evidenceType: JobEvidenceType;
  fileUrl: string;
  notes?: string;
  createdAt: string;
}

export interface UploadJobEvidenceInput {
  evidenceType: JobEvidenceType;
  fileUrl: string;
  notes?: string;
}

export interface SharedActiveJobInfo {
  id: string;
  title: string;
  workType: string;
  providerName: string;
  status: string;
  workDate: string;
  startTime: string;
  endTime: string;
  addressApproximate: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  completedAt?: string;
}

export interface StartWorkInput {
  notes?: string;
}

export interface CompleteWorkInput {
  completionNotes?: string;
  hoursWorked?: number;
}

export interface ConfirmCompletionInput {
  feedback?: string;
  finalWagePaid?: number;
}

export interface CancelAssignmentInput {
  reason: string;
}

export interface NoShowInput {
  notes?: string;
}

// 13. Verifications Model
export interface Verification {
  id: string;
  targetType: VerificationTarget;
  targetId: string;
  verificationType: string;
  documentRef?: string;
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 14. Reviews & Ratings Model
export interface Review {
  id: string;
  assignmentId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number; // 1 to 5
  comments?: string;
  createdAt: string;
}

// 15. Payment Records Model
export interface PaymentRecord {
  id: string;
  assignmentId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  amountPaise?: number;
  platformFee?: number;
  platformFeePaise?: number;
  netPayout?: number;
  netPayoutPaise?: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  transactionRef?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  paymentPin?: string;
  paymentPinAttempts?: number;
  paymentPinVerifiedAt?: string;
  cashConfirmedByPayerAt?: string;
  cashConfirmedByPayeeAt?: string;
  reconciliationStatus?: "MATCHED" | "DISCREPANCY" | "DISPUTED" | "UNRECONCILED";
  reconciliationNotes?: string;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  assignmentId: string;
  opportunityTitle: string;
  workType: string;
  workDate: string;
  payerName: string;
  payerBusinessName?: string;
  payeeName: string;
  amount: number;
  platformFee: number;
  netPayout: number;
  currency: string;
  paymentMethod: string;
  status: string;
  transactionRef: string;
  recordedAt: string;
  cashConfirmedByPayerAt?: string;
  cashConfirmedByPayeeAt?: string;
  disclaimer: string;
}

export interface InitiateCashPaymentInput {
  notes?: string;
}

export interface ConfirmCashPaymentInput {
  paymentPin: string;
  notes?: string;
}

export interface PaymentReconciliationReport {
  totalChecked: number;
  matchedCount: number;
  discrepanciesCount: number;
  disputedCount: number;
  unreconciledCount: number;
  issues: Array<{
    paymentId: string;
    assignmentId: string;
    issueType: string;
    description: string;
    actionRequired: string;
  }>;
  reconciledAt: string;
}

// 16. Disputes Model
export interface Dispute {
  id: string;
  assignmentId: string;
  initiatorId: string;
  respondentId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 17. Reports Model
export interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  reviewedBy?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

// 18. Notifications Model
export interface Notification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// 19. Agent Assistance Model
export interface AgentAssistance {
  id: string;
  agentId: string;
  workerId: string;
  workOpportunityId?: string;
  interactionType: string;
  notes?: string;
  createdAt: string;
}

// 20. Audit Logs Model
export interface AuditLog {
  id: string;
  actorId?: string;
  action: string;
  targetEntity: string;
  targetId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// 21. Match Result Primitives
export interface MatchResult<T = WorkerProfile | WorkOpportunity> {
  target: T;
  scoreBreakdown: MatchScoreBreakdown;
  explanation: MatchExplanation;
}

// 22. Discovery Summary & Aggregation Models
export interface DiscoverySummaryCategoryStat {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryIcon?: string;
  count: number;
  minPayment: number;
  maxPayment: number;
}

export interface DiscoverySummaryResponse {
  totalOpportunities: number;
  activeCategoriesCount: number;
  minPayment: number;
  maxPayment: number;
  searchCenter: GeoCoordinates;
  radiusKm: number;
  categoryStats: DiscoverySummaryCategoryStat[];
}

// 23. Phase 5 Real-Time Marketplace Models
export interface WorkerAvailabilityToggleInput {
  isAvailableNow: boolean;
  availableUntil?: string;
  serviceRadiusKm?: number;
  preferredJobTypes?: string[];
  preferredCategories?: string[];
  preferredSkills?: string[];
  latitude?: number;
  longitude?: number;
}

export interface ReliabilityScoreInfo {
  score: number | null; // 0-100 or null if < 3 jobs
  label: string;
  isNew: boolean;
  totalAssigned: number;
  completedCount: number;
  noShowCount: number;
  cancellationCount: number;
}

export interface WorkerDashboardStats {
  todayEarnings: number;
  monthEarnings: number;
  totalEarnings: number;
  activeAssignment: any | null;
  upcomingJob: any | null;
  nearbyJobsCount: number;
  recommendedJobs: any[];
  reliability: ReliabilityScoreInfo;
  averageRating: number;
  totalRatingsCount: number;
  profileCompletionPercentage: number;
  isAvailableNow: boolean;
  availableUntil?: string;
  serviceRadiusKm: number;
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
  };
}

export interface WorkforceRadarCategoryCount {
  categoryId: string;
  categoryName: string;
  availableWorkersCount: number;
}

export interface WorkforceRadarCluster {
  id: string;
  approximateAreaName: string;
  centerCoordinates: GeoCoordinates; // Jittered/approximate centroid for privacy
  availableWorkersCount: number;
  categories: {
    categoryId: string;
    categoryName: string;
    count: number;
  }[];
}

export interface WorkforceRadarSummary {
  totalAvailableWorkers: number;
  searchCenter: GeoCoordinates;
  radiusKm: number;
  categoryCounts: WorkforceRadarCategoryCount[];
  clusters: WorkforceRadarCluster[];
}

export interface PreferredWorkerRecord {
  id: string;
  providerId: string;
  workerId: string;
  workerName: string;
  workerPhoneMasked: string;
  workerRating: number;
  skills: string[];
  createdAt: string;
}

export interface PreferredProviderRecord {
  id: string;
  workerId: string;
  providerId: string;
  businessName: string;
  providerRating: number;
  createdAt: string;
}

export interface ReplacementRequestRecord {
  id: string;
  originalAssignmentId: string;
  providerId: string;
  previousWorkerId: string;
  reason: string;
  status: "PENDING" | "MATCHED" | "ASSIGNED" | "CANCELLED";
  replacementAssignmentId?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ==============================================================================
// 15. PHASE 8: INTELLIGENCE LAYER MODELS & CONTRACTS
// ==============================================================================

export interface CandidateMatchBreakdown {
  skillScore: number; // 0-100 (35% weight)
  availabilityScore: number; // 0-100 (25% weight)
  distanceScore: number; // 0-100 (20% weight)
  reliabilityScore: number; // 0-100 (10% weight)
  ratingScore: number; // 0-100 (5% weight)
  verificationBonus: number; // 0-100 (5% weight)
}

export interface CandidateMatchExplanation {
  score: number; // Composite 0-100 compatibility score
  breakdown: CandidateMatchBreakdown;
  reasons: string[]; // Positive matching factors
  limitations: string[]; // Constructive limitation notices
  isHardEligible: boolean; // Passes all hard constraints
}

export interface CandidateRecommendation {
  workerId: string;
  userId: string;
  fullName: string;
  avatarUrl?: string;
  contactPhoneMasked?: string;
  bio?: string;
  distanceKm: number;
  distanceFormatted: string;
  averageRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  reliabilityScore: number;
  verifiedBadge: boolean;
  onTimeArrivalRate: number;
  skills: Array<{
    skillId: string;
    skillName: string;
    yearsExperience: number;
  }>;
  hourlyRateEstimate?: number;
  dailyRateEstimate?: number;
  match: CandidateMatchExplanation;
  isAvailableNow: boolean;
  availabilityStatus: AvailabilityStatus;
}

export interface NLJobParseInput {
  text: string;
  languageHint?: string;
  locationHint?: {
    latitude?: number;
    longitude?: number;
    addressApproximate?: string;
  };
}

export interface NLJobParseResult {
  title: string;
  description: string;
  workType: WorkType;
  categoryId?: string;
  categoryName?: string;
  requiredSkills: Array<{
    skillId: string;
    skillName: string;
    minExperienceYears: number;
    isRequired: boolean;
  }>;
  suggestedWage: number;
  paymentType: PaymentType;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  urgency: UrgencyLevel;
  responsibilities: string[];
  instructions?: string;
  addressApproximate?: string;
  confidence: number; // 0.0 - 1.0
  missingFields: string[];
  detectedLanguage: string;
  clarificationsNeeded: string[];
}

export interface VoiceAssistanceInput {
  transcript: string;
  audioBase64?: string;
  languageCode?: string;
  mode?: "JOB_SEARCH" | "JOB_CREATE" | "HELP" | "STATUS";
  userRole?: UserRole;
}

export interface LowLiteracyCard {
  icon: string;
  title: string;
  subtitle: string;
  actionType: "NAVIGATE" | "APPLY" | "CALL" | "CONFIRM";
  actionPayload?: Record<string, any>;
  audioText: string;
}

export interface VoiceAssistanceResponse {
  detectedIntent: string;
  languageCode: string;
  transcribedText: string;
  spokenResponse: string;
  audioText: string;
  structuredAction: {
    type: "SEARCH_OPPORTUNITIES" | "DRAFT_JOB" | "VIEW_ASSIGNMENT" | "CONTACT_SUPPORT" | "UNKNOWN";
    payload: Record<string, any>;
  };
  lowLiteracyCards: LowLiteracyCard[];
}

export interface MarketWageBenchmark {
  id: string;
  categoryId: string;
  categoryName: string;
  workType: string;
  paymentType: string;
  sampleCount: number;
  minWage: number;
  p25Wage: number;
  medianWage: number;
  p75Wage: number;
  maxWage: number;
  avgWage: number;
  suggestedHourlyRate: number;
  suggestedDailyRate: number;
  updatedAt: string;
}

export interface MarketDemandHotspot {
  id: string;
  locationName: string;
  latitude: number;
  longitude: number;
  activeOpportunitiesCount: number;
  activeWorkersCount: number;
  supplyDemandRatio: number;
  topCategories: string[];
  urgencyTier: "LOW" | "BALANCED" | "HIGH_DEMAND" | "CRITICAL_SHORTAGE";
}


