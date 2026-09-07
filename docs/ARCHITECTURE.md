# NEARVIA — SYSTEM ARCHITECTURE SPECIFICATION

> **Document Version**: 2.0.0  
> **Academic Standard**: MCA Final Semester Technical Dissertation  
> **System**: NEARVIA Hyperlocal Quick-Work & Informal Labor Marketplace  
> **Core Architecture Formula**: *PostGIS + deterministic business rules → explainable matching → recommendations → feedback → future ML*

---

## 1. High-Level System Architecture

NEARVIA is built on a clean multi-tier client-server architecture designed for high availability, low latency spatial queries, and zero hard dependencies on external AI or closed APIs.

```mermaid
flowchart TB
    subgraph Clients ["Client Layer (Cross-Device)"]
        WebClient["React 18 SPA (Vite)<br/>Responsive Web App"]
        MobileClient["Mobile Client (Expo/React Native)<br/>Reserved for Native Distribution"]
    end

    subgraph CDN ["Edge & Network Security"]
        Cloudflare["Cloudflare CDN / WAF<br/>SSL/TLS Termination & DDoS Shield"]
    end

    subgraph Backend ["Application Service Layer (Node.js 20 + Express)"]
        API["REST API Router (/api/v1)"]
        AuthGuard["Auth Guard & Session Resolver (JWT)"]
        RBAC["Role-Based Access Control Middleware"]
        RateLimiter["Granular Route Rate Limiters (In-Memory / Redis)"]
        
        subgraph DomainModules ["Domain Modules"]
            AuthMod["Auth & OTP Module"]
            JobsMod["Jobs & Discovery Module"]
            MatchMod["Explainable Matching Engine"]
            ExecMod["Assignments & Attendance Module"]
            PayMod["Payments & Webhook Module"]
            IntelMod["Intelligence & Voice Module"]
            MsgMod["Direct Messaging Module"]
            SafeMod["Safety, Reviews & Disputes Module"]
            AdminMod["Admin & Audit Module"]
        end
    end

    subgraph DataStorage ["Data & Persistence Layer"]
        Postgres["PostgreSQL 17 (Supabase Managed)"]
        PostGIS["PostGIS 3.3 Spatial Engine (SRS 4326)"]
        Trigram["pg_trgm Trigram Fuzzy Text Index"]
        StorageBucket["Encrypted Storage (Evidence & KYC)"]
    end

    subgraph External ["External Third-Party Services"]
        Razorpay["Razorpay Payment Gateway (Sandbox / Live)"]
        MSG91["MSG91 SMS Gateway (DLT Approved)"]
        Gemini["Google Gemini LLM (Optional Copilot)"]
        OpenStreetMap["OpenStreetMap / Leaflet Tiles"]
    end

    WebClient --> Cloudflare
    MobileClient --> Cloudflare
    Cloudflare --> API
    API --> RateLimiter
    RateLimiter --> AuthGuard
    AuthGuard --> RBAC
    RBAC --> DomainModules

    JobsMod --> PostGIS
    MatchMod --> Trigram
    DomainModules --> Postgres
    ExecMod --> StorageBucket

    PayMod -.-> Razorpay
    AuthMod -.-> MSG91
    IntelMod -.-> Gemini
    WebClient -.-> OpenStreetMap
```

---

## 2. Multi-Tier Component Breakdown

### 2.1 Presentation Tier (`apps/web`)
- **Technology**: React 18, Vite 6, TypeScript 5, Tailwind CSS with custom CSS design tokens, Lucide icons, Leaflet / React-Leaflet for spatial maps.
- **State Management**: Lightweight Zustand store for auth session and notification badge counters; React Query / native hooks for server-cache synchronisation.
- **Security**: Strict client-side data minimization. Zero service-role keys or database credentials are bundled into the production JavaScript bundle (`apps/web/dist`).
- **Low-Literacy & Accessibility**: Visual iconography for all trades, color-coded urgency badges (Immediate/Urgent/Normal), multilingual audio speech synthesiser via browser SpeechSynthesis API, and pictorial action cards.

### 2.2 Application Service Tier (`services/api`)
- **Technology**: Node.js 20 LTS, Express 4, TypeScript 5, Zod 3 runtime schema validation.
- **Stateless Operation**: API nodes maintain zero session state in memory (JWT authentication); easily horizontally scalable across multiple cloud container replicas.
- **Database Connection Pooling**: High-performance `pg-pool` with parameterized query sanitisation, automatic reconnection, and transaction management (`withTransaction`).
- **Security Hardening**:
  - Raw request byte capture (`req.rawBody`) for timing-safe HMAC-SHA256 signature calculation.
  - Route-specific rate limiters: OTP (6/15m), AI (30/15m), Payments (30/15m), Messages (60/15m), Webhooks (120/1m).
  - Centralized error handler suppressing internal stack traces in production.

### 2.3 Spatial & Data Tier (`PostgreSQL 17` + `PostGIS 3.3`)
- **Spatial Geometry**: All locations are stored as `GEOGRAPHY(Point, 4326)` representing WGS84 geodesic coordinates on the ellipsoidal Earth model.
- **Spatial Indexing**: 2D GIST (Generalized Search Tree) indexes on `work_opportunities.location` and `worker_profiles.location` enable sub-10ms bounding-box and radius queries.
- **Idempotency**: Strict unique constraints (e.g. `UNIQUE(provider, event_id)` on `webhook_events`) prevent double processing of payment transactions.
- **Full Text Search**: PostgreSQL `pg_trgm` extension powers GIN (Generalized Inverted Index) trigram matching across categories, skills, and titles for instant typo-tolerant search.

---

## 3. End-to-End User Flow Diagrams

### 3.1 Worker Journey
```mermaid
sequenceDiagram
    autonumber
    actor W as Worker
    participant Web as Web Client
    participant API as REST API
    participant DB as PostgreSQL + PostGIS

    W->>Web: Open NearVia & Enter Phone Number
    Web->>API: POST /api/v1/auth/request-otp
    API-->>Web: OTP Generated (Salted in memory)
    W->>Web: Enter 6-digit OTP
    Web->>API: POST /api/v1/auth/verify-otp
    API-->>Web: JWT Bearer Token (Role: WORKER)

    W->>Web: Click "Find Work" (Radius: 5 km)
    Web->>API: GET /api/v1/jobs/discover?lat=12.97&lng=77.64&radius=5
    API->>DB: SELECT ... WHERE ST_DWithin(location, ..., 5000)
    DB-->>API: Active Opportunities in Radius
    API-->>Web: Return Discovered Jobs with Distance (km)

    W->>Web: Select Opportunity & Click "Apply"
    Web->>API: POST /api/v1/jobs/:id/apply
    API->>DB: INSERT INTO applications (status: 'PENDING')
    API-->>Web: Application Submitted Toast

    Note over W,API: Provider accepts application and creates assignment
    W->>Web: Open Assigned Job & Confirm
    Web->>API: POST /api/v1/assignments/:id/confirm
    API-->>Web: Status updated to CONFIRMED

    W->>Web: Arrive at Site & Click "GPS Check-In"
    Web->>API: POST /api/v1/assignments/:id/check-in {lat, lng}
    API->>DB: Verify Haversine Proximity (< 1000m)
    API->>DB: UPDATE assignments SET status='CHECKED_IN'
    API-->>Web: Check-In Confirmed

    Note over W,API: Provider marks shift complete & settles wage
    W->>Web: Receive Payment Notification & View Receipt
    W->>Web: Rate Employer (5 Stars)
    Web->>API: POST /api/v1/reviews
    API-->>Web: Review Stored
```

### 3.2 Provider (Employer) Journey
```mermaid
sequenceDiagram
    autonumber
    actor P as Provider (Business / Individual)
    participant Web as Web Client
    participant API as REST API
    participant DB as PostgreSQL

    P->>Web: Log In (Role: PROVIDER)
    P->>Web: Click "Post a Job"
    Web->>API: GET /api/v1/jobs/taxonomy
    API-->>Web: Categories & Trade Skills
    P->>Web: Fill Details (Title, Hours, Wage, Location)
    Web->>API: POST /api/v1/jobs (status: DRAFT)
    API-->>Web: Draft Created

    P->>Web: Click "Publish Job"
    Web->>API: POST /api/v1/jobs/:id/publish
    API->>DB: UPDATE work_opportunities SET status='PUBLISHED'
    API-->>Web: Opportunity Live

    P->>Web: View Applicants & Recommended Workers
    Web->>API: GET /api/v1/jobs/:id/recommended-workers
    API-->>Web: Scored Candidates (Skills 35%, Dist 25%, Rating 15%, etc.)

    P->>Web: Accept Candidate & Assign
    Web->>API: POST /api/v1/applications/:id/accept
    API->>DB: INSERT INTO assignments (status: ASSIGNED)
    API-->>Web: Assignment Created

    Note over P,API: Worker confirms, arrives, and completes shift
    P->>Web: Click "Confirm Shift Completion"
    Web->>API: POST /api/v1/assignments/:id/complete
    API-->>Web: Status updated to COMPLETED

    P->>Web: Select "Confirm Cash Payment"
    Web->>API: POST /api/v1/payments/cash-confirm
    API->>DB: INSERT INTO payment_records (status: 'CONFIRMED', method: 'CASH')
    API-->>Web: Payment Confirmed & Receipt Issued
```

### 3.3 Community Agent Journey (Assisted Access)
```mermaid
sequenceDiagram
    autonumber
    actor A as Community Agent
    actor W as Low-Literacy Worker
    participant Web as Web Client
    participant API as REST API
    participant DB as PostgreSQL

    W->>A: Seeks Assistance in Local Language (Kannada/Hindi)
    A->>Web: Log In as Verified Agent (Role: AGENT)
    A->>Web: Enter Worker Details (Phone, Skills, Location)
    Web->>API: POST /api/v1/agents/assisted-workers
    API->>DB: INSERT INTO users & worker_profiles (assisted_by_agent_id)
    API-->>Web: Worker Enrolled with Agent Sponsorship

    A->>Web: Search Nearby Micro-Shifts for Worker
    A->>Web: Submit Proxy Application with Worker Consent
    Web->>API: POST /api/v1/jobs/:id/apply (on behalf of worker)
    API-->>Web: Application Logged with Agent Audit Trail
```

### 3.4 Platform Administrator Journey
```mermaid
sequenceDiagram
    autonumber
    actor Adm as Administrator
    participant Web as Web Client
    participant API as REST API
    participant DB as PostgreSQL

    Adm->>Web: Authenticate with MFA & Admin Credentials
    Web->>API: POST /api/v1/auth/login
    API->>DB: Verify Role == 'ADMIN' & is_active == TRUE
    API-->>Web: Admin JWT Token

    Adm->>Web: Open Admin Console (/admin/dashboard)
    Web->>API: GET /api/v1/admin/overview
    API-->>Web: Real-time KPIs (Active Jobs, Workers, GMV, Fill Rate)

    Adm->>Web: Inspect Pending Safety Disputes
    Web->>API: GET /api/v1/safety/disputes
    API-->>Web: Open Disputes List
    Adm->>Web: Resolve Dispute (Refund / Penalty / Dismissal)
    Web->>API: PUT /api/v1/admin/disputes/:id/resolve
    API->>DB: UPDATE disputes & INSERT INTO audit_logs
    API-->>Web: Dispute Resolved & Action Logged
```

---

## 4. Architectural Quality Attributes & Non-Functional Design

1. **High Concurrency & Low Latency**:
   - Geodesic spatial queries complete in $< 15\text{ ms}$ under 2D GIST indexes on PostgreSQL.
   - Stateless Express API response times average $< 35\text{ ms}$ for standard endpoints.
2. **Security & Data Isolation**:
   - Multi-tier defense prevents client-side identity spoofing, SQL injection, and horizontal IDOR.
   - Exact residential coordinates are masked from public APIs until assignment confirmation.
3. **Graceful Fault Tolerance**:
   - Core marketplace operations (job posting, browsing, applications, cash settlement) function 100% independently of third-party external services (AI, Maps, Payment Gateway, SMS).
