# NEARVIA — PILOT OPERATIONAL REVIEW CYCLE

> **Document Version**: 1.0.0  
> **Target Audience**: Pilot Operations Team, Product Lead, Engineering On-Call  
> **Purpose**: Establish a structured, cadence-driven operational governance rhythm for NEARVIA pilot deployments.

---

## 1. Governance Overview

Operating a physical hyperlocal marketplace requires continuous operational vigilance. The review cycle is split into three tightly bounded rhythms:
1. **Daily Operational Standup (15 mins)**: Focus on what needs immediate triage today.
2. **Weekly Sprint & Performance Review (45 mins)**: Focus on marketplace health, conversion bottlenecks, and behavioral trends.
3. **Monthly Strategic & Economics Review (60 mins)**: Focus on cohort retention, category demand, unit economics, and backlog prioritization.

---

## 2. Daily Operational Standup (15 Minutes)

- **Schedule**: Every morning, 09:30 IST
- **Owner**: Pilot Operations Lead
- **Participants**: Operations Coordinator, Support Agent, Engineering On-Call
- **Source of Truth**: Live Admin Dashboard (`/admin`), Alert Queue, Telegram Incident Channel

### Daily Agenda & Checklist
1. **Critical Incidents (< 24h)**:
   - Any API or DB error spikes?
   - Any SMS/OTP delivery issues reported by field agents?
   - Any physical safety incidents reported via emergency hotline?
2. **Unassigned Urgent Jobs**:
   - Inspect all jobs with `status = 'PUBLISHED'` scheduled for the next 4–8 hours that have $< 1$ application.
   - Trigger manual agent outreach or broadcast to verified workers in that hyperlocal pin code.
3. **Payment & Cash Discrepancies**:
   - Run the operational reconciliation panel (`POST /api/v1/payments/reconcile`).
   - Review pending cash confirmations older than 12 hours.
   - Contact provider or worker if dual-confirmation is stalled.
4. **Safety & Disputes Queue**:
   - Review all tickets with status `OPEN` or `UNDER_REVIEW`.
   - Assign case investigator for any new wage or damage disputes.

---

## 3. Weekly Marketplace Performance Review (45 Minutes)

- **Schedule**: Every Monday, 11:00 IST
- **Owner**: Marketplace Operations Manager & Product Manager
- **Participants**: Full Pilot Team
- **Source of Truth**: `docs/MARKETPLACE_METRICS.md`, Platform Analytics Ledger

### Weekly Agenda & Metrics
1. **Marketplace Funnel Conversion**:
   - Total Jobs Posted ($N$)
   - Total Applications Submitted ($N$)
   - **Marketplace Fill Rate**: $\frac{\text{Filled Jobs}}{\text{Published Jobs}} \times 100\%$ (Disclose denominator)
   - **Median Time to First Application**: Target $< 30\text{ mins}$ for urgent tasks.
   - **Median Time to Assignment**: Target $< 2\text{ hours}$.
2. **Fulfillment & Reliability Signals**:
   - **Completion Rate**: $\frac{\text{Completed Assignments}}{\text{Total Assignments}} \times 100\%$
   - **Worker Cancellation Rate** vs. **Provider Cancellation Rate**
   - **Worker No-Show Rate**: Identify repeat offenders; check if transportation or wage was the root cause.
3. **Recommendation & Matching Performance**:
   - Recommendations shown vs. applications submitted via recommendations.
   - Review top worker rejection reasons (e.g. "Too far", "Low pay", "Wrong skill").
   - Adjust distance radius or category tags if distance was the primary blocker.
4. **User & Operator Feedback Synthesis**:
   - Review qualitative worker feedback logged by field agents.
   - Review provider complaints regarding punctuality or task execution.
   - Review administrative friction points experienced by operators.

---

## 4. Monthly Strategic & Unit Economics Review (60 Minutes)

- **Schedule**: First Wednesday of every calendar month
- **Owner**: Product Lead & Business Operations
- **Participants**: Founders, Engineering Lead, Operations Lead

### Monthly Agenda & Deep Dives
1. **Cohort Retention & Repeat Usage**:
   - **Repeat Workers**: Workers completing $\ge 2$ assignments in 30 days.
   - **Repeat Providers**: Employers posting $\ge 2$ jobs in 30 days.
   - Assess whether users are retaining on-platform or disintermediating off-platform for cash.
2. **Category & Geographic Demand Intelligence**:
   - Identify top 3 highest-demand trade categories (e.g. Retail Packing, Kitchen Helper, Electrical).
   - Identify supply-constrained pin codes / localities where jobs went unfilled.
   - Plan localized worker acquisition drives with Community Agents in deficit zones.
3. **Operational Cost & Unit Economics**:
   - SMS/OTP cost per active user.
   - Cloud hosting & database compute cost vs. active transaction volume.
   - Administrative hours spent per completed assignment (operational overhead).
4. **Product Backlog & Feature Flag Governance**:
   - Review items in `docs/PILOT_BACKLOG.md` (P0, P1, P2).
   - Decide on feature flag toggles (e.g. enabling instant jobs or expanding radius).

---

## 5. Review Record Log

| Date | Cadence | Reviewer | Key Decisions / Findings | Action Items |
| :--- | :--- | :--- | :--- | :--- |
| *Pending* | Daily | Operations | Live pilot launch standby | Verify SMS balances & admin alert routing |
| *Pending* | Weekly | Product / Ops | Baseline week 1 review | Benchmark fill rate and first application latency |
| *Pending* | Monthly | Leadership | 30-day pilot cohort audit | Evaluate geographic expansion readiness |

> **Operational Note**: The review cycle must only record verified factual data. If a scheduled meeting observes zero transaction activity due to pilot onboarding ramp-up, the log must explicitly state: `NO REAL PILOT DATA — ZERO SAMPLE SIZE`.
