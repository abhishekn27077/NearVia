# NEARVIA Functional and Non-Functional Requirements

## 1. Functional Requirements

### 1.1 User & Role Management

- System supports four distinct user roles: Worker, Job Provider, Agent, Admin.
- Secure phone OTP authentication with Supabase Auth.
- Trust badge verification workflows for identity and business validation.

### 1.2 Hyperlocal Discovery & PostGIS Spatial Matching

- Instant discovery of open tasks within a 5 km radius using PostGIS GIST spatial indexing.
- Real-time "Available-Now" toggle for workers.
- Explainable ranking engine incorporating skill overlap, geographic distance, availability windows, and reliability ratings.

### 1.3 Application & Assignment Lifecycle

- Direct application and invitation workflows.
- Step-by-step assignment tracking: Assigned -> Arrived -> Started -> Completed.
- Two-sided mutual rating and review system upon task completion.

### 1.4 Agent-Assisted Onboarding

- Verified local agents can register and manage profiles for workers with limited digital literacy.
- All tasks, assignments, and payments remain strictly recorded inside NEARVIA.

## 2. Non-Functional Requirements

### 2.1 Performance & Latency

- Hyperlocal spatial queries must execute in < 50ms at P95 within the 5 km bounding box.
- REST API response times < 100ms for core read endpoints.

### 2.2 Security & Privacy

- Zero leakage of raw GPS worker coordinates in public search results.
- Sensitive environment configurations isolated from source control.
- Role-Based Access Control (RBAC) enforced on all domain endpoints.

### 2.3 Maintainability & Code Quality

- Modular Monolith architecture preventing tight coupling.
- Strict TypeScript type safety across all workspaces.
- Single source of truth for validation schemas and domain models.
