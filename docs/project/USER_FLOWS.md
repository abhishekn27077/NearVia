# NEARVIA Master User Flows & Interaction State Machines

> **Document Version**: 1.0.0  
> **Status**: Approved Blueprint (Phase 1)  
> **Project**: NEARVIA — _Work Within Reach_

---

## Flow 1: Worker Registration & Phone OTP Verification

```mermaid
sequenceDiagram
    autonumber
    actor Worker
    participant Client as Web/Mobile Client
    participant Auth as Supabase Auth Service
    participant API as NEARVIA REST API
    participant DB as PostgreSQL DB

    Worker->>Client: Enters Phone Number
    Client->>Auth: Request OTP (Phone SMS)
    Auth-->>Worker: Sends 6-digit SMS OTP
    Worker->>Client: Enters 6-digit OTP
    Client->>Auth: Verify OTP Token
    Auth-->>Client: Returns Auth Session & JWT (auth_id)
    Client->>API: POST /api/v1/auth/session (Bearer JWT)
    API->>DB: Check if user exists by auth_id
    alt New User
        API->>DB: INSERT INTO users (auth_id, phone, role='WORKER')
        API-->>Client: Returns { isNewUser: true, next: "/onboarding/worker/profile" }
    else Existing User
        API-->>Client: Returns { isNewUser: false, next: "/worker/dashboard" }
    end
```

---

## Flow 2: Worker Profile, Skills & Spatial Onboarding

```mermaid
flowchart TD
    A[Start Onboarding] --> B[Step 1: Basic Profile]
    B -->|Name, Photo, Language| C[Step 2: Skills & Experience]
    C -->|Select Category Chips & Trade Skills| D[Step 3: Location & 5km Radius]
    D -->|Set Base GPS Point & Service Radius| E[Step 4: Availability & Wage Baseline]
    E -->|Toggle Available-Now / Set Schedule| F[Submit Worker Profile]
    F --> G[(PostgreSQL PostGIS DB)]
    G --> H[Redirect to Worker Dashboard /worker/dashboard]
```

---

## Flow 3: Worker "Available-Now" Activation & Hyperlocal Discovery

```mermaid
flowchart TD
    A[Worker Dashboard] --> B{Worker Toggles 'Available-Now'}
    B -->|Turn ON| C[Set Status = 'AVAILABLE_NOW']
    C --> D[Worker sets optional auto-expire timer: 2h, 4h, End of Day]
    D --> E[API executes PostGIS GIST Spatial Query within 5 km]
    E --> F[(PostgreSQL PostGIS)]
    F --> G[Return Open Jobs / Micro-Tasks sorted by Explainable Match Score]
    G --> H[Worker Views Dashboard: 'Recommended Nearby Work' & 'Starting Soon']

    B -->|Turn OFF| I[Set Status = 'OFFLINE']
    I --> J[Worker excluded from immediate urgent radar matching]
```

---

## Flow 4: Worker Job Discovery, Match Inspection & Quick-Apply

```mermaid
sequenceDiagram
    autonumber
    actor Worker
    participant Client as Worker Client
    participant API as NEARVIA API
    participant Match as Matching Engine

    Worker->>Client: Browses 5 km Work Feed
    Client->>API: GET /api/v1/jobs/nearby?lat=..&lng=..&radiusKm=5
    API->>Match: Calculate Multi-Factor Match Scores
    Match-->>API: Returns Ranked Jobs with scoreBreakdown
    API-->>Client: Renders Job Cards (Title, Distance, Wage, Match %)
    Worker->>Client: Clicks "Why Match?"
    Client-->>Worker: Displays Match Breakdown Modal (Skill ✓, Distance ✓, Time ✓)
    Worker->>Client: Clicks "Quick Apply" (Optional proposed wage / note)
    Client->>API: POST /api/v1/applications (job_id, worker_id)
    API-->>Client: Returns { status: "APPLIED", applicationId: "..." }
    Client-->>Worker: Instant Confirmation Toast & Application Status Tracker
```

---

## Flow 5: Worker Selection & Assignment Activation

```mermaid
sequenceDiagram
    autonumber
    actor Provider
    participant API as NEARVIA API
    actor Worker
    participant Client as Worker Client

    Provider->>API: POST /api/v1/assignments (job_id, worker_id)
    API->>API: Create Assignment (status='ASSIGNED')
    API-->>Worker: Push/SMS Notification: "You have been selected!"
    Worker->>Client: Opens Assignment Screen
    Worker->>Client: Clicks "Accept & Start Shift"
    Client->>API: PATCH /api/v1/assignments/:id/accept
    API->>API: Set Worker Status='BUSY', Assignment='ACCEPTED'
    API-->>Client: Unlocks Exact Address & Supervisor Contact Phone
```

---

## Flow 6: Worker Shift Execution (Arrived $\to$ Started $\to$ Completed)

```mermaid
stateDiagram-v2
    [*] --> ASSIGNED: Provider selects worker
    ASSIGNED --> ACCEPTED: Worker accepts assignment
    ACCEPTED --> ARRIVED: Worker reaches location & taps "I Have Arrived"
    ARRIVED --> STARTED: Supervisor confirms check-in / start time
    STARTED --> COMPLETED: Work duration concludes & completion confirmed
    COMPLETED --> PAID_RECORDED: Payment recorded & digital receipt generated
    PAID_RECORDED --> RATED: Both parties submit reviews
    RATED --> [*]
```

---

## Flow 7: Job Provider Requirement Creation (Task / Shift / Job Wizard)

```mermaid
flowchart TD
    A[Provider clicks 'Post Work'] --> B[Step 1: Select Work Model]
    B --> B1[Micro-Task: 1-2 hrs]
    B --> B2[Short Shift: 3-6 hrs]
    B --> B3[Temporary Job: 1+ days]

    B1 & B2 & B3 --> C[Step 2: Category, Title & Skill Requirements]
    C --> D[Step 3: Schedule, Start/End Time & Urgency]
    D --> E[Step 4: Location, Wage & Orientation Notes]
    E --> F[Step 5: Job Preview & Candidate Pool Estimator]
    F --> G[Click 'Publish Work']
    G --> H[(PostgreSQL PostGIS)]
    H --> I[Trigger Hyperlocal Proximity Match Alert]
```

---

## Flow 8: Job Provider Candidate Discovery & Explainable Match Review

```mermaid
sequenceDiagram
    autonumber
    actor Provider
    participant API as NEARVIA API
    participant DB as PostgreSQL PostGIS

    Provider->>API: GET /api/v1/jobs/:id/discover-workers
    API->>DB: ST_DWithin(worker.location, job.location, 5000m) AND is_available_now=TRUE
    DB-->>API: Raw candidate worker profiles
    API->>API: Compute Explainable Match Breakdown
    API-->>Provider: Returns Candidate List sorted by Match Score
    Note over Provider: Provider sees: "Ravi K. • 94% Match • 1.8 km • Skill Matched • Available Now"
    Provider->>API: POST /api/v1/jobs/:id/invite (worker_id)
    API-->>Provider: Invitation Dispatched
```

---

## Flow 9: Job Provider Worker Selection & Assignment Dispatch

```mermaid
flowchart TD
    A[Provider views Job Applications / Candidate List] --> B[Inspect Worker Card: Match %, Rating, Completed Jobs]
    B --> C{Decision}
    C -->|Decline| D[Mark Application 'REJECTED' with polite notification]
    C -->|Accept| E[Click 'Assign Worker']
    E --> F[System checks worker availability state]
    F --> G[Create Job Assignment record]
    G --> H[Send Instant High-Priority Alert to Worker]
```

---

## Flow 10: Provider Completion Confirmation & Wage Release

```mermaid
sequenceDiagram
    autonumber
    actor Worker
    actor Provider
    participant API as NEARVIA API
    participant DB as PostgreSQL DB

    Worker->>API: POST /api/v1/assignments/:id/finish-work
    API-->>Provider: Notification: "Worker marked task completed"
    Provider->>API: GET /api/v1/assignments/:id
    Provider->>API: POST /api/v1/assignments/:id/confirm-completion (hoursConfirmed, finalWage)
    API->>DB: UPDATE job_assignments SET status='COMPLETED'
    API->>DB: INSERT INTO payment_records (status='RECORDED', amount=...)
    API-->>Worker: Payout record confirmed
    API-->>Provider: Prompt for Worker Rating
```

---

## Flow 11: Local Agent-Assisted Worker Onboarding & Application

```mermaid
flowchart TD
    A[Unassisted Worker meets Verified Local Agent] --> B[Agent opens Agent Portal /agent/workers/new]
    B --> C[Agent inputs Worker Name, Phone, and Trade Skills]
    C --> D[Agent sets Worker Home Locality and Availability]
    D --> E[Worker profile created and linked: assisted_by_agent_id]
    E --> F[Agent searches nearby urgent micro-tasks]
    F --> G[Agent explains job requirements & wage to Worker]
    G --> H{Worker Consents?}
    H -->|Yes| I[Agent submits application on Worker's behalf]
    I --> J[NEARVIA records application under Worker ID with Agent attribution]
    H -->|No| K[Agent skips job]
```

---

## Flow 12: Trust & Identity Verification Lifecycle

```mermaid
stateDiagram-v2
    [*] --> UNVERIFIED: User registers phone OTP
    UNVERIFIED --> PENDING: User uploads Gov ID / Business License
    PENDING --> VERIFIED: Admin approves KYC documentation
    PENDING --> REJECTED: Incomplete/Blurry doc; resubmission requested
    REJECTED --> PENDING: User uploads corrected document
    VERIFIED --> [*]: Trust Badge active across public profile
```

---

## Flow 13: Two-Sided Post-Work Rating & Reputation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Worker
    actor Provider
    participant API as NEARVIA API
    participant DB as PostgreSQL DB

    Note over Worker,Provider: Task marked COMPLETED
    par Worker rates Provider
        Worker->>API: POST /api/v1/reviews (target=Provider, rating=1-5, tags, comments)
        API->>DB: Record Review & Recalculate Provider Average Rating
    and Provider rates Worker
        Provider->>API: POST /api/v1/reviews (target=Worker, rating=1-5, tags, comments)
        API->>DB: Record Review & Recalculate Worker Average Rating
    end
    API-->>Worker: Updated Reputation Score
    API-->>Provider: Updated Employer Score
```

---

## Flow 14: Dispute Raising & Admin Arbitration Flow

```mermaid
sequenceDiagram
    autonumber
    actor Disputant as Worker or Provider
    participant API as NEARVIA API
    participant Admin as Platform Admin
    participant DB as PostgreSQL DB

    Disputant->>API: POST /api/v1/disputes (assignment_id, reason, evidence_notes)
    API->>DB: UPDATE job_assignments SET status='DISPUTED'
    API->>DB: INSERT INTO disputes (status='OPEN')
    API-->>Admin: Alert in Admin Dispute Console
    Admin->>API: GET /api/v1/disputes/:id (Inspect check-in time, location logs, notes)
    Admin->>Admin: Reaches Arbitrated Settlement
    Admin->>API: POST /api/v1/disputes/:id/resolve (decision, paymentResolution)
    API->>DB: UPDATE disputes SET status='RESOLVED'
    API->>DB: Finalize payment_record & update user reliability metrics
    API-->>Disputant: Notification of binding resolution
```

---

## Flow 15: Polished Feedback, Empty States & Error Recovery

```mermaid
flowchart TD
    A[User opens Screen / Performs Action] --> B{Data Present?}
    B -->|Yes| C[Render Responsive Card Grid / Details]
    B -->|No| D[Render EmptyState Component]
    D --> E[Display Human-Friendly Reason e.g. 'No work in 5 km']
    E --> F[Provide One-Tap Recovery Action e.g. 'Change Filters' or 'Post Task']
    A --> G{API / Network Error?}
    G -->|Yes| H[ErrorBoundary Catches Exception]
    H --> I[Render Recovery Dialog with Retry / Home Action]
```

