# NEARVIA Data Dictionary & Relational Schema Catalog

> **Document Version**: 1.0.0  
> **Status**: Approved Specification (Phase 3)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Table Catalog Summary

| #   | Table Name                | Purpose                                               | Primary Key                       | Spatial Columns          |
| :-- | :------------------------ | :---------------------------------------------------- | :-------------------------------- | :----------------------- |
| 1   | `users`                   | Core user identity & Supabase Auth linkage            | `id` (UUID)                       | None                     |
| 2   | `worker_profiles`         | Worker profile, skills, rating, and live availability | `id` (UUID)                       | `location` (Point, 4326) |
| 3   | `provider_profiles`       | Individual & business employer profiles               | `id` (UUID)                       | `location` (Point, 4326) |
| 4   | `agent_profiles`          | Local assisted onboarding intermediaries              | `id` (UUID)                       | None                     |
| 5   | `categories`              | Normalized industry work categories                   | `id` (UUID)                       | None                     |
| 6   | `skills`                  | Standard skill taxonomy catalog                       | `id` (UUID)                       | None                     |
| 7   | `worker_skills`           | Worker-to-skill many-to-many relationship             | `(worker_id, skill_id)`           | None                     |
| 8   | `work_opportunities`      | Unified table for Tasks, Shifts, and Jobs             | `id` (UUID)                       | `location` (Point, 4326) |
| 9   | `work_opportunity_skills` | Required skills for work opportunities                | `(work_opportunity_id, skill_id)` | None                     |
| 10  | `worker_availability`     | Scheduled availability time slots                     | `id` (UUID)                       | None                     |
| 11  | `applications`            | Worker job applications                               | `id` (UUID)                       | None                     |
| 12  | `assignments`             | Confirmed work assignment execution records           | `id` (UUID)                       | None                     |
| 13  | `verifications`           | Audit-trail verification submissions                  | `id` (UUID)                       | None                     |
| 14  | `reviews`                 | Two-sided ratings & reviews on assignments            | `id` (UUID)                       | None                     |
| 15  | `payment_records`         | Non-sensitive financial ledgers                       | `id` (UUID)                       | None                     |
| 16  | `disputes`                | Formal dispute arbitration tickets                    | `id` (UUID)                       | None                     |
| 17  | `reports`                 | User/conduct moderation reports                       | `id` (UUID)                       | None                     |
| 18  | `notifications`           | In-app user notifications & alerts                    | `id` (UUID)                       | None                     |
| 19  | `agent_assistance`        | Audit log of agent-assisted worker interactions       | `id` (UUID)                       | None                     |
| 20  | `audit_logs`              | Immutable administrative & security event log         | `id` (UUID)                       | None                     |

---

## 2. Comprehensive Entity Data Dictionaries

### 2.1 `users`

- **Purpose**: Central platform account linking to Supabase Auth.
- **Columns**:
  - `id` (UUID, PK): Unique user identifier.
  - `auth_id` (VARCHAR(255), UNIQUE, NOT NULL): Supabase Auth UID.
  - `phone` (VARCHAR(20), UNIQUE, NOT NULL): Primary mobile phone number for OTP.
  - `full_name` (VARCHAR(120), NOT NULL): User legal / display name.
  - `email` (VARCHAR(255), UNIQUE, NULL): Optional email address.
  - `role` (user_role, NOT NULL): ENUM (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`).
  - `avatar_url` (TEXT, NULL): Profile photo URL.
  - `is_active` (BOOLEAN, DEFAULT TRUE): Account status flag.
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW()): Record creation timestamp.
  - `updated_at` (TIMESTAMPTZ, DEFAULT NOW()): Last record update timestamp.
- **Indexes**: `idx_users_auth_id`, `idx_users_role`, `idx_users_phone`.

---

### 2.2 `worker_profiles`

- **Purpose**: Worker operational attributes, spatial location, ratings, and live availability.
- **Columns**:
  - `id` (UUID, PK): Worker profile ID.
  - `user_id` (UUID, UNIQUE, NOT NULL, FK -> `users.id` ON DELETE CASCADE): User reference.
  - `bio` (TEXT, NULL): Worker self-description.
  - `experience_years` (NUMERIC(4,1), DEFAULT 0, CHECK >= 0 AND <= 50): Total experience years.
  - `location` (GEOGRAPHY(Point, 4326), NOT NULL): Geodesic WGS84 coordinates.
  - `address_approximate` (TEXT, NULL): Fuzzed locality name (e.g. "Domlur Layout").
  - `service_radius_km` (NUMERIC(4,1), DEFAULT 5.0, CHECK >= 1.0 AND <= 15.0): Max travel radius.
  - `availability_status` (availability_status, DEFAULT 'OFFLINE'): ENUM (`OFFLINE`, `AVAILABLE_NOW`, `AVAILABLE_LATER`, `BUSY`).
  - `is_available_now` (BOOLEAN, DEFAULT FALSE): Live Available-Now flag.
  - `available_until` (TIMESTAMPTZ, NULL): Expiration time for Available-Now state.
  - `hourly_rate_estimate` (NUMERIC(10,2), NULL, CHECK >= 0): Expected hourly rate (INR).
  - `daily_rate_estimate` (NUMERIC(10,2), NULL, CHECK >= 0): Expected daily rate (INR).
  - `average_rating` (NUMERIC(3,2), DEFAULT 5.00, CHECK >= 1.00 AND <= 5.00): Reputation score.
  - `total_ratings_count` (INT, DEFAULT 0, CHECK >= 0): Number of reviews received.
  - `completed_tasks_count` (INT, DEFAULT 0, CHECK >= 0): Total finished assignments.
  - `assisted_by_agent_id` (UUID, NULL, FK -> `agent_profiles.id`): Assisting agent.
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `GIST(location)`, `idx_worker_profiles_available_now`, `idx_worker_profiles_status`, `idx_worker_profiles_rating`.

---

### 2.3 `provider_profiles`

- **Purpose**: Employer profile for businesses or individual task posters.
- **Columns**:
  - `id` (UUID, PK): Provider profile ID.
  - `user_id` (UUID, UNIQUE, NOT NULL, FK -> `users.id` ON DELETE CASCADE): User reference.
  - `provider_type` (provider_type, DEFAULT 'INDIVIDUAL'): ENUM (`INDIVIDUAL`, `BUSINESS`).
  - `business_name` (VARCHAR(200), NULL): Registered trade name.
  - `description` (TEXT, NULL): Company or individual overview.
  - `contact_phone` (VARCHAR(20), NULL): Business contact line.
  - `location` (GEOGRAPHY(Point, 4326), NOT NULL): Business/base location.
  - `address_approximate` (TEXT, NULL): Public locality name.
  - `verified_business` (BOOLEAN, DEFAULT FALSE): Verification badge.
  - `average_rating` (NUMERIC(3,2), DEFAULT 5.00, CHECK >= 1.00 AND <= 5.00): Reputation score.
  - `total_ratings_count` (INT, DEFAULT 0, CHECK >= 0): Total ratings received.
  - `posted_jobs_count` (INT, DEFAULT 0, CHECK >= 0): Total opportunities published.
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `GIST(location)`, `idx_provider_profiles_type`.

---

### 2.4 `work_opportunities`

- **Purpose**: Centralized marketplace entity unifying Tasks (1-2 hrs), Shifts (3-6 hrs), and Jobs (1 day / multi-day).
- **Columns**:
  - `id` (UUID, PK): Opportunity ID.
  - `provider_id` (UUID, NOT NULL, FK -> `provider_profiles.id` ON DELETE CASCADE): Creator.
  - `category_id` (UUID, NOT NULL, FK -> `categories.id` ON DELETE RESTRICT): Domain category.
  - `title` (VARCHAR(150), NOT NULL): Opportunity title.
  - `description` (TEXT, NOT NULL): Detailed work scope.
  - `work_type` (work_type, NOT NULL): ENUM (`TASK`, `SHIFT`, `JOB`).
  - `urgency` (urgency_level, DEFAULT 'NORMAL'): ENUM (`NORMAL`, `URGENT`, `IMMEDIATE`).
  - `status` (work_opportunity_status, DEFAULT 'DRAFT'): ENUM (`DRAFT`, `PUBLISHED`, `MATCHING`, `PARTIALLY_FILLED`, `FILLED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED`).
  - `workers_needed` (INT, DEFAULT 1, CHECK > 0 AND <= 100): Slots required.
  - `workers_assigned` (INT, DEFAULT 0, CHECK >= 0 AND <= workers_needed): Slots filled.
  - `location` (GEOGRAPHY(Point, 4326), NOT NULL): Physical job site location.
  - `address_approximate` (TEXT, NOT NULL): Work site address.
  - `work_date` (DATE, NOT NULL): Scheduled work date.
  - `start_time` (TIMESTAMPTZ, NOT NULL): Start timestamp.
  - `end_time` (TIMESTAMPTZ, NOT NULL): End timestamp (CHECK `end_time > start_time`).
  - `duration_hours` (NUMERIC(4,2), NOT NULL, CHECK > 0 AND <= 24): Total duration.
  - `payment_amount` (NUMERIC(10,2), NOT NULL, CHECK > 0): Remuneration figure.
  - `payment_type` (payment_type, NOT NULL): ENUM (`HOURLY`, `FIXED`, `DAILY`).
  - `currency` (VARCHAR(3), DEFAULT 'INR'): Currency code.
  - `min_experience_years` (NUMERIC(3,1), DEFAULT 0, CHECK >= 0): Minimum experience.
  - `responsibilities` (TEXT, NULL): Task responsibilities.
  - `instructions` (TEXT, NULL): Reporting and check-in instructions.
  - `tools_provided` (BOOLEAN, DEFAULT FALSE): Flag indicating equipment provision.
  - `orientation_provided` (BOOLEAN, DEFAULT FALSE): Flag indicating on-site briefing.
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
  - `published_at`, `completed_at`, `cancelled_at` (TIMESTAMPTZ, NULL): Lifecycle timestamps.
- **Indexes**: `GIST(location)`, `idx_work_opportunities_status`, `idx_work_opportunities_date`, `idx_work_opportunities_type`, `idx_work_opportunities_provider`.

---

### 2.5 `applications`

- **Purpose**: Worker application submission for a work opportunity.
- **Columns**:
  - `id` (UUID, PK): Application ID.
  - `work_opportunity_id` (UUID, NOT NULL, FK -> `work_opportunities.id` ON DELETE CASCADE).
  - `worker_id` (UUID, NOT NULL, FK -> `worker_profiles.id` ON DELETE CASCADE).
  - `status` (application_status, DEFAULT 'PENDING'): ENUM (`PENDING`, `SHORTLISTED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`).
  - `proposed_wage` (NUMERIC(10,2), NULL, CHECK > 0): Optional proposed rate.
  - `worker_notes` (TEXT, NULL): Application pitch / notes.
  - `applied_at` (TIMESTAMPTZ, DEFAULT NOW()): Submission time.
  - `responded_at` (TIMESTAMPTZ, NULL): Provider response time.
  - `decision_notes` (TEXT, NULL): Provider feedback / decision notes.
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Constraints**: `UNIQUE(work_opportunity_id, worker_id)` preventing duplicate active submissions.
- **Indexes**: `idx_applications_work_opp`, `idx_applications_worker`, `idx_applications_status`.

---

### 2.6 `assignments`

- **Purpose**: Contracted work execution assignment allocating a worker to an opportunity.
- **Columns**:
  - `id` (UUID, PK): Assignment ID.
  - `work_opportunity_id` (UUID, NOT NULL, FK -> `work_opportunities.id` ON DELETE RESTRICT).
  - `worker_id` (UUID, NOT NULL, FK -> `worker_profiles.id` ON DELETE RESTRICT).
  - `provider_id` (UUID, NOT NULL, FK -> `provider_profiles.id` ON DELETE RESTRICT).
  - `application_id` (UUID, NULL, FK -> `applications.id` ON DELETE SET NULL).
  - `status` (assignment_status, DEFAULT 'ASSIGNED'): ENUM (`ASSIGNED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `REPLACED`).
  - `assigned_at` (TIMESTAMPTZ, DEFAULT NOW()).
  - `checked_in_at` (TIMESTAMPTZ, NULL): Worker on-site check-in timestamp.
  - `started_at` (TIMESTAMPTZ, NULL): Work commencement timestamp.
  - `completed_at` (TIMESTAMPTZ, NULL): Work conclusion timestamp.
  - `cancelled_at` (TIMESTAMPTZ, NULL): Cancellation timestamp.
  - `agreed_wage` (NUMERIC(10,2), NOT NULL, CHECK > 0): Agreed compensation (INR).
  - `final_wage_paid` (NUMERIC(10,2), NULL, CHECK >= 0): Final disbursed wage.
  - `payment_status` (payment_status, DEFAULT 'PENDING'): ENUM (`PENDING`, `RECORDED`, `PAID`, `DISPUTED`, `REFUNDED`).
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `idx_assignments_work_opp`, `idx_assignments_worker`, `idx_assignments_provider`, `idx_assignments_status`.

---

### 2.7 `reviews`

- **Purpose**: Two-sided rating and review strictly tied to completed assignments.
- **Columns**:
  - `id` (UUID, PK): Review ID.
  - `assignment_id` (UUID, NOT NULL, FK -> `assignments.id` ON DELETE RESTRICT).
  - `reviewer_id` (UUID, NOT NULL, FK -> `users.id` ON DELETE RESTRICT).
  - `reviewee_id` (UUID, NOT NULL, FK -> `users.id` ON DELETE RESTRICT).
  - `rating` (INT, NOT NULL, CHECK >= 1 AND <= 5): Rating value between 1 and 5 stars.
  - `comments` (TEXT, NULL): Qualitative review remarks.
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Constraints**: `UNIQUE(assignment_id, reviewer_id)` ensuring only one review per participant per assignment.
- **Indexes**: `idx_reviews_reviewee`, `idx_reviews_reviewer`, `idx_reviews_assignment`.

---

### 2.8 `payment_records`

- **Purpose**: Non-sensitive ledger recording compensation settlements.
- **Columns**:
  - `id` (UUID, PK): Payment record ID.
  - `assignment_id` (UUID, NOT NULL, FK -> `assignments.id` ON DELETE RESTRICT).
  - `payer_id` (UUID, NOT NULL, FK -> `users.id` ON DELETE RESTRICT).
  - `payee_id` (UUID, NOT NULL, FK -> `users.id` ON DELETE RESTRICT).
  - `amount` (NUMERIC(10,2), NOT NULL, CHECK > 0): Payment amount.
  - `currency` (VARCHAR(3), DEFAULT 'INR'): Currency code.
  - `status` (payment_status, DEFAULT 'PENDING'): ENUM (`PENDING`, `CONFIRMED`, `FAILED`, `DISPUTED`).
  - `payment_method` (VARCHAR(50), NULL): Method (e.g. 'CASH_DIRECT', 'UPI_RECORDED').
  - `transaction_ref` (VARCHAR(255), NULL): External payment reference ID.
  - `notes` (TEXT, NULL): Transaction notes.
  - `recorded_at` (TIMESTAMPTZ, DEFAULT NOW()).
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `idx_payment_records_assignment`, `idx_payment_records_payer`, `idx_payment_records_payee`.

---

### 2.9 `disputes`

- **Purpose**: Arbitration case record for contested assignments.
- **Columns**:
  - `id` (UUID, PK): Dispute ID.
  - `assignment_id` (UUID, NOT NULL, FK -> `assignments.id` ON DELETE RESTRICT).
  - `initiator_id` (UUID, NOT NULL, FK -> `users.id` ON DELETE RESTRICT).
  - `respondent_id` (UUID, NOT NULL, FK -> `users.id` ON DELETE RESTRICT).
  - `reason` (VARCHAR(100), NOT NULL): Categorical dispute reason.
  - `description` (TEXT, NOT NULL): Detailed problem statement.
  - `status` (dispute_status, DEFAULT 'OPEN'): ENUM (`OPEN`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED`).
  - `resolution_notes` (TEXT, NULL): Administrative findings.
  - `resolved_by` (UUID, NULL, FK -> `users.id` ON DELETE SET NULL): Resolving admin.
  - `resolved_at` (TIMESTAMPTZ, NULL): Resolution timestamp.
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `idx_disputes_assignment`, `idx_disputes_status`.

---

### 2.10 `verifications`

- **Purpose**: Identity, business, agent, and skill verification audit trail.
- **Columns**:
  - `id` (UUID, PK): Verification record ID.
  - `target_type` (verification_target, NOT NULL): ENUM (`WORKER`, `PROVIDER`, `BUSINESS`, `AGENT`, `SKILL`).
  - `target_id` (UUID, NOT NULL): ID of the verified entity.
  - `verification_type` (VARCHAR(50), NOT NULL): Subtype (e.g. 'GOVT_ID', 'TRADE_CERTIFICATE').
  - `document_ref` (VARCHAR(255), NULL): Document storage reference.
  - `status` (verification_status, DEFAULT 'PENDING'): ENUM (`PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED`).
  - `submitted_at` (TIMESTAMPTZ, DEFAULT NOW()).
  - `reviewed_at` (TIMESTAMPTZ, NULL).
  - `reviewed_by` (UUID, NULL, FK -> `users.id` ON DELETE SET NULL).
  - `rejection_reason` (TEXT, NULL).
  - `expires_at` (TIMESTAMPTZ, NULL).
  - `created_at`, `updated_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `idx_verifications_target`, `idx_verifications_status`.

---

### 2.11 `audit_logs`

- **Purpose**: Immutable security and administrative action history.
- **Columns**:
  - `id` (UUID, PK): Audit event ID.
  - `actor_id` (UUID, NULL, FK -> `users.id` ON DELETE SET NULL): User executing action.
  - `action` (VARCHAR(100), NOT NULL): Action identifier (e.g. 'USER_SUSPENDED', 'JOB_FLAGGED').
  - `target_entity` (VARCHAR(100), NOT NULL): Table name of affected resource.
  - `target_id` (UUID, NOT NULL): Record ID of affected resource.
  - `old_values` (JSONB, NULL): Previous state snapshot.
  - `new_values` (JSONB, NULL): Modified state snapshot.
  - `ip_address` (VARCHAR(45), NULL): Client IP address.
  - `user_agent` (TEXT, NULL): Client user agent string.
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW()).
- **Indexes**: `idx_audit_logs_actor`, `idx_audit_logs_target`, `idx_audit_logs_created_at`.
