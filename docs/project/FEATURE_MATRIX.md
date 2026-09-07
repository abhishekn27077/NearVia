# NEARVIA Feature Priority Matrix & Release Tiers

> **Document Version**: 1.0.0  
> **Status**: Approved Blueprint (Phase 1)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Feature Priority Definitions

- **P0 (Core MVP / Mandatory)**: Baseline functionalities required for the minimal viable marketplace loop: discover work, match, connect, assign, complete, and rate within a 5 km radius.
- **P1 (Important / Near-Term)**: Features essential for scalability, trust verification, assisted access, and operational dispute management.
- **P2 (Enhancements / Later Phases)**: User experience optimizations, regional language localization, and advanced scheduling.
- **P3 (Future Research / MCA Advanced)**: Exploratory machine learning models, automated voice interviews, and predictive fill analytics.

---

## 2. Feature Priority Matrix

| Feature Domain      | Feature Name                            | Priority | Target Phase | Description & Architectural Scope                                               |
| :------------------ | :-------------------------------------- | :------: | :----------: | :------------------------------------------------------------------------------ |
| **Authentication**  | Phone OTP Login                         |  **P0**  |   Phase 2    | Supabase Auth SMS OTP integration for fast, passwordless entry.                 |
| **Authentication**  | Role-Based Access Control (RBAC)        |  **P0**  |   Phase 2    | Explicit role enforcement for Worker, Provider, Agent, Admin.                   |
| **Worker Domain**   | Worker Profile & Skills Taxonomy        |  **P0**  |   Phase 2    | Visual trade skill selector chips, years of experience, rate estimate.          |
| **Worker Domain**   | "Available-Now" Real-time State         |  **P0**  |   Phase 3    | One-tap live availability toggle with auto-expiration timers.                   |
| **Worker Domain**   | Hyperlocal 5 km Discovery Feed          |  **P0**  |   Phase 4    | PostGIS `ST_DWithin` spatial query feed showing nearby open tasks.              |
| **Provider Domain** | Provider Profile & Business Details     |  **P0**  |   Phase 2    | Commercial shop/restaurant/contractor profile setup.                            |
| **Jobs Domain**     | Task / Shift / Job Creation Wizard      |  **P0**  |   Phase 3    | Progressive disclosure creation flow with duration and wage limits.             |
| **Matching Domain** | Multi-Factor Explainable Matching       |  **P0**  |   Phase 4    | Deterministic scoring formula with human-readable match breakdowns.             |
| **Applications**    | Worker Quick-Apply & Status Tracking    |  **P0**  |   Phase 5    | Direct one-click application with optional note/wage proposal.                  |
| **Assignments**     | Assignment Lifecycle State Machine      |  **P0**  |   Phase 5    | Step progression: `ASSIGNED` $\to$ `ARRIVED` $\to$ `STARTED` $\to$ `COMPLETED`. |
| **Reputation**      | Two-Sided Ratings & Reviews             |  **P0**  |   Phase 6    | Mandatory 1–5 star reviews and structured tags upon task completion.            |
| **Agent Domain**    | Assisted Worker Registration            |  **P1**  |   Phase 7    | Verified local agents registering and managing low-literacy workers.            |
| **Agent Domain**    | Assisted Job Application Workflow       |  **P1**  |   Phase 7    | Agent connects suitable assisted worker to open task with full audit log.       |
| **Trust & KYC**     | Document Upload & Verification Badges   |  **P1**  |   Phase 2    | Government ID & business license validation workflow.                           |
| **Job Readiness**   | Orientation & Equipment Declarations    |  **P1**  |   Phase 3    | Employer notes specifying required tools, supervisor, and briefing.             |
| **Disputes**        | Dispute Ticket Raising & Resolution     |  **P1**  |   Phase 6    | Formal conflict resolution queue with admin binding actions.                    |
| **Payments**        | Payment Payout Records & Receipts       |  **P1**  |   Phase 6    | Shift payout logging, digital receipts, and earnings history.                   |
| **Notifications**   | Multi-Channel Alerts (In-App & SMS)     |  **P1**  |   Phase 5    | Push/SMS alerts on new applications, selection, and shift reminders.            |
| **Localization**    | Multi-Language Support (Kannada, Hindi) |  **P2**  |   Phase 8    | Decoupled i18n string dictionaries for regional language switching.             |
| **Scheduling**      | Advanced Worker Availability Calendar   |  **P2**  |   Phase 8    | Recurring weekly time slot scheduler and blackout date management.              |
| **Analytics**       | Spatial Fill Rate & Latency Dashboards  |  **P2**  |   Phase 8    | Admin analytics tracking time-to-first-match and radius efficiency.             |
| **Accessibility**   | Voice-Assisted Form Prompts             |  **P2**  |   Phase 8    | Audio prompts for low-literacy worker onboarding.                               |
| **Advanced ML**     | Predictive Fill Rate Forecasting        |  **P3**  |   Phase 10   | Research model predicting task fill likelihood based on wage & time.            |
| **Advanced ML**     | Dynamic Pricing Recommendation          |  **P3**  |   Phase 10   | Algorithmic wage suggestions based on hyperlocal demand-supply.                 |
| **Automation**      | Automated Skill Verification Quizzes    |  **P3**  |   Phase 10   | Interactive in-app micro-assessments for technical trades.                      |

---

## 3. Scope Boundary Rules for Future Coding Agents

1. **Strict Priority Sequencing**: AI agents must never implement P1, P2, or P3 features during a P0 phase without explicit human instruction.
2. **Feature Ownership**: All logic must reside within its designated domain module (`services/api/src/modules/<domain>`).
3. **No Phantom Integrations**: Do NOT integrate third-party payment gateways, voice engines, or external ML APIs until their respective P2/P3 phases are reached.
